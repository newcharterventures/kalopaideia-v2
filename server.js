import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { lookupWord } from "./pipeline/word-lookup.js";
import { buildCommerce } from "./lib/commerce.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3026;
const BASE = "/paideia";

const VALID_LANGS = ["latin", "greek", "french", "german", "oldenglish", "middleenglish", "italian"];

// Trust the nginx proxy so req.protocol/host return public-facing values
app.set("trust proxy", 1);

// IMPORTANT: the Stripe webhook (inside commerce) needs the raw body for
// signature verification. The commerce router declares its own express.raw()
// for that route, so we mount commerce BEFORE the body parsers below.
const commerce = buildCommerce({ basePath: BASE });
app.use(BASE, express.urlencoded({ extended: false }));
app.use(BASE, commerce);

app.use(BASE, express.static(path.join(__dirname, "public")));
app.use(BASE, express.json({ limit: "100kb" }));
app.use(`${BASE}/audio`, express.static(path.join(__dirname, "data", "audio")));
app.use(`${BASE}/alphabet-audio`, express.static(path.join(__dirname, "data", "alphabet")));
// On-demand generator for missing library-audio files. Must come BEFORE the
// static handler so missing files are generated and served on first click.
app.get(`${BASE}/library-audio/:textId/:line.mp3`, async (req, res, next) => {
  const textId = String(req.params.textId).replace(/[^a-z0-9-]/g, "");
  // Allow letters in line numbers (e.g. Stephanus pagination: 327a, 327b)
  const lineNum = String(req.params.line).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const outPath = path.join(__dirname, "data", "library-audio", textId, `${lineNum}.mp3`);
  try {
    await fs.access(outPath);
    return next(); // exists — fall through to static
  } catch {}
  // Generate on-demand using single-line synth
  try {
    const libPath = path.join(__dirname, "data", "library", `${textId}.json`);
    const data = JSON.parse(await fs.readFile(libPath, "utf8"));
    const allLines = [];
    if (data.sections) for (const s of data.sections) for (const l of (s.lines || [])) allLines.push(l);
    if (data.lines) for (const l of data.lines) allLines.push(l);
    const line = allLines.find((l) => String(l.n) === lineNum);
    if (!line || !line.original) return res.status(404).end();
    const lang = data.language;
    // Spawn a one-shot single-line generator
    await new Promise((resolve, reject) => {
      const p = spawn("python3", [
        path.join(__dirname, "pipeline", "library-audio-line.py"),
        textId, String(lineNum), lang, line.original,
      ], { cwd: __dirname });
      let err = "";
      p.stderr.on("data", (d) => { err += d; });
      p.on("close", (code) => code === 0 ? resolve() : reject(new Error(err || `exit ${code}`)));
      setTimeout(() => { try { p.kill(); } catch {} reject(new Error("timeout")); }, 30000);
    });
    return next(); // file exists now — static handler serves it
  } catch (e) {
    console.error(`[library-audio on-demand] ${textId}:${lineNum} failed:`, e.message);
    return res.status(500).json({ error: "audio generation failed" });
  }
});
app.use(`${BASE}/library-audio`, express.static(path.join(__dirname, "data", "library-audio")));
app.use(`${BASE}/grammar-audio`, express.static(path.join(__dirname, "data", "grammar-audio")));

app.get(`${BASE}/api/today`, async (req, res) => {
  try {
    const words = JSON.parse(await fs.readFile(path.join(__dirname, "data", "today.json"), "utf8"));
    let culture = {};
    try {
      culture = JSON.parse(await fs.readFile(path.join(__dirname, "data", "culture-today.json"), "utf8"));
    } catch {}
    res.json({ ...words, culture: culture.vignettes || {} });
  } catch (err) {
    res.status(503).json({ error: "Edition not yet generated." });
  }
});

app.get(`${BASE}/api/primer/:lang`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "Unknown language." });
  try {
    const raw = await fs.readFile(path.join(__dirname, "data", "primer", `${lang}.json`), "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: "Primer not yet generated." });
  }
});

