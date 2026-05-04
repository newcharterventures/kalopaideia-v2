// X posting for Paideia: routes Latin → @LatinateGame, Greek → @Paideion.
// French/German/Old English: skipped until those accounts exist.
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Map language → xurl app name (registered via `xurl auth apps add ...`)
// Set to null to skip posting for a language.
const X_ACCOUNTS = {
  latin: "latinate",
  greek: "paideion",
  french: null,
  german: null,
  oldenglish: null,
};

function letterBreakdown(word) {
  if (!word) return "";
  const normalized = String(word).normalize("NFC");
  const letters = Array.from(normalized).filter(ch => !/\s/.test(ch));
  return letters.join(" · ");
}

function buildTweetText(langKey, entry) {
  // Keep it under 280 chars. Format: word · meaning — one-line etymology or lit context.
  const lines = [];
  lines.push(`${entry.word} — ${entry.meaning || ""}`.trim());
  const letters = letterBreakdown(entry.word);
  if (letters && letters !== entry.word) lines.push(letters);
  if (entry.transliteration) lines.push(`(${entry.transliteration})`);
  if (entry.pronunciation) lines.push(`say: ${entry.pronunciation}`);
  if (entry.literary_context) {
    // Take just the first sentence
    const lit = entry.literary_context.split(/\.\s+/)[0].trim();
    lines.push(`\n${lit}${lit.endsWith(".") ? "" : "."}`);
  }
  let text = lines.join("\n");
  if (text.length > 275) text = text.slice(0, 272) + "...";
  return text;
}

function postToX(appName, text) {
  // Use xurl CLI synchronously. Keep the command string short.
  const escaped = text.replace(/'/g, "'\\''");
  const cmd = `xurl --app ${appName} post '${escaped}'`;
  try {
    const out = execSync(cmd, {
      env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
      encoding: "utf8",
      timeout: 30000,
    });
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, error: err.message, stderr: err.stderr?.toString() || "" };
  }
}

async function main() {
  const todayPath = path.join(ROOT, "data", "today.json");
  let issue;
  try {
    issue = JSON.parse(await fs.readFile(todayPath, "utf8"));
  } catch (err) {
    console.error("[xpost] no today.json:", err.message);
    process.exit(1);
  }

  const results = {};
  for (const [langKey, entry] of Object.entries(issue.languages || {})) {
    const appName = X_ACCOUNTS[langKey];
    if (!appName) {
      console.log(`[xpost/${langKey}] no X account configured, skipping`);
      results[langKey] = { skipped: true };
      continue;
    }
    const text = buildTweetText(langKey, entry);
    console.log(`[xpost/${langKey}] posting to @${appName} (${text.length} chars)`);
    const result = postToX(appName, text);
    if (result.ok) {
      console.log(`[xpost/${langKey}] ✓ posted`);
    } else {
      console.error(`[xpost/${langKey}] ✗ failed: ${result.error}`);
      if (result.stderr) console.error(result.stderr);
    }
    results[langKey] = result;
  }

  // Write posting log
  const logPath = path.join(ROOT, "data", "xpost-log.json");
  let log = [];
  try { log = JSON.parse(await fs.readFile(logPath, "utf8")); } catch {}
  log.push({ date: issue.date, at: new Date().toISOString(), results });
  await fs.writeFile(logPath, JSON.stringify(log.slice(-60), null, 2));
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
