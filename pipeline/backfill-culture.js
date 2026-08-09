// Generate cultural vignettes for backfilled word days.
// Reads each data/words/YYYY-MM-DD.json for Apr 11-20 and writes data/culture/YYYY-MM-DD.json
import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

const CULTURE_PROMPTS = {
  latin: "classical Roman culture (Republic and Empire, up to c. 500 CE): architecture, law, rhetoric, religion, military, daily life, art, literature",
  greek: "classical Greek culture (Archaic, Classical, and Hellenistic periods, up to c. 300 CE): philosophy, theater, art, religion, city-states, athletics, literature",
  french: "French literary and intellectual culture (high literature, Enlightenment salons, poetry, theater, philosophical movements — pre-1960)",
  german: "German literary and philosophical culture (Romanticism, idealist philosophy, Weimar, Sturm und Drang — pre-1960, NOT Nazi-era subject matter)",
  oldenglish: "Anglo-Saxon / Early Medieval English culture (5th-11th century): monasteries, scriptoria, illuminated manuscripts, heroic poetry, halls, law codes, Alfredian court",
};

function systemPrompt(langKey) {
  const focus = CULTURE_PROMPTS[langKey];
  return `You write short cultural vignettes for Kalopaideia, a site teaching the classical languages.

Today's vignette concerns ${langKey}: ${focus}.

Write a compact, elegant cultural note that would accompany today's word-of-the-day. The vignette should open a small window into the culture that produced this word — a person, a practice, an artifact, an institution, a moment — told with specifics, not generalities. Not an encyclopedia entry. A finely-drawn sketch.

Output a JSON object with these keys:
- "title": short title (4-8 words), no colons
- "body": 2-4 paragraphs of elegant prose, 80-150 words total
- "image_query": a 2-4 word search query for a relevant public-domain image (Wikimedia Commons)

HARD RULES:
- No slop, no adverbs in -ly, no em dashes, no filler openings
- Output ONLY valid JSON. No prose, no code fences.`;
}

async function generateVignette(langKey, entry) {
  try {
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt(langKey),
      messages: [{ role: "user", content: `Today's ${langKey} word: ${entry.word} (${entry.meaning}).\n\nWrite a cultural vignette connected to this word or its context. Output JSON only.` }],
    });
    let text = (r.content[0]?.text || "").trim();
    if (text.startsWith("```")) {
      text = text.split("\n").slice(1).join("\n");
      if (text.endsWith("```")) text = text.slice(0, text.lastIndexOf("```"));
      if (text.startsWith("json\n")) text = text.slice(5);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`[${langKey}] fail:`, e.message);
    return null;
  }
}

async function findImage(query) {
  if (!query) return null;
  try {
    const sr = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|mime|size|extmetadata`;
    const resp = await fetch(sr);
    const data = await resp.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      if (!/image\//.test(info.mime || "")) continue;
      const meta = info.extmetadata || {};
      const credit = meta.Artist?.value?.replace(/<[^>]+>/g, "") || meta.Credit?.value?.replace(/<[^>]+>/g, "") || "Wikimedia Commons";
      return {
        url: info.url,
        credit: `${p.title?.replace("File:", "")} — ${credit}`,
        width: info.width,
        height: info.height,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function processDate(date) {
  const wordsPath = path.join(ROOT, "data", "words", `${date}.json`);
  const culturePath = path.join(ROOT, "data", "culture", `${date}.json`);
  
  // Skip if culture already fully populated
  let existing = { vignettes: {} };
  try { existing = JSON.parse(await fs.readFile(culturePath, "utf8")); } catch {}
  
  const issue = JSON.parse(await fs.readFile(wordsPath, "utf8"));
  
  const out = {
    date,
    generated_at: existing.generated_at || new Date().toISOString(),
    backfilled_at: new Date().toISOString(),
    vignettes: { ...(existing.vignettes || {}) },
  };
  
  for (const [langKey, entry] of Object.entries(issue.languages || {})) {
    if (out.vignettes[langKey]) {
      console.log(`[${date}/${langKey}] existing, skip`);
      continue;
    }
    console.log(`[${date}/${langKey}] generating vignette for ${entry.word}...`);
    const v = await generateVignette(langKey, entry);
    if (!v) continue;
    const image = await findImage(v.image_query);
    out.vignettes[langKey] = {
      title: v.title,
      body: v.body,
      image,
      image_query: v.image_query,
    };
    console.log(`[${date}/${langKey}] ${v.title}${image ? " ✓" : " ✗"}`);
  }
  
  await fs.mkdir(path.dirname(culturePath), { recursive: true });
  await fs.writeFile(culturePath, JSON.stringify(out, null, 2));
}

async function main() {
  const dates = [];
  for (let d = 11; d <= 20; d++) dates.push(`2026-04-${String(d).padStart(2, "0")}`);
  for (const date of dates) {
    try {
      await processDate(date);
    } catch (e) {
      console.error(`FAIL ${date}:`, e.message);
    }
  }
  console.log("\n✅ Culture backfill done.");
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
