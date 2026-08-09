// Generate today's word for ONE language only and merge into existing today.json
// Used to backfill new languages without regenerating the whole edition.
// Usage: node pipeline/generate-onelang.js <langKey>
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "/home/jae/.openclaw/usage/usage_log.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = wrapAnthropic(new Anthropic(), { project: "kalopaideia", script: "generate-onelang" });
const MODEL = "claude-sonnet-4-5";

// Same LANGUAGES table as generate.js — kept in sync for the new entries.
const LANGUAGES = {
  middleenglish: {
    key: "middleenglish",
    display: "Middle English",
    focus: "Middle English literature (c. 1150-1500): Chaucer's Canterbury Tales and Troilus and Criseyde, the Pearl-poet (Sir Gawain and the Green Knight, Pearl, Patience, Cleanness), Langland's Piers Plowman, Julian of Norwich, Margery Kempe, Malory's Le Morte d'Arthur, Gower's Confessio Amantis. Use Chaucerian Middle English spelling (yogh, thorn, final -e where appropriate).",
    word_field_label: "Middle English word",
  },
  italian: {
    key: "italian",
    display: "Italian",
    focus: "Italian literature pre-1900: Dante's Commedia (Inferno, Purgatorio, Paradiso) and Vita Nuova; Petrarch's Canzoniere; Boccaccio's Decameron; Cavalcanti, Guinizelli, and the Dolce Stil Novo; Tasso's Gerusalemme Liberata; Ariosto's Orlando Furioso; Machiavelli; Castiglione; Leopardi; Manzoni's I Promessi Sposi; Foscolo; Carducci.",
    word_field_label: "Italian word",
  },
  welsh: {
    key: "welsh",
    display: "Welsh",
    focus: "Welsh literature, covering BOTH Middle Welsh (Pedair Cainc y Mabinogi, Y Gododdin, the court poets Cynddelw and Gwalchmai) and Modern Literary Welsh (Dafydd ap Gwilym's cywyddau, Tudur Aled, William Williams Pantycelyn, Goronwy Owen, T. H. Parry-Williams, R. Williams Parry, R. S. Thomas, Saunders Lewis, Kate Roberts, Waldo Williams). Use proper Welsh orthography: the digraphs ch, dd, ff, ll, ng, ph, rh, th count as single letters; w and y are vowels; circumflex âêîôûŵŷ marks long vowels in Modern Welsh. Words may be from either Middle or Modern Welsh; specify which in 'forms' or 'literary_context'.",
    word_field_label: "Welsh word",
  },
  oldnorse: {
    key: "oldnorse",
    display: "Old Norse",
    focus: "Old Norse literature, primarily Old Icelandic of c. 1150-1350: the Poetic Edda (Vǫluspá, Hávamál, Skírnismál, etc.), Snorri Sturluson's Prose Edda and Heimskringla, the Family Sagas (Brennu-Njáls saga, Egils saga, Laxdœla saga, Grænlendinga saga, Eiríks saga rauða, Gunnlaugs saga, Hrafnkels saga), and skaldic verse (Egill Skallagrímsson, Sigvatr Þórðarson). Use proper Old Icelandic orthography with þ ð æ ø ǫ and accented vowels (á é í ó ú ý) marking length. May occasionally feature a runic Proto-Norse form (Older Futhark) where philologically rich; mark this in 'forms' or 'literary_context'.",
    word_field_label: "Old Norse word",
  },
};

