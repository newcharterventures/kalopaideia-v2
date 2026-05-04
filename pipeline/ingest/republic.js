// Plato's Republic ingester — prose by Stephanus section.
// Unit: one section (e.g., "327a-328b"). Smaller than a full Stephanus page,
// granular enough for readable sessions.
//
// We gloss by section (not sub-section) since the XML has <div subtype="section"/>.

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

const BUDGET_USD = parseFloat(process.env.PAIDEIA_BUDGET_USD || "30");
const PRICE_IN = 3.0 / 1_000_000;
const PRICE_OUT = 15.0 / 1_000_000;
let spentUSD = 0;

async function loadSpent() {
  const p = path.join(CACHE, "budget-spent.json");
  try { const raw = await fs.readFile(p, "utf8"); spentUSD = JSON.parse(raw).usd || 0; } catch {}
}
async function saveSpent() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(path.join(CACHE, "budget-spent.json"), JSON.stringify({ usd: spentUSD, at: new Date().toISOString() }, null, 2));
}
function addSpent(u) { spentUSD += (u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT; }
function budgetOk() { return spentUSD < BUDGET_USD; }

function collectText(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  let t = "";
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("@_")) continue;
    if (k === "#text") t += " " + v;
    else if (Array.isArray(v)) for (const x of v) t += " " + collectText(x);
    else t += " " + collectText(v);
  }
  return t;
}

// Walk: find subtype=book divs with n, then within each, subtype=section divs.
function parseRepublic(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
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
          const subtype = d["@_subtype"];
          const n = d["@_n"];
          if (subtype === "book") {
            walk(d, n);
          } else if (subtype === "section" && bookN) {
            const text = collectText(d)
              .replace(/\s+/g, " ")
              .trim();
            if (n && text && text.length > 20) {
              if (!books[bookN]) books[bookN] = [];
              books[bookN].push({ n, text });
            }
          } else {
            walk(d, bookN);
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

async function glossSection(text, prev, next) {
  if (!budgetOk()) throw new Error(`Budget exceeded: $${spentUSD.toFixed(4)}`);
  const sys = `You produce terse scholarly glosses for sections of Plato's Republic (Classical Attic Greek prose). Identify 4-6 key words or phrases in the given section with their part of speech, case/form, and English meaning. Output 1-3 sentences of gloss text. No JSON, no preamble, no numbering.`;
  const user = `Previous section (abridged): ${(prev || "").slice(0, 200)}...\nCurrent section to gloss: ${text}\n\nProduce the gloss.`;
  const res = await client.messages.create({ model: MODEL, max_tokens: 300, system: sys, messages: [{ role: "user", content: user }] });
  addSpent(res.usage);
  return (res.content[0]?.text || "").trim();
}

async function main() {
  const bookN = process.argv[2] || "1";
  await loadSpent();
  console.log(`[budget] start at $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);

  const grcXml = await fs.readFile(path.join(RAW, "republic-grc.xml"), "utf8");
  const engXml = await fs.readFile(path.join(RAW, "republic-eng.xml"), "utf8");
  const grcBooks = parseRepublic(grcXml);
  const engBooks = parseRepublic(engXml);

  const sections = grcBooks[bookN] || [];
  const engSections = engBooks[bookN] || [];
  console.log(`[republic book ${bookN}] ${sections.length} Greek sections, ${engSections.length} English sections`);
  if (!sections.length) { console.error("no content"); process.exit(1); }

  // Map English by section number for alignment
  const engByN = {};
  for (const s of engSections) engByN[s.n] = s.text;

  const id = `republic-book-${bookN}`;
  const cachePath = path.join(CACHE, `${id}-glosses.json`);
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, "utf8")); } catch {}

  const lines = [];
  const englishParagraphs = [];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const prev = i > 0 ? sections[i - 1].text : "";
    const next = i < sections.length - 1 ? sections[i + 1].text : "";
    let gloss = cache[s.n];
    if (!gloss) {
      try {
        gloss = await glossSection(s.text, prev, next);
        cache[s.n] = gloss;
        if (i % 5 === 0 || i === sections.length - 1) {
          await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
          await saveSpent();
          console.log(`[progress] ${i+1}/${sections.length} · spent $${spentUSD.toFixed(4)}`);
        }
      } catch (err) {
        if (err.message.startsWith("Budget exceeded")) {
          console.error(`[budget] STOP at section ${s.n}`);
          break;
        }
        console.error(`[gloss] failed ${s.n}:`, err.message);
        gloss = "";
      }
    }

    const eng = engByN[s.n] || "";
    lines.push({
      n: s.n,  // e.g. "327"
      original: s.text,
      english: eng,
      gloss,
    });
    if (eng) englishParagraphs.push(`[${s.n}] ${eng}`);
  }

  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await saveSpent();

  const out = {
    id,
    language: "greek",
    title: `Republic, Book ${bookN}`,
    author: "Plato",
    date: "c. 375 BCE",
    meter: "Prose",
    translator: "Benjamin Jowett",
    translator_date: "1888",
    license: "Public domain",
    source_notes: "Greek text: Burnet (OCT) via Perseus. English: Benjamin Jowett 1888 via Perseus.",
    reading_notes: `Book ${bookN} of Plato's Republic. ${sections.length} Stephanus sections. Each Greek section aligned with Jowett's English translation for the same section.`,
    status: "open",
    lines,
    english_paragraphs: englishParagraphs,
  };
  await fs.mkdir(LIB, { recursive: true });
  await fs.writeFile(path.join(LIB, `${id}.json`), JSON.stringify(out, null, 2));
  console.log(`\n✅ ${id} written: ${lines.length} sections, $${spentUSD.toFixed(4)} spent`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
