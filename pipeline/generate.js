// Generate one day's word + thread for each of the 5 languages.
// Writes data/words/YYYY-MM-DD.json
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropic } from "/home/jae/.openclaw/usage/usage_log.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const client = wrapAnthropic(new Anthropic(), { project: "paideia", script: "generate" });
const MODEL = "claude-sonnet-4-5";

const LANGUAGES = [
  {
    key: "latin",
    display: "Latin",
    focus: "Classical Latin literature and rhetoric (Cicero, Virgil, Ovid, Horace, Tacitus, Seneca, Lucretius, Caesar, Catullus, Juvenal)",
    word_field_label: "Latin word",
  },
  {
    key: "greek",
    display: "Ancient Greek",
    focus: "Classical Greek literature and philosophy (Homer, Hesiod, Herodotus, Thucydides, Plato, Aristotle, Sophocles, Euripides, Aeschylus, Plutarch)",
    word_field_label: "Greek word (with accents)",
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
    key: "oldenglish",
    display: "Old English",
    focus: "Old English (Anglo-Saxon) literature: Beowulf, Anglo-Saxon Chronicle, Cynewulf, Caedmon, The Wanderer, The Seafarer, The Dream of the Rood, Exeter Riddles, Alfred's translations",
    word_field_label: "Old English word",
  },
];

function systemPromptFor(lang) {
  return `You are the senior editor of Paideia, a site teaching the classical languages. You write a daily word post in ${lang.display}.

Draw from: ${lang.focus}.

You must output a JSON object with these exact keys:
- "word": the headword (use proper diacritics; for Greek use polytonic accents; for Old English use thorn/eth/ash as in Beowulf).
- "transliteration": a Latin-alphabet romanization if the script is non-Latin (empty string for languages using Latin alphabet).
- "pronunciation": an approximate English-phonetic pronunciation guide (e.g., "roh-MAH-nus").
- "ipa": IPA transcription for the word.
- "part_of_speech": single word or short phrase ("noun, masc.", "verb, 1st conj.", etc.).
- "meaning": one-line English gloss.
- "forms": inflection/conjugation info for this language (short, readable).
- "etymology": root and origin, tracing to earlier forms when relevant.
- "literary_context": one or two sentences naming a specific classical/literary appearance of this word, with the author/work.
- "usage_example": a short phrase or sentence in the language showing the word in use, plus its English translation — format: "Original. — English translation."
- "did_you_know": one interesting historical, etymological, or literary detail (1-2 sentences).

HARD RULES:
- Choose a word that is NOT one of the most common 50 words in this language. It should be educational — something a serious student would want to learn, not a beginner basic.
- For today's selection, try to pick a word connected to a theme or work that rewards attention.
- No slop: no adverbs in -ly, no em dashes, no "in today's world," no filler. Plain precise English.
- Output ONLY valid JSON. No prose before or after. No code fences.
- Use ASCII straight quotes in the JSON structure. Diacritics, accents, and special letters in Greek/Old English/etc. are REQUIRED inside string values.`;
}

async function generateOne(lang, usedWords) {
  const recent = usedWords.length ? `\n\nAvoid these recently-used words:\n${usedWords.join(", ")}` : "";
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPromptFor(lang),
    messages: [{ role: "user", content: `Generate today's ${lang.display} word for Paideia.${recent}\n\nOutput JSON only.` }],
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

  console.log(`\n✅ Paideia words for ${today} written.`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
