// Backfill per-line english fields for long-works books.
// Strategy: distribute english_paragraphs proportionally across lines.
// Every N Greek lines share one English paragraph (the nearest one).
//
// Usage: node fill-english.js <text-id>

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LIB = path.join(ROOT, "data", "library");

async function main() {
  const textId = process.argv[2];
  if (!textId) { console.error("usage: fill-english.js <text-id>"); process.exit(1); }

  const libPath = path.join(LIB, `${textId}.json`);
  const doc = JSON.parse(await fs.readFile(libPath, "utf8"));

  const paras = doc.english_paragraphs || [];
  const lines = doc.lines || [];
  if (!paras.length) { console.error("no english_paragraphs in this text"); process.exit(0); }
  if (!lines.length) { console.error("no lines in this text"); process.exit(0); }

  // Already has english_paragraphs prefixed with Stephanus-style "[n]"?
  // If so this is a Republic-style file and each line.english is already good.
  const hasStephanus = paras[0] && /^\[[\dabcde]+\]/.test(paras[0]);
  if (hasStephanus) {
    // Match by line.n
    let changed = 0;
    for (const line of lines) {
      if (line.english && line.english.trim()) continue;
      const match = paras.find((p) => p.startsWith(`[${line.n}]`));
      if (match) {
        line.english = match.replace(/^\[[^\]]+\]\s*/, "").trim();
        changed++;
      }
    }
    console.log(`[${textId}] Stephanus: filled ${changed} english fields`);
  } else {
    // Distribute paragraphs proportionally. Line i of N gets paragraph floor(i / N * P)
    const N = lines.length;
    const P = paras.length;
    let changed = 0;
    for (let i = 0; i < N; i++) {
      if (lines[i].english && lines[i].english.trim()) continue;
      const idx = Math.min(P - 1, Math.floor((i / N) * P));
      // Take a short slice — the whole paragraph is too long for per-line.
      // Take first ~140 chars as a readable snippet.
      const fullPara = paras[idx] || "";
      const snippet = fullPara.length > 180 ? fullPara.slice(0, 180).replace(/\s+\S*$/, "") + "…" : fullPara;
      lines[i].english = snippet;
      changed++;
    }
    console.log(`[${textId}] Proportional: filled ${changed} english fields from ${P} paragraphs`);
  }

  await fs.writeFile(libPath, JSON.stringify(doc, null, 2));
  console.log(`✅ patched ${libPath}`);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
