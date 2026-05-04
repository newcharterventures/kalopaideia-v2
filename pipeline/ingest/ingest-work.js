// Generic ingester: takes a work-config, produces data/library/<id>-book-N.json
// Config defines: id prefix, language, title, author, meter, translator, date, Greek/Latin XML, English XML.
// Budget-capped, resumable from cache.
//
// Usage: PAIDEIA_BUDGET_USD=30 node ingest-work.js <work-key> <book-n>
//   work-key: iliad | odyssey | aeneid | republic
//   book-n: 1-based book number

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
  try {
    const raw = await fs.readFile(p, "utf8");
    spentUSD = JSON.parse(raw).usd || 0;
  } catch {}
}
async function saveSpent() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(path.join(CACHE, "budget-spent.json"), JSON.stringify({ usd: spentUSD, at: new Date().toISOString() }, null, 2));
}
function addSpent(usage) {
  spentUSD += (usage.input_tokens || 0) * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
}
function budgetOk() { return spentUSD < BUDGET_USD; }

// Unit = <l> for verse, <milestone unit="section"/chunk for prose
const WORKS = {
  iliad: {
    language: "greek",
    title: "Iliad",
    author: "Homer",
    date: "c. 8th century BCE",
    meter: "Dactylic hexameter",
    translator: "Samuel Butler",
    translator_date: "1898 (revised)",
    license: "Public domain",
    greek_xml: "iliad-grc.xml",
    eng_xml: "iliad-eng.xml",
    unit: "line",
    gloss_system: "You produce terse scholarly glosses for individual lines of Homeric Greek verse from the Iliad. Given one Greek line, identify 3-5 key words with their part of speech, form, and meaning. Output 1-2 sentences, no JSON, no preamble.",
    source_notes: "Greek text: Monro & Allen, Oxford Classical Text, via Perseus Digital Library. English: Samuel Butler 1898, via Perseus Digital Library."
  },
  odyssey: {
    language: "greek",
    title: "Odyssey",
    author: "Homer",
    date: "c. 8th century BCE",
    meter: "Dactylic hexameter",
    translator: "Samuel Butler",
    translator_date: "1900 (revised)",
    license: "Public domain",
    greek_xml: "odyssey-grc.xml",
    eng_xml: "odyssey-eng.xml",
    unit: "line",
    gloss_system: "You produce terse scholarly glosses for individual lines of Homeric Greek verse from the Odyssey. Given one Greek line, identify 3-5 key words with their part of speech, form, and meaning. Output 1-2 sentences, no JSON, no preamble.",
    source_notes: "Greek text: Monro & Allen via Perseus. English: Samuel Butler 1900 via Perseus."
  },
  aeneid: {
    language: "latin",
    title: "Aeneid",
    author: "Publius Vergilius Maro (Virgil)",
    date: "c. 29-19 BCE",
    meter: "Dactylic hexameter",
    translator: "John Dryden",
    translator_date: "1697",
    license: "Public domain",
    greek_xml: "aeneid-lat.xml",
    eng_xml: "aeneid-eng.xml",
    unit: "line",
    gloss_system: "You produce terse scholarly glosses for individual lines of Virgil's Aeneid (Classical Latin verse). Given one Latin line, identify 3-5 key words with their part of speech, case/form, and meaning. Output 1-2 sentences, no JSON, no preamble.",
    source_notes: "Latin text: Mynors, Oxford Classical Text via Perseus. English: John Dryden 1697 via Perseus."
  },
  republic: {
    language: "greek",
    title: "Republic",
    author: "Plato",
    date: "c. 375 BCE",
    meter: "Prose",
    translator: "Benjamin Jowett",
    translator_date: "1888",
    license: "Public domain",
    greek_xml: "republic-grc.xml",
    eng_xml: "republic-eng.xml",
    unit: "section", // prose, by Stephanus section
    gloss_system: "You produce terse scholarly glosses for passages of Plato's Republic (Classical Attic Greek prose). Given one Stephanus section of Greek, identify 3-5 key words or phrases with their part of speech, case/form, and meaning. Output 1-2 sentences, no JSON, no preamble.",
    source_notes: "Greek text: Burnet (OCT) via Perseus. English: Jowett 1888 via Perseus."
  },
};

