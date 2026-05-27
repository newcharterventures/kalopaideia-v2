// Clean up bad per-line English fields on long works.
// 1. For any text with english_paragraphs, blank out all lines[].english
//    (the UI shows paragraph-level translation separately; per-line duplicates look broken).
// 2. For odyssey-book-1, also strip leading keyword-tag prefixes from paragraphs
//    (e.g. "Troy noos psukhê nostos Tell me, O Muse..." -> "Tell me, O Muse...").
//
// Usage: node clean-english.js <text-id> [<text-id> ...]

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LIB = path.join(ROOT, "data", "library");

// A "keyword prefix" is a run of short non-sentence tokens before the real
// English prose starts. Heuristic: strip leading tokens that are either
// capitalized proper-noun-ish single words (Troy, Ithaca, Pylos, Sparta,
// Olympus, Zacynthus, Ephyra, Laertes, Telemakhos) or all-lowercase Greek-
// transliterated concept words (noos, psukhê, nostos, aitioi, biê, kleos,
// dêmos, sêma, mantis, athloi) repeated in any order. Stop as soon as we hit
// a token that looks like real prose (quote, comma after a word, "Tell me",
// "So", "Now", "And", "Then", capitalized word followed by lowercase verb
// phrase, etc.).
function stripKeywordPrefix(para) {
  if (!para || typeof para !== "string") return para;

  // Known lowercase Greek concept/place tokens used as leading tags.
  // Only strip tokens that:
  //   - start with a lowercase letter (so proper names like "Athena", "Telemakhos" are safe)
  //   - OR are a known lowercase place/name that was pre-lowercased as a tag.
  // Capitalized tokens are always treated as sentence words and stop the strip.
  const LOWERCASE_TAG_WORDS = new Set([
    // concepts
    "noos", "psukhe", "psukhê", "nostos", "nostoi", "aitioi", "aitios",
    "bie", "biê", "kleos", "demos", "dêmos", "sema", "sêma", "mantis",
    "athloi", "athlos", "moira", "xenia", "hubris", "themis", "arete",
    "aretê", "tisis", "metis", "mêtis", "kudos", "timê", "time",
    "penthos", "nemesis",
  ]);
  // Capitalized tag tokens (places/ethnonyms) only stripped when followed by another
  // tag token, never when they start real prose.
  const CAPITALIZED_TAG_WORDS = new Set([
    "Troy", "Ithaca", "Pylos", "Sparta", "Olympus", "Zacynthus", "Ephyra",
    "Hellas", "Argos",
    // names often tagged (appear mid-list only, never as narrative subjects here)
    "Laertes",
  ]);

  // Tokenize on whitespace for the leading span only.
  const tokens = para.split(/(\s+)/); // keep whitespace for reassembly

  // First pass: find the maximal run of tag tokens at the start.
  // Walk tokens, recording tag matches. A capitalized-tag is accepted only if
  // there's another tag token (lowercase or capitalized) after it; otherwise
  // it might be the start of real prose (e.g. "Troy was ...").
  const nonWsIdx = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!/^\s+$/.test(tokens[i])) nonWsIdx.push(i);
  }

  // Classify each non-whitespace token at the head.
  const classes = []; // "lower-tag" | "cap-tag" | "other"
  for (const i of nonWsIdx) {
    const raw = tokens[i];
    const stripped = raw.replace(/[.,;:!?"']+$/, "");
    if (/^[a-zêâôûîáéíóúàèìòù]/.test(stripped) && LOWERCASE_TAG_WORDS.has(stripped.toLowerCase())) {
      classes.push("lower-tag");
    } else if (CAPITALIZED_TAG_WORDS.has(stripped)) {
      classes.push("cap-tag");
    } else {
      classes.push("other");
      break; // stop scanning after first non-tag
    }
  }

  let tagCount = classes.filter((c) => c !== "other").length;
  if (tagCount === 0) return para;

  // Decide whether the leading run is actually a tag run vs real prose.
  // Look at the FIRST "other" token (the token just past the tag run).
  // Strip the run iff that token clearly begins a sentence:
  //   - starts with a quote mark, OR
  //   - is a generic sentence-starter word, OR
  //   - is a dialogue verb ("answered", "said", "cried", ...).
  // Exception: if the run has a lower-tag, trust the lower-tag match and also strip
  // even when the next token is a proper name (e.g. "noos nostos Mother ...").
  const GENERIC_STARTERS = new Set([
    "Then", "Now", "And", "So", "But", "With", "The", "He", "She",
    "A", "An", "In", "On", "At", "As", "When", "Thus", "Forthwith",
    "Tell", "Sing", "See", "My", "Sir", "Mother", "Father",
  ]);
  const DIALOGUE_VERBS = new Set([
    "answered", "said", "cried", "replied", "spoke", "saw", "went",
    "came", "rose", "stood", "sat", "turned", "exclaimed",
  ]);

  const nextIdx = nonWsIdx[tagCount]; // first non-tag non-whitespace token index
  if (nextIdx === undefined) return para; // nothing follows; be safe
  const nextRaw = (tokens[nextIdx] || "").replace(/^\s+/, "");
  const startsWithQuote = /^["'“‘]/.test(nextRaw);
  const nextFirstWord = nextRaw.split(/\s+/)[0]?.replace(/[.,;:!?"']+$/, "") || "";
  const isGenericStarter = GENERIC_STARTERS.has(nextFirstWord);
  const isDialogueVerb = DIALOGUE_VERBS.has(nextFirstWord.toLowerCase());
  // Also detect "ProperName + dialogue-verb" pattern ("Telemakhos answered").
  const nextSecondIdx = nonWsIdx[tagCount + 1];
  let isNameDialogue = false;
  if (nextSecondIdx !== undefined) {
    const secondRaw = (tokens[nextSecondIdx] || "").replace(/^\s+/, "");
    const secondWord = secondRaw.split(/\s+/)[0]?.replace(/[.,;:!?"']+$/, "") || "";
    if (/^[A-Z]/.test(nextFirstWord) && DIALOGUE_VERBS.has(secondWord.toLowerCase())) {
      isNameDialogue = true;
    }
  }

  const hasLower = classes.slice(0, tagCount).includes("lower-tag");
  const cleanStart = startsWithQuote || isGenericStarter || isDialogueVerb || isNameDialogue;

  // Strip all tag tokens only when the next prose looks like a real sentence start.
  // Exception: hasLower=true already proves the run is tags, so strip then too
  // even when the next word is a proper name (rare but covers "... kleos Troy Mother ...").
  if (!cleanStart && !hasLower) return para;

  const cut = tagCount === 0 ? 0 : nonWsIdx[tagCount - 1] + 1;

  if (tagCount === 0) return para;

  const remaining = tokens.slice(cut).join("").replace(/^\s+/, "");
  // Sanity: don't return an empty string.
  return remaining.length > 20 ? remaining : para;
}

async function cleanFile(textId) {
  const libPath = path.join(LIB, `${textId}.json`);
  const doc = JSON.parse(await fs.readFile(libPath, "utf8"));

  let paragraphsCleaned = 0;
  if (Array.isArray(doc.english_paragraphs) && textId === "odyssey-book-1") {
    doc.english_paragraphs = doc.english_paragraphs.map((p) => {
      const cleaned = stripKeywordPrefix(p);
      if (cleaned !== p) paragraphsCleaned++;
      return cleaned;
    });
  }

  let linesBlanked = 0;
  let linesFilled = 0;
  if (Array.isArray(doc.english_paragraphs) && doc.english_paragraphs.length && Array.isArray(doc.lines)) {
    // Distribute paragraphs proportionally across lines, but attach each paragraph
    // to ONE anchor line (the first line in its range) rather than duplicating a
    // truncated snippet on every line. This way a learner sees the real translation
    // inline at paragraph boundaries, and the blank lines in between don't look broken.
    const paras = doc.english_paragraphs;
    const N = doc.lines.length;
    const P = paras.length;
    const anchors = new Map(); // line-index -> paragraph-index
    for (let p = 0; p < P; p++) {
      // anchor paragraph p at line floor(p / P * N)
      const anchorIdx = Math.min(N - 1, Math.floor((p / P) * N));
      // if two paragraphs would collide on the same anchor, push forward to next free line
      let i = anchorIdx;
      while (anchors.has(i) && i < N - 1) i++;
      anchors.set(i, p);
    }
    for (let i = 0; i < N; i++) {
      if (anchors.has(i)) {
        doc.lines[i].english = paras[anchors.get(i)];
        linesFilled++;
      } else if (doc.lines[i].english && doc.lines[i].english.trim()) {
        doc.lines[i].english = "";
        linesBlanked++;
      }
    }
  }

  await fs.writeFile(libPath, JSON.stringify(doc, null, 2));
  console.log(`[${textId}] paragraphs cleaned: ${paragraphsCleaned}; lines filled: ${linesFilled}; lines blanked: ${linesBlanked}`);
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error("usage: clean-english.js <text-id> [<text-id> ...]");
    process.exit(1);
  }
  for (const id of ids) {
    await cleanFile(id);
  }
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
