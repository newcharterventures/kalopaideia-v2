// Generate per-line English translations for long works where we only had
// paragraph-level Butler prose. Each line is translated in the context of its
// immediate neighbors and the surrounding paragraph so the output reads cleanly.
//
// Usage: node per-line-english.js <text-id> [<text-id> ...]
// Budget: shared with other ingesters via data/ingest-cache/budget-spent.json.
// Per-line cache: data/ingest-cache/<text-id>-english.json — reruns are free.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LIB = path.join(ROOT, "data", "library");
const CACHE = path.join(ROOT, "data", "ingest-cache");

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

const BUDGET_USD = parseFloat(process.env.PAIDEIA_BUDGET_USD || "20");
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
  await fs.writeFile(path.join(CACHE, "budget-spent.json"),
    JSON.stringify({ usd: spentUSD, at: new Date().toISOString() }, null, 2));
}
function addSpent(usage) {
  spentUSD += (usage.input_tokens || 0) * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
}

// Figure out which paragraph covers each line (same proportional mapping
// fill-english.js used), so Claude gets the correct Butler context.
function buildParagraphIndex(lines, paragraphs) {
  const N = lines.length;
  const P = paragraphs.length;
  const paraFor = new Array(N);
  for (let i = 0; i < N; i++) {
    paraFor[i] = Math.min(P - 1, Math.floor((i / N) * P));
  }
  return paraFor;
}

async function translateLine({ language, title, line, prev, next, paragraph }) {
  const prompt = `You are translating a single line of ${language} poetry from ${title} into concise, readable English. Match the line's meaning closely — do NOT paraphrase the whole paragraph, do NOT add lines that aren't in the original. Keep it to one clean English sentence or clause, 5-25 words. No quotation marks, no line numbers, no notes.

Context (Butler's prose for the surrounding paragraph, for reference only — do not repeat it):
${paragraph}

Previous line: ${prev || "(start)"}
LINE TO TRANSLATE: ${line}
Next line: ${next || "(end)"}

Output ONLY the English translation of LINE TO TRANSLATE, nothing else.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });
  addSpent(resp.usage);
  const text = (resp.content || []).map((b) => b.text || "").join("").trim();
  return text.replace(/^["'"']|["'"']$/g, "").trim();
}

async function processFile(textId) {
  const libPath = path.join(LIB, `${textId}.json`);
  const doc = JSON.parse(await fs.readFile(libPath, "utf8"));
  const lines = doc.lines || [];
  const paragraphs = doc.english_paragraphs || [];
  if (!lines.length) { console.log(`[${textId}] no lines; skipping`); return; }
  if (!paragraphs.length) { console.log(`[${textId}] no english_paragraphs; skipping`); return; }

  const cachePath = path.join(CACHE, `${textId}-english.json`);
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, "utf8")); } catch {}

  const paraFor = buildParagraphIndex(lines, paragraphs);
  let done = 0;
  let translated = 0;
  const language = doc.language === "greek" ? "Ancient Greek" :
                   doc.language === "latin" ? "Classical Latin" :
                   doc.language || "ancient";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = String(line.n);
    if (cache[key]) {
      line.english = cache[key];
      done++;
      continue;
    }
    if (spentUSD >= BUDGET_USD) {
      console.error(`[${textId}] BUDGET EXCEEDED at line ${line.n} ($${spentUSD.toFixed(4)} / $${BUDGET_USD}); stopping`);
      break;
    }
    try {
      const english = await translateLine({
        language,
        title: doc.title || textId,
        line: line.original,
        prev: i > 0 ? lines[i - 1].original : "",
        next: i < lines.length - 1 ? lines[i + 1].original : "",
        paragraph: paragraphs[paraFor[i]] || "",
      });
      cache[key] = english;
      line.english = english;
      translated++;
      done++;
      if (translated % 20 === 0) {
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
        await saveSpent();
        await fs.writeFile(libPath, JSON.stringify(doc, null, 2));
        console.log(`[${textId}] ${done}/${lines.length} · spent $${spentUSD.toFixed(4)}`);
      }
    } catch (err) {
      console.error(`[${textId}] line ${line.n} failed:`, err.message);
    }
  }

  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await saveSpent();
  await fs.writeFile(libPath, JSON.stringify(doc, null, 2));
  console.log(`[${textId}] DONE: ${done}/${lines.length} lines translated (new: ${translated}) · spent $${spentUSD.toFixed(4)}`);
}

async function main() {
  await loadSpent();
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error("usage: per-line-english.js <text-id> [<text-id> ...]");
    process.exit(1);
  }
  console.log(`[budget] starting at $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);
  for (const id of ids) {
    await processFile(id);
    if (spentUSD >= BUDGET_USD) break;
  }
  console.log(`[budget] final: $${spentUSD.toFixed(4)} / $${BUDGET_USD}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