// Language section page — aggregates today's word + archive of past words
app.get(`${BASE}/api/language/:lang`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "Unknown language." });

  try {
    const wordsDir = path.join(__dirname, "data", "words");
    const cultureDir = path.join(__dirname, "data", "culture");
    let files = (await fs.readdir(wordsDir))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    // Cursor pagination: ?before=YYYY-MM-DD returns entries strictly older than this date.
    // First page omits ?before (returns newest first).
    const before = req.query.before ? String(req.query.before).replace(/[^0-9-]/g, "") : null;
    if (before) {
      const beforeFile = `${before}.json`;
      files = files.filter((f) => f < beforeFile);
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const entries = [];

    for (const file of files) {
      if (entries.length >= limit) break;
      try {
        const issue = JSON.parse(await fs.readFile(path.join(wordsDir, file), "utf8"));
        const entry = issue.languages?.[lang];
        if (!entry) continue;

        // Try to attach culture vignette from same date
        let culture = null;
        try {
          const cult = JSON.parse(await fs.readFile(path.join(cultureDir, file), "utf8"));
          culture = cult.vignettes?.[lang] || null;
        } catch {}

        entries.push({
          date: issue.date,
          entry,
          culture,
        });
      } catch {}
    }

    // Compute next cursor: oldest date in this page; client passes it as ?before to get the next page.
    const nextBefore = entries.length === limit && entries.length > 0
      ? entries[entries.length - 1].date
      : null;
    const hasMore = nextBefore !== null;

    // Only load primer for the first page (saves bandwidth on infinite scroll)
    let primer = null;
    if (!before) {
      try {
        primer = JSON.parse(await fs.readFile(path.join(__dirname, "data", "primer", `${lang}.json`), "utf8"));
      } catch {}
    }

    res.json({ language: lang, primer, entries, nextBefore, hasMore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${BASE}/api/archive`, async (req, res) => {
  try {
    const files = await fs.readdir(path.join(__dirname, "data", "words"));
    const dates = files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort().reverse();
    res.json({ dates });
  } catch {
    res.json({ dates: [] });
  }
});

app.get(`${BASE}/api/day/:date`, async (req, res) => {
  try {
    const date = req.params.date.replace(/[^0-9-]/g, "");
    const words = JSON.parse(await fs.readFile(path.join(__dirname, "data", "words", `${date}.json`), "utf8"));
    let culture = {};
    try {
      culture = JSON.parse(await fs.readFile(path.join(__dirname, "data", "culture", `${date}.json`), "utf8"));
    } catch {}
    res.json({ ...words, culture: culture.vignettes || {} });
  } catch {
    res.status(404).json({ error: "Day not found." });
  }
});

// Library API: list texts for a language
app.get(`${BASE}/api/library/:lang`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "Unknown language." });
  try {
    const libDir = path.join(__dirname, "data", "library");
    const files = await fs.readdir(libDir);
    const texts = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(libDir, f), "utf8"));
        if (data.language === lang) {
          let linesCount = (data.lines || []).length;
          if (data.sections) {
            for (const sec of data.sections) linesCount += (sec.lines || []).length;
          }
          texts.push({
            id: data.id,
            title: data.title,
            author: data.author,
            date: data.date,
            translator: data.translator,
            translator_date: data.translator_date,
            lines_count: linesCount,
            has_sections: !!data.sections,
            sections_count: data.sections ? data.sections.length : 0,
          });
        }
      } catch {}
    }
    res.json({ texts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Word-pronunciation audio (on-demand TTS, cached)
app.get(`${BASE}/api/word-audio/:lang/:word.mp3`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).end();
  const word = decodeURIComponent(req.params.word).trim();
  if (!word) return res.status(400).end();

  const hash = crypto.createHash("sha1").update(word).digest("hex").slice(0, 16);
  const outPath = path.join(__dirname, "data", "word-audio", lang, `${hash}.mp3`);

  // If cached, serve immediately with proper headers
  try {
    await fs.access(outPath);
    const stat = await fs.stat(outPath);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(outPath);
  } catch {}

  // Generate
  await new Promise((resolve) => {
    const proc = spawn("python3", [
      path.join(__dirname, "pipeline", "word-audio.py"), lang, word,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) console.error("[word-audio]", lang, word, err);
      resolve();
    });
    setTimeout(() => { try { proc.kill(); } catch {} resolve(); }, 10000);
  });

  try {
    await fs.access(outPath);
    const stat = await fs.stat(outPath);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(outPath);
  } catch {
    return res.status(500).end();
  }
});

// Word lookup API (for tap-to-define popovers)
app.get(`${BASE}/api/word/:lang/:word`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "Unknown language." });
  const word = decodeURIComponent(req.params.word);
  const contextLine = String(req.query.line || "");
  const contextEnglish = String(req.query.en || "");
  try {
    const entry = await lookupWord(lang, word, contextLine, contextEnglish);
    if (!entry) return res.status(404).json({ error: "Not found." });
    res.json({ word, language: lang, entry });
  } catch (err) {
    console.error("[word lookup]", err);
    res.status(500).json({ error: err.message });
  }
});

// Library API: full text by id
app.get(`${BASE}/api/library/text/:id`, async (req, res) => {
  const id = String(req.params.id).replace(/[^a-z0-9-]/g, "");
  try {
    const raw = await fs.readFile(path.join(__dirname, "data", "library", `${id}.json`), "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: "Text not found." });
  }
});

// Page routes
// ===== Contact form =====
// Per Jae 2026-04-30 16:16 UTC. Plain form -> JSON file queue + best-effort
// email via sendmail (if available). Submissions are appended to
// data/contact-inbox.jsonl so they're never lost. The recipient is
// info@newcharterventures.com.
const CONTACT_INBOX = path.join(__dirname, "data", "contact-inbox.jsonl");
const CONTACT_RECIPIENT = "info@newcharterventures.com";

function _looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

app.post(`${BASE}/api/contact`, async (req, res) => {
  try {
    const { name = "", email = "", subject = "", message = "", website = "" } = req.body || {};

    // Honeypot: real users won't fill the hidden "website" field.
    if (website && String(website).trim() !== "") {
      return res.json({ ok: true });  // pretend success
    }

    const N = String(name).trim();
    const E = String(email).trim();
    const S = String(subject).trim();
    const M = String(message).trim();

    if (!N || !E || !S || !M) return res.status(400).json({ error: "Please fill in all fields." });
    if (!_looksLikeEmail(E)) return res.status(400).json({ error: "Please use a valid email address." });
    if (M.length > 10000) return res.status(400).json({ error: "Message too long." });
    if (N.length > 200 || S.length > 300) return res.status(400).json({ error: "Field too long." });

    const submission = {
      received_at: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(),
      ua: String(req.headers["user-agent"] || "").slice(0, 500),
      name: N, email: E, subject: S, message: M,
    };

    // 1. Always append to disk queue (durable, no external deps).
    try {
      await fs.mkdir(path.dirname(CONTACT_INBOX), { recursive: true });
      await fs.appendFile(CONTACT_INBOX, JSON.stringify(submission) + "\n");
    } catch (e) {
      console.error("[contact] queue write failed:", e.message);
    }

    // 2. Best-effort email via local sendmail (if installed). Non-blocking.
    try {
      const sendmail = spawn("sendmail", ["-t", "-oi"], { stdio: ["pipe", "ignore", "ignore"] });
      sendmail.on("error", () => {}); // sendmail not installed -> ignore silently
      const safeSubject = S.replace(/[\r\n]+/g, " ").slice(0, 200);
      const body = [
        `To: ${CONTACT_RECIPIENT}`,
        `From: Paideia Contact <noreply@newcharterventures.com>`,
        `Reply-To: ${N} <${E}>`,
        `Subject: [Paideia Contact] ${safeSubject}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `New Paideia contact form submission`,
        `Received: ${submission.received_at}`,
        `From:     ${N} <${E}>`,
        `Subject:  ${safeSubject}`,
        `IP:       ${submission.ip}`,
        ``,
        `--- Message ---`,
        M,
        ``,
        `--- end ---`,
      ].join("\n");
      sendmail.stdin.write(body);
      sendmail.stdin.end();
    } catch (e) {
      // sendmail unavailable; queue file is the source of truth.
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[contact] error:", e);
    return res.status(500).json({ error: "Server error. Please try again or write to info@newcharterventures.com." });
  }
});

app.get(BASE, (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get(`${BASE}/`, (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// Reader page
app.get(`${BASE}/read/:id`, (_req, res) => res.sendFile(path.join(__dirname, "public", "reader.html")));
app.get(`${BASE}/contact`,   (_req, res) => res.sendFile(path.join(__dirname, "public", "contact.html")));
app.get(`${BASE}/contact/`,  (_req, res) => res.sendFile(path.join(__dirname, "public", "contact.html")));
app.get(`${BASE}/terms`,     (_req, res) => res.sendFile(path.join(__dirname, "public", "terms.html")));
app.get(`${BASE}/terms/`,    (_req, res) => res.sendFile(path.join(__dirname, "public", "terms.html")));

// Per-language section pages
for (const lang of VALID_LANGS) {
  app.get(`${BASE}/${lang}`, (_req, res) => res.sendFile(path.join(__dirname, "public", "language.html")));
  app.get(`${BASE}/${lang}/`, (_req, res) => res.sendFile(path.join(__dirname, "public", "language.html")));
}

app.listen(PORT, () => console.log(`Paideia on :${PORT}${BASE}`));
