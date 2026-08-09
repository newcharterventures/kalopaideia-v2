// Generate today's culture vignette for ONE language and merge into culture-today.json
// Usage: node pipeline/culture-onelang.js <langKey>
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "/home/jae/.openclaw/usage/usage_log.js";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = wrapAnthropic(new Anthropic(), { project: "kalopaideia", script: "culture-onelang" });
const MODEL = "claude-sonnet-4-5";

const CULTURE_PROMPTS = {
  middleenglish: "High and Late Medieval English culture (c. 1150-1500): Canterbury pilgrims, courtly love, alliterative revival, mystery plays, Lollardy and Wyclif's Bible, the Black Death's literary aftermath, manuscript illumination, the Pearl-poet's Cheshire, Chaucer's London, Malory's Arthurian compilations, anchorites, guild halls, Plantagenet court culture",
  italian: "Italian literary and artistic culture pre-1900: Florentine Trecento (Dante, Petrarch, Boccaccio), Sicilian School, Dolce Stil Novo, the Tuscan vernacular, Renaissance courts (Medici Florence, Este Ferrara, Gonzaga Mantua), Venetian printing (Aldus Manutius), Counter-Reformation Rome, the Risorgimento; not modern political/fascist subject matter",
};

function systemPrompt(langKey) {
  const focus = CULTURE_PROMPTS[langKey];
  return `You write short cultural vignettes for Kalopaideia, a site teaching the classical languages.

Today's vignette concerns ${langKey}: ${focus}.

Write a compact, elegant cultural note that would accompany today's word-of-the-day. The vignette should open a small window into the culture that produced this word - a person, a practice, an artifact, an institution, a moment - told with specifics, not generalities. Not an encyclopedia entry. A finely-drawn sketch.

Output a JSON object with these keys:
- "title": 4-8 words, naming the subject of the vignette.
- "image_query": a 2-5 word search query for Wikimedia Commons that would surface a representative public-domain image (e.g., "Dante portrait Botticelli", "Canterbury Tales manuscript Ellesmere").
- "body": 100-150 words, plain prose. One or two paragraphs. Concrete details, specific names, dates when known. Non-partisan, no modern politics.

HARD RULES:
- No slop: no -ly adverbs, no em dashes, no "in today's world," no filler.
- Output ONLY valid JSON. No prose before or after. No code fences.
- ASCII straight quotes in JSON structure.`;
}

async function fetchWikimediaImage(query) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=5&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280&origin=*`;
    const resp = await fetch(url, { headers: { "User-Agent": "Kalopaideia/1.0 (https://newcharterventures.com/paideia)" } });
    const j = await resp.json();
    if (!j.query?.pages) return null;
    const pages = Object.values(j.query.pages);
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const w = ii.thumbwidth || ii.width || 0;
      const h = ii.thumbheight || ii.height || 0;
      if (w < 600 || h < 400) continue;
      const license = (ii.extmetadata?.LicenseShortName?.value || "").toLowerCase();
      if (!/(public domain|cc0|cc.by)/i.test(license)) continue;
      const author = ii.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim() || "Unknown";
      return {
        url: ii.thumburl || ii.url,
        credit: `${author} / Wikimedia Commons (${ii.extmetadata?.LicenseShortName?.value || "Public domain"})`,
        source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        width: ii.thumbwidth || ii.width,
        height: ii.thumbheight || ii.height,
      };
    }
  } catch (e) {
    console.error("[image fetch] failed:", e.message);
  }
  return null;
}

async function main() {
  const langKey = process.argv[2];
  if (!langKey || !CULTURE_PROMPTS[langKey]) {
    console.error(`Usage: node culture-onelang.js <${Object.keys(CULTURE_PROMPTS).join("|")}>`);
    process.exit(1);
  }

  // Get the word entry to seed the vignette
  let wordEntry = null;
  try {
    const today = JSON.parse(await fs.readFile(path.join(ROOT, "data", "today.json"), "utf8"));
    wordEntry = today.languages?.[langKey];
  } catch {}
  const seed = wordEntry
    ? `\n\nToday's word in this language is: ${wordEntry.word} (${wordEntry.meaning}). Literary context: ${wordEntry.literary_context}\n\nThe vignette should pair thoughtfully with this word.`
    : "";

  console.log(`[${langKey}] generating culture vignette...`);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: systemPrompt(langKey),
    messages: [{ role: "user", content: `Write today's vignette for ${langKey}.${seed}\n\nOutput JSON only.` }],
  });
  const raw = response.content[0]?.text || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  let vignette;
  try {
    vignette = JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse failed:", raw.slice(0, 300));
    process.exit(1);
  }

  // Fetch Wikimedia image
  const image = await fetchWikimediaImage(vignette.image_query);
  vignette.image = image;

  // Merge into culture-today.json + culture/<date>.json
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = path.join(ROOT, "data", "culture-today.json");
  const archivePath = path.join(ROOT, "data", "culture", `${today}.json`);
  await fs.mkdir(path.join(ROOT, "data", "culture"), { recursive: true });

  for (const target of [todayPath, archivePath]) {
    let issue;
    try {
      issue = JSON.parse(await fs.readFile(target, "utf8"));
    } catch {
      issue = { date: today, generated_at: new Date().toISOString(), vignettes: {} };
    }
    if (!issue.vignettes) issue.vignettes = {};
    issue.vignettes[langKey] = vignette;
    await fs.writeFile(target, JSON.stringify(issue, null, 2));
  }

  console.log(`[${langKey}] ${vignette.title}`);
  console.log(`  image: ${image ? image.url.slice(0,80)+'...' : 'none'}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
