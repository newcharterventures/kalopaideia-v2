// Generate one day's word + thread for each of the 5 languages.
// Writes data/words/YYYY-MM-DD.json
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "/home/jae/.openclaw/usage/usage_log.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = wrapAnthropic(new Anthropic(), { project: "kalopaideia", script: "generate" });
const MODEL = "claude-sonnet-4-5";

// Canonical language order per Jae 2026-05-09:
// Greek, Latin, French, German, Italian, Olde English, Middle English.
// The internal key for Olde English remains 'oldenglish' to preserve archive
// continuity (existing data files, used-word registry, library entries).
const LANGUAGES = [
  {
    key: "greek",
    display: "Ancient Greek",
    focus: "Classical Greek literature and philosophy (Homer, Hesiod, Herodotus, Thucydides, Plato, Aristotle, Sophocles, Euripides, Aeschylus, Plutarch)",
    word_field_label: "Greek word (with accents)",
  },
  {
    key: "latin",
    display: "Latin",
    focus: "Classical Latin literature and rhetoric (Cicero, Virgil, Ovid, Horace, Tacitus, Seneca, Lucretius, Caesar, Catullus, Juvenal)",
    word_field_label: "Latin word",
  },
  {
    key: "french",
    display: "French",
    focus: "French literature pre-1960 (Molière, Racine, Hugo, Baudelaire, Flaubert, Zola, Proust, Mallarmé, Rimbaud)",
    word_field_label: "French word",
  },
  {
    key: "german",
    display: "German",
    focus: "German literature and philosophy pre-1960 (Goethe, Schiller, Hölderlin, Rilke, Thomas Mann, and philosophers Kant, Hegel, Schopenhauer, Nietzsche, Heidegger)",
    word_field_label: "German word",
  },
  {
    key: "italian",
    display: "Italian",
    focus: "Italian literature pre-1900: Dante's Commedia (Inferno, Purgatorio, Paradiso) and Vita Nuova; Petrarch's Canzoniere; Boccaccio's Decameron; Cavalcanti, Guinizelli, and the Dolce Stil Novo; Tasso's Gerusalemme Liberata; Ariosto's Orlando Furioso; Machiavelli; Castiglione; Leopardi; Manzoni's I Promessi Sposi; Foscolo; Carducci.",
    word_field_label: "Italian word",
  },
  {
    key: "oldenglish",
    display: "Olde English",
    focus: "Olde English (Anglo-Saxon) literature: Beowulf, Anglo-Saxon Chronicle, Cynewulf, Caedmon, The Wanderer, The Seafarer, The Dream of the Rood, Exeter Riddles, Alfred's translations",
    word_field_label: "Olde English word",
  },
  {
    key: "middleenglish",
    display: "Middle English",
    focus: "Middle English literature (c. 1150\u20131500): Chaucer's Canterbury Tales and Troilus and Criseyde, the Pearl-poet (Sir Gawain and the Green Knight, Pearl, Patience, Cleanness), Langland's Piers Plowman, Julian of Norwich, Margery Kempe, Malory's Le Morte d'Arthur, Gower's Confessio Amantis, Hoccleve, Lydgate. Use Chaucerian Middle English spelling (yogh, thorn, final \u2010e where appropriate).",
    word_field_label: "Middle English word",
  },
  {
    key: "welsh",
    display: "Welsh",
    focus: "Welsh literature, covering BOTH Middle Welsh (Pedair Cainc y Mabinogi, Y Gododdin, the court poets Cynddelw and Gwalchmai) and Modern Literary Welsh (Dafydd ap Gwilym's cywyddau, Tudur Aled, William Williams Pantycelyn, Goronwy Owen, T. H. Parry-Williams, R. Williams Parry, R. S. Thomas, Saunders Lewis, Kate Roberts, Waldo Williams). Use proper Welsh orthography: the digraphs ch, dd, ff, ll, ng, ph, rh, th count as single letters; w and y are vowels; circumflex âêîôûŵŷ marks long vowels in Modern Welsh. Words may be from either Middle or Modern Welsh; specify which in 'forms' or 'literary_context'.",
    word_field_label: "Welsh word",
  },
  {
    key: "oldnorse",
    display: "Old Norse",
    focus: "Old Norse literature, primarily Old Icelandic of c. 1150\u20131350: the Poetic Edda (Vǫluspá, Hávamál, Skírnismál, etc.), Snorri Sturluson's Prose Edda and Heimskringla, the Family Sagas (Brennu-Njáls saga, Egils saga, Laxdœla saga, Grænlendinga saga, Eiríks saga rauða, Gunnlaugs saga, Hrafnkels saga), and skaldic verse (Egill Skallagrímsson, Sigvatr Þórðarson). Use proper Old Icelandic orthography with þ ð æ ø ǫ and accented vowels (\u00e1 \u00e9 \u00ed \u00f3 \u00fa \u00fd) marking length. May occasionally feature a runic Proto-Norse form (Older Futhark) where philologically rich; mark this in 'forms' or 'literary_context'.",
    word_field_label: "Old Norse word",
  },
];

