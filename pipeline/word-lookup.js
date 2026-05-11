// Word lookup service — on-demand dictionary entries.
// Strategy:
// 1. Check local cache (data/wordcache/<lang>/<word>.json).
// 2. Query Wiktionary API (free, no auth).
// 3. If ambiguous or empty, fall back to Claude with short context.
// 4. Cache forever.

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "data", "wordcache");

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5";

// Wiktionary language code per language
const WIKT_LANG = {
  latin: "Latin",
  greek: "Ancient_Greek",
  french: "French",
  german: "German",
  oldenglish: "Old_English",
  middleenglish: "Middle_English",
  italian: "Italian",
  // Phase 2 additions (Jae 2026-05-11):
  welsh: "Welsh",
  oldnorse: "Old_Norse",
  gaulish: "Gaulish",
};

function slug(s) {
  return s.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0370-\u03FF\u1E00-\u1EFF\u00DF\u00DE\u00F0\u00E6\u01BF\u021C\u021D]/g, "_").slice(0, 60);
}

function cleanWord(raw) {
  // Strip punctuation, keep letters (including diacritics and non-Latin scripts)
  return (raw || "").replace(/[.,;:!?"()\[\]«»"""'']/g, "").trim();
}

async function tryReadCache(lang, word) {
  try {
    const p = path.join(CACHE_DIR, lang, `${slug(word)}.json`);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch { return null; }
}

async function writeCache(lang, word, entry) {
  const dir = path.join(CACHE_DIR, lang);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${slug(word)}.json`), JSON.stringify(entry, null, 2));
}

async function queryWiktionary(lang, word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return null;
    const data = await res.json();
    const langKey = WIKT_LANG[lang] || lang;
    const entries = data[langKey] || data[Object.keys(data)[0]] || [];
    if (!entries.length) return null;
    // Return first definition
    const def = entries[0];
    return {
      source: "wiktionary",
      part_of_speech: def.partOfSpeech,
      definitions: (def.definitions || []).slice(0, 3).map((d) => ({
        text: stripHtml(d.definition || ""),
        examples: (d.examples || []).slice(0, 1).map(stripHtml),
      })),
    };
  } catch { return null; }
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

const SYSTEM_CLAUDE = `You are a classicist. Given a word from a classical or historical language and a brief context from the source text, produce a concise dictionary-style entry.

Output JSON with these keys:
- "lemma": the base form / dictionary form of the word
- "part_of_speech": noun / verb / adjective / etc., with gender and declension/conjugation when relevant
- "form": the specific form in context (e.g., "genitive singular", "3rd person singular aorist indicative")
- "meaning": primary English gloss, one line
- "etymology": brief origin note (one sentence), if relevant
- "in_context": one sentence on how the word functions in the given line

HARD RULES:
- Output ONLY valid JSON. No prose, no code fences.
- Use ASCII quotes for JSON structure.
- No speculation. If uncertain, say "uncertain" in the relevant field.`;

async function queryClaude(lang, word, contextLine, contextEnglish) {
  const prompt = `Word: ${word}\nLanguage: ${lang}\nLine in original: ${contextLine}\nLine in English: ${contextEnglish}\n\nProduce the dictionary entry for ${word} as JSON.`;
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_CLAUDE,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.content[0]?.text || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    parsed.source = "claude";
    return parsed;
  } catch {
    return null;
  }
}

// Pattern for Wiktionary definitions that are inflection pointers.
// e.g. "accusative singular of ἀνήρ", "third-person singular present indicative of ποιέω".
// Uses Unicode property escape plus combining marks so we capture full words with diacritics.
const INFLECTION_POINTER = /\b(?:of|from)\s+([\p{L}\p{M}]+)/u;

function isOnlyInflectionPointer(entry) {
  if (!entry || !entry.definitions || entry.definitions.length === 0) return false;
  return entry.definitions.every((d) => {
    const t = (d.text || "").toLowerCase();
    return /\b(accusative|nominative|genitive|dative|vocative|ablative|locative|instrumental|singular|plural|dual|present|imperfect|future|aorist|perfect|pluperfect|imperative|subjunctive|optative|indicative|infinitive|participle|masculine|feminine|neuter|active|passive|middle|first[- ]person|second[- ]person|third[- ]person)\b/.test(t) &&
      INFLECTION_POINTER.test(d.text || "");
  });
}

function extractLemmaFromPointer(text) {
  const m = (text || "").match(/\b(?:of|from)\s+([\p{L}\p{M}]+)/u);
  if (!m) return null;
  // Strip combining marks for Wiktionary URL (it stores lemmas without macron/breve marks)
  let lemma = m[1];
  // Normalize: remove combining diacritical marks that Wiktionary doesn't use in URLs
  lemma = lemma.normalize("NFD").replace(/[\u0304\u0306]/g, "").normalize("NFC");
  return lemma;
}

export async function lookupWord(lang, rawWord, contextLine, contextEnglish) {
  const word = cleanWord(rawWord);
  if (!word) return null;
  if (!WIKT_LANG[lang]) return null;

  // Cache hit
  const cached = await tryReadCache(lang, word);
  if (cached) return cached;

  // Try Wiktionary first
  let entry = await queryWiktionary(lang, word);

  // If Wiktionary definition is only an inflection pointer, chase the lemma.
  if (entry && isOnlyInflectionPointer(entry)) {
    const lemma = extractLemmaFromPointer(entry.definitions[0]?.text || "");
    if (lemma && lemma !== word) {
      const lemmaEntry = await queryWiktionary(lang, lemma);
      if (lemmaEntry && lemmaEntry.definitions && lemmaEntry.definitions.length > 0) {
        // Keep the original inflection pointer as a form note, and append the lemma's meanings.
        entry = {
          source: "wiktionary",
          part_of_speech: entry.part_of_speech || lemmaEntry.part_of_speech,
          form: entry.definitions[0].text,
          lemma,
          definitions: lemmaEntry.definitions,
        };
      }
    }
  }

  // If still empty, fall back to Claude with context
  if (!entry || !entry.definitions || entry.definitions.length === 0) {
    const claudeEntry = await queryClaude(lang, word, contextLine || "", contextEnglish || "");
    if (claudeEntry) entry = claudeEntry;
  }

  if (!entry) return null;

  // Cache and return
  await writeCache(lang, word, entry);
  return entry;
}
