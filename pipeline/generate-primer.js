// One-time generator for the static primer content per language.
// Outputs data/primer/<langKey>.json — referenced by section pages.
// Re-run only when you want to refresh. Output is checked into data/primer/.

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

const LANGUAGES = [
  {
    key: "latin",
    display: "Latin",
    system: `You are writing a college-level primer on Classical Latin for an educated adult learner. Your reference standard is the Oxford Latin grammar and Wheelock's Latin. Be precise, concise, and scholarly. No filler.`,
  },
  {
    key: "greek",
    display: "Ancient Greek",
    system: `You are writing a college-level primer on Classical/Attic Greek for an educated adult learner. Your reference standard is Hansen & Quinn's "Greek: An Intensive Course" and Smyth's Grammar. Cover polytonic accents. Be precise and scholarly.`,
  },
  {
    key: "french",
    display: "French",
    system: `You are writing a college-level primer on French for an educated adult learner, oriented toward reading literary French (Molière through Proust). Cover phonetics distinctive to French (nasals, liaison, accents). Be precise and scholarly.`,
  },
  {
    key: "german",
    display: "German",
    system: `You are writing a college-level primer on German for an educated adult learner, oriented toward reading literary and philosophical German (Goethe, Kant, Nietzsche). Cover phonetics distinctive to German (umlauts, sharp-S, sch/ch, case system). Be precise and scholarly.`,
  },
  {
    key: "oldenglish",
    display: "Old English",
    system: `You are writing a college-level primer on Old English (Anglo-Saxon) for an educated adult learner, oriented toward reading Beowulf and the Exeter Book. Cover special letters (thorn þ, eth ð, ash æ, yogh ȝ, wynn ƿ), the strong/weak verb system, and the case system. Your reference standard is Mitchell & Robinson's "A Guide to Old English." Be precise and scholarly.`,
  },
];

const PROMPT = `Produce a JSON object with these keys:

- "overview": 2-3 sentences introducing this language to a serious learner. What it is, who wrote in it, why study it.

- "alphabet": an array of objects, one per letter of the language's alphabet (or core character set). Each object has:
  {
    "char": "the letter as typed",
    "name": "the letter's name",
    "ipa": "IPA transcription of its typical pronunciation",
    "approximation": "short English approximation (e.g., 'like the a in father')",
    "notes": "any essential note (length, position-dependent variation, digraphs). Empty string if none."
  }
  Include uppercase/lowercase only when meaningful. For Greek, include polytonic diacritics as a separate final entry titled "Accents & breathings" with "char":"◌́ ◌̀ ◌̂ ◌̓ ◌̔" and thorough explanation. For German, include ä ö ü and ß. For Old English, include þ ð æ ƿ (wynn) and ȝ (yogh).

- "pronunciation_notes": an array of 3-6 short bullet-style strings covering the most important pronunciation rules a learner must know upfront (e.g., for Latin: "ae is a diphthong pronounced like 'eye'", for French: "final consonants are usually silent"). Plain English.

- "grammar": an object with keys:
  - "noun_system": 2-3 sentences describing the noun/case system if any, naming the cases.
  - "declensions": for Latin/Greek/Old English/German, an array of declension tables. Each table has {"name", "description", "paradigm": {"sg": {"nom":"...","gen":"...",...}, "pl": {...}}}. For French, substitute a short paragraph on noun gender and articles. Include at least the first 2 most important declensions. Use a concrete example noun.
  - "verb_system": 2-3 sentences describing the verb system (tense/aspect/mood/voice).
  - "conjugations": array of conjugation tables: {"name", "description", "paradigm": {"present": {"1s":"...","2s":"...",...}, "imperfect": {...}, "perfect/preterite": {...}}}. Include at least 2 conjugations. Use a concrete example verb.

- "reading_list": an array of 6-10 short strings of canonical works to read in this language, in rough reading-difficulty order from easiest to hardest.

HARD RULES:
- Scholarly register. Plain precise English. No marketing copy.
- No em dashes. No adverbs ending in -ly (really, literally, etc.). No "in today's world."
- Output ONLY valid JSON. No prose before or after. No code fences.
- Use ASCII quotes in JSON structure; target-language diacritics/special characters are REQUIRED in string values (use proper Unicode).
- If a language lacks a feature (French has no cases), write a short explanatory paragraph for that key instead of forcing a table. Do not invent features.`;

async function generatePrimer(lang) {
  console.log(`[${lang.key}] generating primer...`);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: lang.system,
    messages: [{ role: "user", content: `Write the primer for ${lang.display} now.\n\n${PROMPT}` }],
  });
  const raw = response.content[0]?.text || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    parsed.display = lang.display;
    parsed.generated_at = new Date().toISOString();
    return parsed;
  } catch (err) {
    console.error(`[${lang.key}] JSON parse failed:`, err.message);
    console.error(`[${lang.key}] raw:`, raw.slice(0, 500));
    return null;
  }
}

async function main() {
  for (const lang of LANGUAGES) {
    const outPath = path.join(ROOT, "data", "primer", `${lang.key}.json`);
    // Skip if already generated (idempotent)
    try {
      await fs.access(outPath);
      console.log(`[${lang.key}] primer already exists, skipping`);
      continue;
    } catch {}
    const primer = await generatePrimer(lang);
    if (!primer) continue;
    await fs.writeFile(outPath, JSON.stringify(primer, null, 2));
    console.log(`[${lang.key}] wrote ${outPath}`);
  }
  console.log("\n✅ Primer generation complete.");
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