function systemPromptFor(lang) {
  return `You are the senior editor of Kalopaideia, a site teaching the classical languages. You write a daily word post in ${lang.display}.

Draw from: ${lang.focus}.

You must output a JSON object with these exact keys:

# Identity (legacy fields, keep)
- "word": the headword (use proper diacritics; for Greek use polytonic accents; for Olde English use thorn/eth/ash as in Beowulf).
- "transliteration": a Latin-alphabet romanization if the script is non-Latin (empty string for languages using Latin alphabet).
- "pronunciation": an approximate English-phonetic pronunciation guide (e.g., "roh-MAH-nus").
- "ipa": IPA transcription for the word.
- "part_of_speech": single word or short phrase ("noun, masc.", "verb, 1st conj.", etc.).
- "meaning": one-line English gloss (short, the quick-glance definition).
- "forms": inflection/conjugation info for this language (short, readable).
- "etymology": root and origin, tracing to earlier forms when relevant.
- "literary_context": one or two sentences naming a specific classical/literary appearance of this word, with the author/work.
- "usage_example": a short phrase or sentence in the language showing the word in use, plus its English translation — format: "Original. — English translation."
- "did_you_know": one interesting historical, etymological, or literary detail (1-2 sentences).

# V2 schema (Jae 2026-05-20): the richer fields the new homepage layout shows.
# These are REQUIRED additions — they drive the two-panel reading experience.

- "register": ARRAY of 2–4 short register tags in caps (e.g. ["HOMERIC", "CLASSICAL", "LATE ANTIQUE"], or for Latin ["AUGUSTAN", "SILVER", "ECCLESIASTICAL"]). Tags describe the historical/stylistic periods or registers in which the word lives. For modern languages, use sensible analogues (e.g. French: ["CLASSICAL", "ROMANTIC", "MODERN"]; German: ["GOETHEAN", "PHILOSOPHICAL", "MODERN"]).

- "quick_gloss": ONE italic sentence that captures the word's essential weight — the kind of line a great editor would set in italics above a long entry. Longer and more atmospheric than "meaning"; typically 18–40 words.

- "definition_shades": ARRAY of 2–4 distinct senses of the word, in numbered Roman order I, II, III, IV. Each shade is an object with two keys: "head" (a short bold heading naming the sense, like "Breath. Spirit. Life.") and "body" (a paragraph of 2–4 sentences explaining the sense with at least one literary or historical example).

- "cognates": ARRAY of 6–10 objects, each with three keys — "language" (the language name as a short label like "Greek", "Latin", "Sanskrit", "Italian", "French", "German", "Olde English", "Middle English", "Old Norse", "Lithuanian"), "word" (the cognate word in that language's native script with diacritics), and "gloss" (a 2–6 word English gloss). Trace the headword's Proto-Indo-European or other parent-root strand across as many of Kalopaideia's living traditions as fits honestly. Include the headword's own language as the first row. Do not invent cognates; if a true cognate doesn't exist for a language, omit that row rather than fake one.

- "etymology_root": ONE short string naming the deepest root with its asterisk and gloss (e.g. "PIE *dʰewh₂- (to smoke, to rise as vapour)"). This is the row above the cognate grid.

- "etymology_caption": ONE short editorial line below the cognate grid summarising what the cognates show (e.g. "Across two and a half thousand years, the same root names the smoke that rises and the soul that rises with it.").

- "citation": an object with three keys for the In Literature section — "source" (a short citation header like "Homer · Iliad I. 192–194"), "original" (the passage in the headword's native script, 2–4 lines, with proper diacritics), and "english" (a parallel English translation matching line-by-line). The site renders these side-by-side or toggled.

- "citation_note": ONE sentence below the citation explaining the moment (e.g. "Achilles deliberates whether to slay Agamemnon. The hero's reason and his θυμός are named in the same breath; both are at the table.").

- "commonplace": ARRAY of 2–3 paragraphs forming an editorial reflection on the word, signed by an unnamed editor. This is the IV. section of the page — a meditative essay that situates the word in lived experience and in the literary tradition. The first paragraph should open with a strong word; the site will set its first letter as a drop-cap. 250–400 words total. Voice: meditative, learned, unhurried; no slop, no cliché.

- "daily_practice": ONE italic prompt of 2–4 sentences inviting the reader to attend to the word in their day. Concrete, embodied, philosophical. Example: "Where, in your body, do you feel your θυμός today? Notice it without naming. Then write three lines describing the room around you, as though your breath were the witness."

HARD RULES:
- Choose a word that is NOT one of the most common 50 words in this language. It should be educational — something a serious student would want to learn, not a beginner basic.
- For today's selection, try to pick a word connected to a theme or work that rewards attention.
- No slop: no adverbs in -ly, no em dashes, no "in today's world," no filler. Plain precise English.
- The cognate strand must be philologically honest. Better to list 6 true cognates than 10 with a fake.
- Output ONLY valid JSON. No prose before or after. No code fences.
- Use ASCII straight quotes in the JSON structure. Diacritics, accents, and special letters in Greek/Olde English/etc. are REQUIRED inside string values.`;
}

async function generateOne(lang, usedWords) {
  const recent = usedWords.length ? `\n\nAvoid these recently-used words:\n${usedWords.join(", ")}` : "";
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
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
  const today = new Date().toISOString().slice(0, 10);
  const out = { date: today, generated_at: new Date().toISOString(), languages: {} };

  for (const lang of LANGUAGES) {
    console.log(`[${lang.key}] generating...`);
    const used = await loadUsedWords(lang.key);
    const entry = await generateOne(lang, used.slice(-40));
    if (!entry) {
      console.error(`[${lang.key}] skipped (generation failed)`);
      continue;
    }
    out.languages[lang.key] = {
      ...entry,
      display: lang.display,
    };
    // Record used word
    const recent = [...used, entry.word].slice(-200);
    await saveUsedWords(lang.key, recent);
    console.log(`[${lang.key}] ${entry.word} — ${entry.meaning}`);
  }

  await fs.mkdir(path.join(ROOT, "data", "words"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "data", "words", `${today}.json`), JSON.stringify(out, null, 2));
  // today.json symlink/convenience
  await fs.writeFile(path.join(ROOT, "data", "today.json"), JSON.stringify(out, null, 2));

  console.log(`\n✅ Kalopaideia words for ${today} written.`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
