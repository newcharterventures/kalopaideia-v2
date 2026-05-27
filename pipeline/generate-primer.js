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
  {
    key: "gaulish",
    display: "Gaulish",
    system: `You are writing a college-level primer on Gaulish (the Continental Celtic language of pre-Roman and early-Roman Gaul) for an educated adult learner. The corpus survives in roughly 800 inscriptions on stone, lead curse tablets (Chamalières, L'Hospitalet-du-Larzac), pottery (Lezoux plate, Banassac), coins, and the Coligny calendar. Three writing systems were used: a Greek-derived alphabet in southern Gaul (Lugano script), an Etruscan-derived alphabet in northern Italy (Lepontic, sometimes treated separately), and the Latin alphabet under Roman influence. Your reference standards are Pierre-Yves Lambert, La langue gauloise (1994/2003); Xavier Delamarre, Dictionnaire de la langue gauloise (2003); and the Recueil des inscriptions gauloises (RIG, 1985–). Acknowledge openly where the language is reconstructed and where epigraphic evidence is direct; never overstate certainty. Cover the principal alphabets, the case system (six cases attested: nominative, vocative, accusative, genitive, dative, instrumental), the verb system (deponent middle endings, the o-stem and ā-stem conjugations), and the lexicon's deep continuity with Old Irish, Welsh, and Brittonic. Be precise, scholarly, and forthright about gaps in the evidence.`,
  },
  {
    key: "welsh",
    display: "Welsh",
    system: `You are writing a college-level primer on Welsh for an educated adult learner, covering BOTH Middle Welsh (the language of the Mabinogion, c. 1100–1400) and Modern Literary Welsh (Dafydd ap Gwilym through Saunders Lewis and R. S. Thomas). Your reference standards are Simon Evans, A Grammar of Middle Welsh (1964); Stephen J. Williams, A Welsh Grammar (1980); and Gareth King, Modern Welsh: A Comprehensive Grammar (2003). Cover with depth: the Welsh alphabet (28 letters including the digraphs ch, dd, ff, ng, ll, ph, rh, th, treated as single letters; the absence of k, q, v, x, z in native words; w and y as full vowels); the four initial consonant mutations (soft/lenition, nasal, aspirate/spirant, mixed) with examples of each; VSO word order; the periphrastic verb system using bod ("to be") + verbal noun; the synthetic/literary verb conjugations preserved in formal registers; the genitive construction by simple juxtaposition (without of); the dual literary tradition of cynghanedd (the strict-meter prosodic system) and free-meter modern verse. Where Middle Welsh and Modern Welsh diverge, note both forms. Be precise and scholarly.`,
  },
  {
    key: "oldnorse",
    display: "Old Norse",
    system: `You are writing a college-level primer on Old Norse for an educated adult learner. The primary register is Classical/Old Icelandic, the saga-language of c. 1150–1350 (Snörri Sturluson, the Family Sagas, the Poetic Edda); also cover the earlier runic Proto-Norse / Older Futhark stage (c. 200–700, e.g. the Tune stone, Järsberg stone) as a distinct earlier phase. Your reference standards are E. V. Gordon, An Introduction to Old Norse (2nd ed. 1957, rev. Taylor); Michael Barnes, A New Introduction to Old Norse (2007); and Stefan Einarsson's Icelandic Grammar (1949). Cover with depth: the Old Icelandic Latin alphabet (with þ thorn, ð eth, æ ash, ø / ǫ, accented vowels marking length); the Younger Futhark and Older Futhark runic alphabets as separate sections; the four-case system (nominative, accusative, dative, genitive) with three genders; the strong and weak verb classes (Class I-VII strong verbs with ablaut patterns; weak verbs in -a, -i, -ða); the middle voice in -sk/-st; u-umlaut and i-umlaut as living phonological processes; the rich pronominal system. Be precise and scholarly.`,
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
