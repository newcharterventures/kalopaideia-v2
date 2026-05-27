// Patch an already-ingested library JSON with (re-parsed) english_paragraphs.
// Usage: node patch-english.js <work-key> <book-n>

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const WORKS = {
  iliad:    { eng: "iliad-eng.xml" },
  odyssey:  { eng: "odyssey-eng.xml" },
  aeneid:   { eng: "aeneid-eng.xml" },
  republic: { eng: "republic-eng.xml" },
};

function parseEnglishParagraphs(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
  const parsed = parser.parse(xmlText);
  const body = parsed?.TEI?.text?.body;
  if (!body) throw new Error("no body");
  const books = {};
  const bookLines = {};
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
          const text = collectText(p).replace(/\s+/g, " ").replace(/\[[^\]]+\]/g, "").replace(/\s+([.,;:!?])/g, "$1").trim();
          if (bookN && text) {
            if (!books[bookN]) books[bookN] = [];
            books[bookN].push(text);
          }
        }
      } else if (key === "l") {
        const ls = Array.isArray(val) ? val : [val];
        for (const l of ls) {
          const text = collectText(l).replace(/\s+/g, " ").trim();
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
  for (const bookN of Object.keys(bookLines)) {
    if (books[bookN] && books[bookN].length) continue;
    const lines = bookLines[bookN];
    if (!lines.length) continue;
    const chunks = [];
    for (let i = 0; i < lines.length; i += 10) chunks.push(lines.slice(i, i + 10).join(" "));
    books[bookN] = chunks;
  }
  return books;
}

async function main() {
  const workKey = process.argv[2];
  const bookN = process.argv[3] || "1";
  if (!workKey || !WORKS[workKey]) { console.error("usage: patch-english.js <work> <book-n>"); process.exit(1); }

  const xml = await fs.readFile(path.join(ROOT, "data", "raw", WORKS[workKey].eng), "utf8");
  const books = parseEnglishParagraphs(xml);
  const paras = books[bookN] || [];
  console.log(`[${workKey} book ${bookN}] parsed ${paras.length} english paragraphs`);
  if (!paras.length) { console.error("no paragraphs"); process.exit(1); }

  const libPath = path.join(ROOT, "data", "library", `${workKey}-book-${bookN}.json`);
  const doc = JSON.parse(await fs.readFile(libPath, "utf8"));
  doc.english_paragraphs = paras;
  await fs.writeFile(libPath, JSON.stringify(doc, null, 2));
  console.log(`✅ patched ${libPath}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