function systemPromptFor(lang) {
  return `You are the senior editor of Kalopaideia, a site teaching the classical languages. You write a daily word post in ${lang.display}.

Draw from: ${lang.focus}.

You must output a JSON object with these exact keys:
- "word": the headword (use proper diacritics; for Middle English use thorn/yogh as appropriate).
- "transliteration": a Latin-alphabet romanization if the script is non-Latin (empty string for Italian and Middle English).
- "pronunciation": an approximate English-phonetic pronunciation guide (e.g., "DAN-teh", "KNEE-ket").
- "ipa": IPA transcription for the word.
- "part_of_speech": single word or short phrase ("noun, masc.", "verb, strong III", etc.).
- "meaning": one-line English gloss.
- "forms": inflection/conjugation info for this language (short, readable).
- "etymology": root and origin, tracing to earlier forms when relevant.
- "literary_context": one or two sentences naming a specific literary appearance of this word, with the author and work (and canto/line/page when known).
- "usage_example": a short phrase or sentence in the language showing the word in use, plus its English translation. Format: "Original sentence. \u2014 English translation." (use the em-dash U+2014 between the original and the translation, with one space on each side).
- "did_you_know": one interesting historical, etymological, or literary detail (1-2 sentences).

HARD RULES:
- Choose a word that is NOT one of the most common 50 words in this language. It should be educational - something a serious student would want to learn, not a beginner basic.
- For Italian: pick a word that rewards reading Dante or Petrarch. For Middle English: pick a word that rewards reading Chaucer or the Pearl-poet.
- No slop: no adverbs in -ly, no em dashes, no "in today's world," no filler. Plain precise English.
- Output ONLY valid JSON. No prose before or after. No code fences.
- Use ASCII straight quotes in the JSON structure. Diacritics, accents, and special letters are REQUIRED inside string values.`;
}

async function generateOne(lang, usedWords) {
  const recent = usedWords.length ? `\n\nAvoid these recently-used words:\n${usedWords.join(", ")}` : "";
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPromptFor(lang),
    messages: [{ role: "user", content: `Generate today's ${lang.display} word for Kalopaideia.${recent}\n\nOutput JSON only.` }],
  });
  const raw = response.content[0]?.text || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { ...parsed, tokens: response.usage };
  } catch (err) {
    console.error(`[${lang.key}] JSON parse failed:`, err.message);
    console.error(`[${lang.key}] raw:`, raw.slice(0, 300));
    return null;
  }
}

async function loadUsedWords(langKey) {
  const usedPath = path.join(ROOT, "data", "used", `${langKey}.json`);
  try {
    const raw = await fs.readFile(usedPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveUsedWords(langKey, words) {
  const usedDir = path.join(ROOT, "data", "used");
  await fs.mkdir(usedDir, { recursive: true });
  await fs.writeFile(path.join(usedDir, `${langKey}.json`), JSON.stringify(words, null, 2));
}

async function main() {
  const langKey = process.argv[2];
  if (!langKey || !LANGUAGES[langKey]) {
    console.error(`Usage: node generate-onelang.js <${Object.keys(LANGUAGES).join("|")}>`);
    process.exit(1);
  }
  const lang = LANGUAGES[langKey];
  console.log(`[${lang.key}] generating today's word...`);
  const used = await loadUsedWords(lang.key);
  const entry = await generateOne(lang, used.slice(-40));
  if (!entry) {
    console.error(`[${lang.key}] generation failed`);
    process.exit(1);
  }
  // Merge into today.json and today's archive file
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = path.join(ROOT, "data", "today.json");
  const archivePath = path.join(ROOT, "data", "words", `${today}.json`);

  for (const target of [todayPath, archivePath]) {
    let issue;
    try {
      issue = JSON.parse(await fs.readFile(target, "utf8"));
    } catch {
      issue = { date: today, generated_at: new Date().toISOString(), languages: {} };
    }
    if (!issue.languages) issue.languages = {};
    issue.languages[lang.key] = { ...entry, display: lang.display };
    await fs.writeFile(target, JSON.stringify(issue, null, 2));
  }

  const recent = [...used, entry.word].slice(-200);
  await saveUsedWords(lang.key, recent);
  console.log(`[${lang.key}] ${entry.word} - ${entry.meaning}`);
  console.log(`  written to today.json and ${today}.json`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