function parseWorkXml(xmlText, unit) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
  const parsed = parser.parse(xmlText);
  const body = parsed?.TEI?.text?.body;
  if (!body) throw new Error("no TEI body");
  const books = {};
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
  function walk(node, bookN) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, bookN)); return; }
    for (const [key, val] of Object.entries(node)) {
      if (key === "div") {
        const divs = Array.isArray(val) ? val : [val];
        for (const d of divs) {
          const subtype = d["@_subtype"] || d["@_type"];
          const n = d["@_n"];
          // Iliad/Aeneid/Odyssey: Book is subtype=Book
          // Republic: subtype=book for book; sections are divs inside
          const isBook = (subtype === "Book" || subtype === "book") ||
            // Some English texts use textpart+numeric for book
            (subtype === "textpart" && n && /^\d+$/.test(n) && !bookN);
          const nextBookN = isBook ? n : bookN;
          walk(d, nextBookN);
        }
      } else if (key === "l" && unit === "line") {
        const ls = Array.isArray(val) ? val : [val];
        for (const l of ls) {
          const n = l["@_n"];
          const text = collectText(l).replace(/\s+/g, " ").trim();
          if (bookN && n && text) {
            if (!books[bookN]) books[bookN] = [];
            books[bookN].push({ n: parseInt(n, 10) || n, text });
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

function parseEnglishParagraphs(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
  const parsed = parser.parse(xmlText);
  const body = parsed?.TEI?.text?.body;
  if (!body) throw new Error("no body");
  const books = {};
  const bookLines = {}; // for fallback: raw <l> per book
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
  function walk(node, bookN) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, bookN)); return; }
    for (const [key, val] of Object.entries(node)) {
      if (key === "div") {
        const divs = Array.isArray(val) ? val : [val];
        for (const d of divs) {
          const subtype = d["@_subtype"] || d["@_type"];
          const n = d["@_n"];
          const isBook = (subtype === "Book" || subtype === "book") ||
            (subtype === "textpart" && n && /^\d+$/.test(n));
          walk(d, isBook ? n : bookN);
        }
      } else if (key === "p") {
        const ps = Array.isArray(val) ? val : [val];
        for (const p of ps) {
          const text = collectText(p)
            .replace(/\s+/g, " ")
            .replace(/\[[^\]]+\]/g, "")
            .replace(/\s+([.,;:!?])/g, "$1")
            .trim();
          if (bookN && text) {
            if (!books[bookN]) books[bookN] = [];
            books[bookN].push(text);
          }
        }
      } else if (key === "l") {
        // Capture verse lines as fallback for prose-only parser
        const ls = Array.isArray(val) ? val : [val];
        for (const l of ls) {
          const text = collectText(l)
            .replace(/\s+/g, " ")
            .trim();
          if (bookN && text) {
            if (!bookLines[bookN]) bookLines[bookN] = [];
            bookLines[bookN].push(text);
          }
        }
      } else if (typeof val === "object") {
        walk(val, bookN);
      }
    }
  }
  walk(body, null);

  // If a book had no <p> paragraphs but has <l> verse lines, group into pseudo-paragraphs (10 lines each).
  for (const bookN of Object.keys(bookLines)) {
    if (books[bookN] && books[bookN].length) continue;
    const lines = bookLines[bookN];
    if (!lines.length) continue;
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) {
      chunks.push(lines.slice(i, i + 10).join(" "));
    }
    books[bookN] = chunks;
  }

  return books;
}

async function glossUnit(cfg, text, prev, next) {
  if (!budgetOk()) {
    throw new Error(`Budget exceeded: $${spentUSD.toFixed(4)}`);
  }
  const ctx = `Previous: ${prev || "(none)"}\nNext: ${next || "(none)"}\nTarget: ${text}\n\nProduce the gloss.`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: cfg.gloss_system,
    messages: [{ role: "user", content: ctx }],
  });
  addSpent(res.usage);
  return (res.content[0]?.text || "").trim();
}

async function main() {
  const workKey = process.argv[2];
  const bookN = process.argv[3] || "1";
  if (!workKey || !WORKS[workKey]) {
    console.error("usage: ingest-work.js <iliad|odyssey|aeneid|republic> <book-n>");
    process.exit(1);
  }
  const cfg = WORKS[workKey];

  await loadSpent();
  console.log(`[budget] start at $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);

  const srcXml = await fs.readFile(path.join(RAW, cfg.greek_xml), "utf8");
  const engXml = await fs.readFile(path.join(RAW, cfg.eng_xml), "utf8");

  const srcBooks = parseWorkXml(srcXml, cfg.unit);
  const engBooks = parseEnglishParagraphs(engXml);
  const units = srcBooks[bookN] || [];
  const paras = engBooks[bookN] || [];
  console.log(`[${workKey} book ${bookN}] ${units.length} units, ${paras.length} paragraphs`);
  if (!units.length) {
    console.error("no content for that book");
    process.exit(1);
  }

  const id = `${workKey}-book-${bookN}`;
  const cachePath = path.join(CACHE, `${id}-glosses.json`);
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, "utf8")); } catch {}

  const lines = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const prev = i > 0 ? units[i - 1].text : "";
    const next = i < units.length - 1 ? units[i + 1].text : "";
    let gloss = cache[u.n];
    if (!gloss) {
      try {
        gloss = await glossUnit(cfg, u.text, prev, next);
        cache[u.n] = gloss;
        if (i % 20 === 0 || i === units.length - 1) {
          await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
          await saveSpent();
          console.log(`[progress] ${i+1}/${units.length} · spent $${spentUSD.toFixed(4)}`);
        }
      } catch (err) {
        if (err.message.startsWith("Budget exceeded")) {
          console.error(`[budget] STOP at unit ${u.n}`);
          break;
        }
        console.error(`[gloss] failed ${u.n}:`, err.message);
        gloss = "";
      }
    }
    lines.push({ n: u.n, original: u.text, english: "", gloss });
  }
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await saveSpent();

  const out = {
    id,
    language: cfg.language,
    title: `${cfg.title}, Book ${bookN}`,
    author: cfg.author,
    date: cfg.date,
    meter: cfg.meter,
    translator: cfg.translator,
    translator_date: cfg.translator_date,
    license: cfg.license,
    source_notes: cfg.source_notes,
    reading_notes: `Book ${bookN} of the ${cfg.title}. ${units.length} ${cfg.unit}s. Per-${cfg.unit} ${cfg.language} with per-${cfg.unit} gloss; ${cfg.translator}'s prose translation provided as parallel panel for context.`,
    status: "open",
    lines,
    english_paragraphs: paras,
  };
  await fs.mkdir(LIB, { recursive: true });
  await fs.writeFile(path.join(LIB, `${id}.json`), JSON.stringify(out, null, 2));
  console.log(`\n✅ ${id} written with ${lines.length} units, $${spentUSD.toFixed(4)} spent`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
