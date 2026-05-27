// Iliad ingester: Perseus Greek (Monro-Allen) + Butler English (1898, prose).
// Produces data/library/iliad-book-N.json for each book.
// Budget cap: $30 total, checked before every Claude call.
//
// Design:
// - Greek text is canonical line-numbered (CTS N-per-book)
// - English is paragraph-level (Butler prose). We keep them linked by book, not line-by-line.
// - Per Greek line: Claude generates a concise gloss (1-2 sentences).
// - English paragraphs shown alongside Greek lines in a "paragraph panel" that stays with you as you read.
//
// Per-line cost approx:
//   input: ~350 tokens (line + 1 neighbor each side + brief prompt)
//   output: ~80 tokens
//   ~$3.30 per 1000 lines
// Book 1 = 611 lines = ~$2.02

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const RAW = path.join(ROOT, "data", "raw");
const LIB = path.join(ROOT, "data", "library");
const CACHE = path.join(ROOT, "data", "ingest-cache");

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

// Budget enforcement (in USD)
const BUDGET_USD = parseFloat(process.env.PAIDEIA_BUDGET_USD || "30");
const PRICE_IN = 3.0 / 1_000_000;   // $3 per 1M input tokens
const PRICE_OUT = 15.0 / 1_000_000; // $15 per 1M output tokens

let spentUSD = 0;

async function loadSpent() {
  const p = path.join(CACHE, "budget-spent.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const d = JSON.parse(raw);
    spentUSD = d.usd || 0;
  } catch {}
}

async function saveSpent() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(path.join(CACHE, "budget-spent.json"), JSON.stringify({ usd: spentUSD, at: new Date().toISOString() }, null, 2));
}

function addSpent(usage) {
  const cost = (usage.input_tokens || 0) * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
  spentUSD += cost;
}

function budgetOk() {
  return spentUSD < BUDGET_USD;
}

// --- Parse canonical Greek XML ---
function parseGreekTEI(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(xmlText);
  // Walk to find divs by book and <l> by line
  const body = parsed?.TEI?.text?.body;
  if (!body) throw new Error("no body in TEI");
  // Books live under body > div (type=edition?) > div (type=textpart, subtype=Book)
  const books = {};
  function walk(node, bookN) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, bookN)); return; }
    for (const [key, val] of Object.entries(node)) {
      if (key === "div") {
        const divs = Array.isArray(val) ? val : [val];
        for (const d of divs) {
          const subtype = d["@_subtype"] || d["@_type"];
          const n = d["@_n"];
          const nextBookN = (subtype === "Book" || subtype === "book") ? n : bookN;
          walk(d, nextBookN);
        }
      } else if (key === "l") {
        const ls = Array.isArray(val) ? val : [val];
        for (const l of ls) {
          const n = l["@_n"];
          let text = "";
          if (typeof l === "string") text = l;
          else if (l["#text"]) text = l["#text"];
          else {
            // collect all strings
            const stack = [l];
            while (stack.length) {
              const x = stack.pop();
              if (typeof x === "string") text += " " + x;
              else if (x && typeof x === "object") {
                for (const [k2, v2] of Object.entries(x)) {
                  if (k2.startsWith("@_")) continue;
                  if (k2 === "#text") text += " " + v2;
                  else if (Array.isArray(v2)) stack.push(...v2);
                  else stack.push(v2);
                }
              }
            }
          }
          text = text.replace(/\s+/g, " ").trim();
          if (bookN && n && text) {
            if (!books[bookN]) books[bookN] = [];
            books[bookN].push({ n: parseInt(n, 10), text });
          }
        }
      } else if (typeof val === "object") {
        walk(val, bookN);
      }
    }
  }
  walk(body, null);
  return books;
}

// --- Parse Butler English XML: collect paragraphs per book ---
function parseEnglishTEI(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(xmlText);
  const body = parsed?.TEI?.text?.body;
  if (!body) throw new Error("no body");
  const books = {};
  function walk(node, bookN) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, bookN)); return; }
    for (const [key, val] of Object.entries(node)) {
      if (key === "div") {
        const divs = Array.isArray(val) ? val : [val];
        for (const d of divs) {
          const subtype = d["@_subtype"] || d["@_type"];
          const n = d["@_n"];
          const nextBookN = (subtype === "Book" || subtype === "book" || (subtype === "textpart" && n && /^\d+$/.test(n))) ? n : bookN;
          walk(d, nextBookN);
        }
      } else if (key === "p") {
        const ps = Array.isArray(val) ? val : [val];
        for (const p of ps) {
          let text = "";
          const stack = [p];
          while (stack.length) {
            const x = stack.pop();
            if (typeof x === "string") text += " " + x;
            else if (x && typeof x === "object") {
              for (const [k2, v2] of Object.entries(x)) {
                if (k2.startsWith("@_")) continue;
                if (k2 === "#text") text += " " + v2;
                else if (Array.isArray(v2)) stack.push(...v2);
                else stack.push(v2);
              }
            }
          }
          text = text.replace(/\s+/g, " ").replace(/\[[^\]]+\]/g, "").replace(/\s+([.,;:!?])/g, "$1").trim();
          if (bookN && text) {
            if (!books[bookN]) books[bookN] = [];
            books[bookN].push(text);
          }
        }
      } else if (typeof val === "object") {
        walk(val, bookN);
      }
    }
  }
  walk(body, null);
  return books;
}

