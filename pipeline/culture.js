// Generate daily cultural vignettes per language + fetch public-domain image from Wikimedia.
// Writes data/culture/YYYY-MM-DD.json
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "/home/jae/.openclaw/usage/usage_log.js";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = wrapAnthropic(new Anthropic(), { project: "paideia", script: "culture" });
const MODEL = "claude-sonnet-4-5";

const CULTURE_PROMPTS = {
  latin: "classical Roman culture (Republic and Empire, up to c. 500 CE): architecture, law, rhetoric, religion, military, daily life, art, literature",
  greek: "classical Greek culture (Archaic, Classical, and Hellenistic periods, up to c. 300 CE): philosophy, theater, art, religion, city-states, athletics, literature",
  french: "French literary and intellectual culture (high literature, Enlightenment salons, poetry, theater, philosophical movements — pre-1960)",
  german: "German literary and philosophical culture (Romanticism, idealist philosophy, Weimar, Sturm und Drang — pre-1960, NOT Nazi-era subject matter)",
  oldenglish: "Anglo-Saxon / Early Medieval English culture (5th-11th century): monasteries, scriptoria, illuminated manuscripts, heroic poetry, halls, law codes, Alfredian court",
  middleenglish: "High and Late Medieval English culture (c. 1150–1500): Canterbury pilgrims, courtly love, alliterative revival, mystery plays, Lollardy and Wyclif's Bible, the Black Death's literary aftermath, manuscript illumination, the Pearl-poet's Cheshire, Chaucer's London, Malory's Arthurian compilations, anchorites, guild halls, Plantagenet court culture",
  italian: "Italian literary and artistic culture pre-1900: Florentine Trecento (Dante, Petrarch, Boccaccio), Sicilian School, Dolce Stil Novo, the Tuscan vernacular, Renaissance courts (Medici Florence, Este Ferrara, Gonzaga Mantua), Venetian printing (Aldus Manutius), Counter-Reformation Rome, the Risorgimento; not modern political/fascist subject matter",
};

function systemPrompt(langKey) {
  const focus = CULTURE_PROMPTS[langKey];
  return `You write short cultural vignettes for Paideia, a site teaching the classical languages.

Today's vignette concerns ${langKey}: ${focus}.

Write a compact, elegant cultural note that would accompany today's word-of-the-day. The vignette should open a small window into the culture that produced this word — a person, a practice, an artifact, an institution, a moment — told with specifics, not generalities. Not an encyclopedia entry. A finely-drawn sketch.

Output a JSON object with these keys:
- "title": 4-8 words, naming the subject of the vignette.
- "image_query": a 2-5 word search query for Wikimedia Commons that would surface a representative public-domain image (e.g., "Roman Forum ruins", "Greek symposium krater", "Beowulf manuscript folio").
- "body": 100-150 words, plain prose. One or two paragraphs. Concrete details, specific names, dates when known. Non-partisan, no modern politics.

HARD RULES:
- No slop: no -ly adverbs, no em dashes, no "in today's world," no filler.
- Output ONLY valid JSON. No prose before or after. No code fences.
- ASCII straight quotes in JSON structure.`;
}

async function generateVignette(langKey, wordEntry) {
  const userMsg = `Today's ${langKey} word: ${wordEntry.word} (${wordEntry.meaning}). Literary context: ${wordEntry.literary_context || "(none given)"}.\n\nWrite today's cultural vignette. Connect loosely to the word if it fits, but feel free to pick any relevant subject from ${CULTURE_PROMPTS[langKey]}.\n\nOutput JSON only.`;
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: systemPrompt(langKey),
    messages: [{ role: "user", content: userMsg }],
  });
  const raw = response.content[0]?.text || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[culture/${langKey}] JSON parse failed:`, err.message);
    return null;
  }
}

// Wikimedia Commons image search.
// IMPORTANT: We only accept TRUE IMAGE source files. We reject document
// formats like .djvu / .pdf / .tiff because Wikimedia auto-renders the FIRST
// PAGE of those documents as a JPEG thumbnail (which is almost always the
// front cover, back cover, or library binding — never the illustration the
// reader expected). Per Jae 2026-04-30 16:05 UTC: today's Latin entry
// shipped a black book-cover from a DjVu page1 thumbnail.
async function findImage(query) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=15&origin=*`;
    const res = await fetch(searchUrl, { timeout: 10000 });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.query?.search || [];
    // STRICT image-only filter. Source filename must end in a real image
    // extension. NEVER fall through to documents.
    const imageExtensions = /\.(jpe?g|png|gif|webp|svg)$/i;
    const imageHits = hits.filter((h) => imageExtensions.test(h.title));
    for (const hit of imageHits) {
      const info = await getImageInfo(hit.title.replace(/^File:/, ""));
      if (info) return info;
    }
  } catch (err) {
    console.error("[culture/image] search failed:", err.message);
  }
  return null;
}

async function getImageInfo(filename) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=1200&origin=*`;
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    const info = page?.imageinfo?.[0];
    if (!info) return null;
    // Only accept actual image MIME types. Wikimedia auto-renders DjVu/PDF
    // pages to JPEG thumbnails, but the source MIME is image/vnd.djvu /
    // application/pdf — we reject those here as a second line of defense.
    if (info.mime && !/^image\//i.test(info.mime)) return null;
    if (info.mime && /(djvu|pdf|tiff|postscript)/i.test(info.mime)) return null;
    // Reject thumb URLs that come from a document source (filename contains
    // .djvu / .pdf / .tif before the .jpg suffix). Belt-and-suspenders.
    const thumbUrl = info.thumburl || info.url || "";
    if (/\.(djvu|pdf|tiff?)\b/i.test(thumbUrl)) return null;
    const meta = info.extmetadata || {};
    const author = (meta.Artist?.value || "Unknown").replace(/<[^>]+>/g, "").trim();
    const license = meta.LicenseShortName?.value || "CC";
    return {
      url: info.thumburl || info.url,
      credit: `${author} / Wikimedia Commons (${license})`,
      source_url: info.descriptionurl,
      width: info.thumbwidth || info.width,
      height: info.thumbheight || info.height,
    };
  } catch (err) {
    return null;
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = path.join(ROOT, "data", "today.json");
  const words = JSON.parse(await fs.readFile(todayPath, "utf8"));

  const out = { date: today, generated_at: new Date().toISOString(), vignettes: {} };

  for (const [langKey, entry] of Object.entries(words.languages || {})) {
    console.log(`[culture/${langKey}] generating vignette...`);
    const v = await generateVignette(langKey, entry);
    if (!v) { console.error(`[culture/${langKey}] skipped`); continue; }

    console.log(`[culture/${langKey}] finding image for: ${v.image_query}`);
    const image = await findImage(v.image_query);
    out.vignettes[langKey] = {
      title: v.title,
      body: v.body,
      image,
      image_query: v.image_query,
    };
    console.log(`[culture/${langKey}] ${v.title}${image ? " ✓ image" : " ✗ no image"}`);
  }

  await fs.mkdir(path.join(ROOT, "data", "culture"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "data", "culture", `${today}.json`), JSON.stringify(out, null, 2));
  await fs.writeFile(path.join(ROOT, "data", "culture-today.json"), JSON.stringify(out, null, 2));

  console.log(`\n✅ Cultural vignettes for ${today} written.`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