// --- Claude gloss generator ---
const GLOSS_SYSTEM = `You produce terse scholarly glosses for individual lines of ancient Greek verse (Homer's Iliad). Given one Greek line, produce a concise gloss identifying key words with their part of speech, case/form, and meaning. Focus on words a college-level reader would want explained. Output 1-2 sentences of gloss text only — no JSON, no preamble, no labels. Examples of tone: "μῆνιν (acc. sg. of μῆνις) 'wrath, anger'; ἄειδε (pres. imperative) 'sing!'; Πηληϊάδεω (gen. sg.) 'son of Peleus'."`;

async function glossLine(greekLine, prevLine, nextLine) {
  if (!budgetOk()) {
    throw new Error(`Budget exceeded: spent $${spentUSD.toFixed(4)} of $${BUDGET_USD}`);
  }
  const context = `Previous line: ${prevLine || "(none)"}
Next line: ${nextLine || "(none)"}
Current line to gloss: ${greekLine}

Produce the gloss.`;
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: GLOSS_SYSTEM,
    messages: [{ role: "user", content: context }],
  });
  addSpent(response.usage);
  const text = (response.content[0]?.text || "").trim();
  return text;
}

// --- Main: ingest Iliad Book 1 ---
async function main() {
  await loadSpent();
  console.log(`[budget] starting at $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);

  const greekXml = await fs.readFile(path.join(RAW, "iliad-grc.xml"), "utf8");
  const englishXml = await fs.readFile(path.join(RAW, "iliad-eng.xml"), "utf8");

  console.log("[parse] Greek TEI...");
  const greekBooks = parseGreekTEI(greekXml);
  console.log(`[parse] found Greek books: ${Object.keys(greekBooks).length}`);
  console.log(`[parse] book 1 has ${greekBooks["1"]?.length || 0} lines`);

  console.log("[parse] English TEI...");
  const englishBooks = parseEnglishTEI(englishXml);
  console.log(`[parse] found English books: ${Object.keys(englishBooks).length}`);
  console.log(`[parse] book 1 has ${englishBooks["1"]?.length || 0} paragraphs`);

  // For tonight: only Book 1
  const bookN = "1";
  const greekLines = greekBooks[bookN];
  const englishParas = englishBooks[bookN];
  if (!greekLines || !englishParas) {
    throw new Error("missing book 1 content");
  }

  console.log(`[gloss] generating glosses for ${greekLines.length} lines...`);

  // Cache glosses so reruns resume
  const cachePath = path.join(CACHE, `iliad-book-${bookN}-glosses.json`);
  let cache = {};
  try {
    cache = JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {}

  const lines = [];
  for (let i = 0; i < greekLines.length; i++) {
    const { n, text } = greekLines[i];
    const prev = i > 0 ? greekLines[i - 1].text : "";
    const next = i < greekLines.length - 1 ? greekLines[i + 1].text : "";
    let gloss = cache[n];
    if (!gloss) {
      try {
        gloss = await glossLine(text, prev, next);
        cache[n] = gloss;
        // Save cache + budget every 20 lines
        if (i % 20 === 0 || i === greekLines.length - 1) {
          await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
          await saveSpent();
          console.log(`[progress] ${i+1}/${greekLines.length} · spent $${spentUSD.toFixed(4)}`);
        }
      } catch (err) {
        if (err.message.startsWith("Budget exceeded")) {
          console.error(`[budget] STOPPING at line ${n}: ${err.message}`);
          await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
          await saveSpent();
          break;
        }
        console.error(`[gloss] failed line ${n}:`, err.message);
        gloss = "";
      }
    }
    lines.push({
      n,
      original: text,
      english: "", // paragraph-level alongside instead
      gloss,
    });
  }

  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await saveSpent();

  // Write the library JSON with paragraph-aligned English as a parallel "english_paragraphs" array
  const out = {
    id: "iliad-book-1",
    language: "greek",
    title: "Iliad, Book I",
    author: "Homer",
    date: "c. 8th century BCE",
    meter: "Dactylic hexameter",
    translator: "Samuel Butler",
    translator_date: "1898 (revised)",
    license: "Public domain",
    source_notes: "Greek text: Monro & Allen, Oxford Classical Text, via Perseus Digital Library (canonical-greekLit). English: Samuel Butler, 1898, revised by Timothy Power and Gregory Nagy, via Perseus Digital Library.",
    reading_notes: "Book 1 of the Iliad: the quarrel between Agamemnon and Achilles over the captured woman Chryseis, the plague sent by Apollo, the withdrawal of Achilles from battle, and the appeal of Thetis to Zeus. 611 lines. Line-by-line Greek with per-line gloss; Butler's prose translation presented as a parallel panel for context.",
    status: "open",
    lines,
    english_paragraphs: englishParas,
  };
  await fs.mkdir(LIB, { recursive: true });
  await fs.writeFile(path.join(LIB, "iliad-book-1.json"), JSON.stringify(out, null, 2));

  console.log(`\n✅ iliad-book-1 written with ${lines.length} lines`);
  console.log(`[budget] final: $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
