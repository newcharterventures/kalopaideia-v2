import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { renderPublic } from "./scripts/render-public.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { lookupWord } from "./pipeline/word-lookup.js";
import { buildCommerce } from "./lib/commerce.js";
import {
  checkAudioRequest,
  checkAudioSynth,
  recordAudioRequest,
  validateAudioInput,
  getAudioRateLimitStats,
} from "./lib/rate-limit-audio.js";
import {
  hasStoaAccess,
  getAnalyticsPrefs,
  setAnalyticsPrefs,
  isAnalyticsAllowed,
  upsertAnalyticsSession,
  insertAnalyticsEvents,
  purgeAnalyticsForUser,
  exportAnalyticsForUser,
  getAnalyticsSummary,
  getAdminAnalyticsSummary,
  getPatronSummary,
} from "./lib/commerce-db.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "jae@newcharterventures.com";
function _isAdmin(user) { return !!user && user.email === ADMIN_EMAIL; }
function _requireAdmin(req, res, next) {
  // API requests get JSON status codes; page requests get redirected.
  const isApi = req.path.startsWith(`${BASE}/api/`) || req.path.startsWith('/api/');
  if (!req.user) {
    if (isApi) return res.status(401).json({ error: 'sign in required' });
    return res.redirect(`${BASE}/account?next=${encodeURIComponent(req.originalUrl)}`);
  }
  if (!_isAdmin(req.user)) {
    if (isApi) return res.status(403).json({ error: 'forbidden' });
    return res.status(403).send('<h1>Forbidden</h1><p>This page is for the proprietor.</p>');
  }
  next();
}
import { stoaById } from "./lib/commerce-catalog.js";
import { isConfigured as stripeConfigured } from "./lib/commerce-stripe.js";
import {
  loadManifest as loadCurriculumManifest,
  loadLesson as loadCurriculumLesson,
  scoreExam,
  attachDb as attachCurriculumDb,
  markLessonComplete,
  getProgress as getCurriculumProgress,
  recordCheckpoint,
  recordCapstone,
  getCapstoneRecord,
  markCertMinted,
  getCertByTokenId,
} from "./lib/curriculum.js";
import { mintDiploma, isLive as mintIsLive, chainName as mintChainName } from "./lib/mint-base.js";
import Database from "better-sqlite3";

// Per Jae 2026-05-09: subscription pricing is $11.99/mo for both sites.
// Kalopaideia's audio/library content can be paywalled with the same
// entitlement check as the Mansion's Stoa. The check is enabled when
// `PAIDEIA_PAYWALL=1` in the environment; otherwise all content stays
// free as before. Subscribers (and per-book buyers) get full access
// either way — the flag only controls whether non-subscribers are
// blocked. Default off so flipping the live site doesn't break readers
// without a sign-in flow ready. Audio for the gateway book
// (`odyssey-book-1`) and free daily-word audio always remain open.
const PAYWALL_ENABLED = process.env.PAIDEIA_PAYWALL === "1";

function enforceLibraryAccess(req, textId) {
  // Returns null if access permitted, or an Express response payload
  // describing the denial. Falls open when the paywall flag is off.
  if (!PAYWALL_ENABLED) return null;
  const work = stoaById(textId);
  if (!work) return null;          // unknown work → let the route 404 normally
  if (work.is_gateway) return null;
  if (hasStoaAccess(req.user, work)) return null;
  return { status: 402, body: { error: "subscription_required", work_id: work.id, all_access_url: `${BASE}/akousma/${encodeURIComponent(work.id)}` } };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3026;
const BASE = process.env.BASE_PATH || "/paideia";

const VALID_LANGS = [
  "latin", "greek", "french", "german", "oldenglish", "middleenglish", "italian",
  // Phase 1 addition (Jae 2026-05-11): Celtic + Germanic peripheral tongues.
  // Gaulish + Welsh under "celtic"; Old Norse under "germanic".
  "gaulish", "welsh", "oldnorse",
];

// Category taxonomy. Categories group peripheral tongues without becoming
// URL prefixes for the language pages themselves (Option C — flat language
// URLs, but category landing pages exist for browsing).
const CATEGORIES = {
  celtic: {
    slug: "celtic",
    name: "Celtic",
    greek_label: "Κελτικαί Φωναί",
    subtitle: "The Celtic tongues — Gaulish and Welsh",
    description: "The Celtic family of languages — the Continental tongue of pre-Roman Gaul, and the Insular tongue of medieval and modern Wales. Two thousand years of poetry, lawbooks, and inscriptions.",
    languages: ["gaulish", "welsh"],
  },
  germanic: {
    slug: "germanic",
    name: "Germanic",
    greek_label: "Γερμανικαί Φωναί",
    subtitle: "The Germanic tongues — Old Norse",
    description: "The Germanic family of languages, here represented by Old Norse: the saga-language of medieval Iceland and Norway, and the runic Proto-Norse of its earliest inscriptions.",
    languages: ["oldnorse"],
  },
};
const VALID_CATEGORIES = Object.keys(CATEGORIES);

// Trust the nginx proxy so req.protocol/host return public-facing values
app.set("trust proxy", 1);

// IMPORTANT: the Stripe webhook (inside commerce) needs the raw body for
// signature verification. The commerce router declares its own express.raw()
// for that route, so we mount commerce BEFORE the body parsers below.
const commerce = buildCommerce({ basePath: BASE });
app.use(BASE, express.urlencoded({ extended: false }));
app.use(BASE, commerce);

// Files moved into public/_mockups/ by the v2-migration cleanup 2026-05-20
// were originally blocked from being served (404 silently). Per Jae
// 2026-08-06, _mockups/ is now intentionally public — kept as a reference,
// no longer walled off.
// Render public/ → public-deployed/ at startup with mtime-derived cache-bust
// stamps (durable fix, 2026-08-19). If the render ever fails, fall back to
// serving public/ directly — the site stays up either way.
let deployedDir = path.join(__dirname, "public-deployed");
try {
  renderPublic(path.join(__dirname, "public"), deployedDir, BASE);
} catch (err) {
  console.error("[render-public] render failed, falling back to public/: " + err.message);
  deployedDir = path.join(__dirname, "public");
}
app.use(BASE, express.static(deployedDir));

// Fallback for links that omit the /_mockups/ segment (e.g.
// /paideia/ad-mockup-d.html instead of /paideia/_mockups/ad-mockup-d.html) —
// redirect to the canonical path if the file exists there. Added 2026-08-06
// after repeated "blank page" reports caused by that missing segment.
app.use(BASE, async (req, res, next) => {
  if (req.path.startsWith("/_mockups/")) return next();
  const candidate = path.join(__dirname, "public", "_mockups", req.path);
  try {
    const stat = await fs.stat(candidate);
    if (stat.isFile()) return res.redirect(302, `${BASE}/_mockups${req.path}`);
  } catch {}
  next();
});

app.use(BASE, express.json({ limit: "100kb" }));
app.use(`${BASE}/audio`, express.static(path.join(__dirname, "data", "audio")));
app.use(`${BASE}/alphabet-audio`, express.static(path.join(__dirname, "data", "alphabet")));
// On-demand generator for missing library-audio files. Must come BEFORE the
// static handler so missing files are generated and served on first click.
app.get(`${BASE}/library-audio/:textId/:line.mp3`, async (req, res, next) => {
  const textId = String(req.params.textId).replace(/[^a-z0-9-]/g, "");
  // Allow letters in line numbers (e.g. Stephanus pagination: 327a, 327b)
  const lineNum = String(req.params.line).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  // Entitlement gate (no-op when PAIDEIA_PAYWALL is unset).
  const denied = enforceLibraryAccess(req, textId);
  if (denied) return res.status(denied.status).json(denied.body);
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

    // Numbered-page pagination (Jae 2026-08-18: replaced infinite scroll).
    // First, collect the full list of files that actually have an entry for
    // this language, so page counts/totals are accurate (some issues may
    // omit a language). This directory is small enough to scan in full.
    const matchingFiles = [];
    for (const file of files) {
      try {
        const issue = JSON.parse(await fs.readFile(path.join(wordsDir, file), "utf8"));
        if (issue.languages?.[lang]) matchingFiles.push(file);
      } catch {}
    }

    const pageSize = 20;
    const totalEntries = matchingFiles.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    let page = parseInt(req.query.page, 10) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const startIdx = (page - 1) * pageSize;
    const pageFiles = matchingFiles.slice(startIdx, startIdx + pageSize);

    const entries = [];
    for (const file of pageFiles) {
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

    // Only load primer for page 1 (saves bandwidth on subsequent pages)
    let primer = null;
    if (page === 1) {
      try {
        primer = JSON.parse(await fs.readFile(path.join(__dirname, "data", "primer", `${lang}.json`), "utf8"));
      } catch {}
    }

    res.json({ language: lang, primer, entries, page, totalPages, totalEntries });
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

// Library API: total count of audio works across the entire AKOUSMA corpus.
// Excludes any *.backup-*.json snapshots. Per Jae 2026-05-09 — the count
// is fetched live by the front-end so it updates automatically as new
// works are added to data/library/.
// Per Jae 2026-05-12: akousma promo cards (rendered on the homepage between
// language sections and on each language page) should pull cover + blurb
// metadata from `data/library/library-meta.json` — the single source of truth
// — NOT from a hardcoded AKOUSMA_BOOKS constant duplicated client-side.
// This endpoint returns, for every language, the canonical first work with
// full cover_src / cover_alt / cover_credits / blurb so the front-end can
// render akousma cards directly from server data.
app.get(`${BASE}/api/akousma/cards`, async (_req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const libDir = path.join(__dirname, "data", "library");
    const files = await fs.readdir(libDir);
    const meta = await loadLibraryMeta();

    // Group books by language. For each language pick the first one as
    // the canonical akousma card (Iliad I for Greek, Aeneid I for Latin
    // etc.) — stable order via the filename.
    const byLang = {};
    for (const f of files.sort()) {
      if (!f.endsWith(".json")) continue;
      if (f.includes(".backup-")) continue;
      if (f === "library-meta.json") continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(libDir, f), "utf8"));
        const lang = (data.language || "unknown").toLowerCase();
        const m = meta[data.id] || {};
        const lineCount =
          (data.lines || []).length +
          ((data.sections || []).reduce((a, s) => a + (s.lines || []).length, 0));
        const card = {
          id: data.id,
          language: lang,
          title: data.title,
          author: data.author,
          date: data.date,
          translator: data.translator,
          translator_date: data.translator_date,
          lines_count: lineCount,
          is_gateway: data.id === "odyssey-book-1",
          cover_src: m.cover_src || null,
          cover_alt: m.cover_alt || null,
          cover_credits: m.cover_credits || null,
          blurb: m.blurb || null,
        };
        (byLang[lang] ||= []).push(card);
      } catch {}
    }
    res.json({ by_language: byLang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${BASE}/api/library/all`, async (_req, res) => {
  try {
    const libDir = path.join(__dirname, "data", "library");
    const files = await fs.readdir(libDir);
    const byLang = {};
    let total = 0;
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      if (f.includes(".backup-")) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(libDir, f), "utf8"));
        const lang = data.language || "unknown";
        byLang[lang] = (byLang[lang] || 0) + 1;
        total++;
      } catch {}
    }
    res.json({ total, by_language: byLang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Library API: list texts for a language. Per Jae 2026-05-12: each text
// now carries cover_src / cover_alt / cover_credits / blurb pulled from
// data/library/library-meta.json (single source of truth for cover art
// and editorial blurbs). Backup snapshots (*.backup-*.json) are skipped.
async function loadLibraryMeta() {
  try {
    const metaPath = path.join(__dirname, "data", "library", "library-meta.json");
    return JSON.parse(await fs.readFile(metaPath, "utf8"));
  } catch {
    return {};
  }
}

app.get(`${BASE}/api/library/:lang`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "Unknown language." });
  // Per Jae 2026-05-12: cover_src / cover_credits change as editorial
  // curation evolves; browsers must always revalidate, not serve stale
  // cached JSON that shows the previous cover's painter credits.
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  try {
    const libDir = path.join(__dirname, "data", "library");
    const files = await fs.readdir(libDir);
    const meta = await loadLibraryMeta();
    const texts = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      if (f.includes(".backup-")) continue;
      if (f === "library-meta.json") continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(libDir, f), "utf8"));
        if (data.language === lang) {
          let linesCount = (data.lines || []).length;
          if (data.sections) {
            for (const sec of data.sections) linesCount += (sec.lines || []).length;
          }
          const m = meta[data.id] || {};
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
            is_gateway: data.id === "odyssey-book-1",
            cover_src: m.cover_src || null,
            cover_alt: m.cover_alt || null,
            cover_credits: m.cover_credits || null,
            blurb: m.blurb || null,
          });
        }
      } catch {}
    }
    res.json({ texts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Word-pronunciation audio (on-demand TTS, cached).
//
// Rate-limited per the 2026-05-20 audio remediation plan
// (paideia/docs/AUDIO-REMEDIATION.md). The route serves the same URL
// for two surfaces:
//   * single-word pronunciations (reader tap-to-define, language page)
//   * full-sentence daily-word audio (app.js, language.js)
// We therefore cannot strictly allowlist words — instead we cap by IP
// (separate budgets for cache hits vs synth) and validate input shape.
app.get(`${BASE}/api/word-audio/:lang/:word.mp3`, async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).end();

  // Input validation: shape, length, control chars
  let decoded;
  try { decoded = decodeURIComponent(req.params.word); }
  catch { return res.status(400).json({ error: "invalid_input" }); }
  const inputErr = validateAudioInput(decoded);
  if (inputErr) return res.status(inputErr.status).json({ error: inputErr.error });
  const word = decoded.trim();

  // Per-IP daily total cap (covers cache hits + misses)
  const total = checkAudioRequest(req);
  if (!total.ok) {
    res.setHeader("Retry-After", String(total.retryAfterSec));
    return res.status(total.status).json({ error: "rate_limited", reason: total.reason });
  }

  const hash = crypto.createHash("sha1").update(word).digest("hex").slice(0, 16);
  const outPath = path.join(__dirname, "data", "word-audio", lang, `${hash}.mp3`);

  // Cache hit — cheap path. Count toward per-IP total, not synth.
  try {
    await fs.access(outPath);
    recordAudioRequest(req, { synth: false });
    const stat = await fs.stat(outPath);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(outPath);
  } catch {}

  // Cache miss — synth gate. Check per-IP synth budget + global cap.
  const synth = checkAudioSynth(req);
  if (!synth.ok) {
    res.setHeader("Retry-After", String(synth.retryAfterSec));
    return res.status(synth.status).json({ error: "rate_limited", reason: synth.reason });
  }
  // Record the synth attempt up front so a hung TTS doesn't escape the cap.
  recordAudioRequest(req, { synth: true });

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

// Admin-only diagnostics for the audio rate limiter
app.get(`${BASE}/api/admin/audio-rate-stats`, _requireAdmin, (_req, res) => {
  res.json(getAudioRateLimitStats());
});

// Patron summary — public endpoint that powers the progress bar on the
// /support page. No auth (the numbers are not sensitive: aggregate
// counts and dollars only, no PII).
// Per Jae 2026-05-20: both sites share the patron_events table written
// by Mansion's Stripe webhook; this is just a read into the shared DB.
app.get(`${BASE}/api/patrons/summary`, (req, res) => {
  const site = String(req.query.site || "kalopaideia").toLowerCase();
  if (site !== "kalopaideia" && site !== "mansion") {
    return res.status(400).json({ error: "unknown site" });
  }
  try {
    res.json(getPatronSummary(site));
  } catch (e) {
    console.error("[patrons/summary]", e);
    res.status(500).json({ error: "internal" });
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
  // Entitlement gate. When the paywall is on, non-owners get the work
  // metadata + first 5 lines (the public sample) and a 402 hint.
  const denied = enforceLibraryAccess(req, id);
  if (denied) {
    try {
      const raw = await fs.readFile(path.join(__dirname, "data", "library", `${id}.json`), "utf8");
      const data = JSON.parse(raw);
      const allLines = (data.lines || []).slice();
      if (data.sections) for (const s of data.sections) for (const l of (s.lines || [])) allLines.push(l);
      const sample = allLines.slice(0, 5);
      return res.status(denied.status).json({
        ...denied.body,
        id: data.id, title: data.title, author: data.author, language: data.language,
        translator: data.translator, translator_date: data.translator_date,
        meter: data.meter, license: data.license,
        sample_lines: sample,
        total_lines: allLines.length,
      });
    } catch {}
    return res.status(denied.status).json(denied.body);
  }
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
        `From: Kalopaideia Contact <noreply@newcharterventures.com>`,
        `Reply-To: ${N} <${E}>`,
        `Subject: [Kalopaideia Contact] ${safeSubject}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        `New Kalopaideia contact form submission`,
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

// ===== Analytics (Jae 2026-05-12; opt-out model) =====
// All endpoints require a logged-in user. Writes silently no-op when the
// user has opted out OR sent DNT: 1, so the client doesn't branch.
const SITE = "paideia";
function _requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "sign in required" });
  next();
}

// Lightweight identity probe used by client-side analytics.js. Returns the
// minimum the client needs to decide whether to track. Unauthenticated
// callers get { user: null } and 200 OK (not 401 — we don't want a noisy
// console error on every page load for anonymous browsers).
app.get(`${BASE}/api/whoami`, (req, res) => {
  // Stripe-ready flag is exposed to anonymous callers too, since the
  // Library tab needs to choose between 'Subscribe' and 'coming soon' for
  // every visitor, not just signed-in ones.
  const stripe_ready = stripeConfigured();
  if (!req.user) return res.json({ user: null, stripe_ready });
  const prefs = getAnalyticsPrefs(req.user.id);
  res.json({
    user: {
      id: req.user.id,
      display_name: req.user.display_name || null,
      // Per Jae 2026-05-12: expose subscription status so the Library tab
      // can render the right state (subscriber sees Read buttons, non-
      // subscriber sees a Subscribe CTA per book).
      sub_status: req.user.sub_status || null,
    },
    stripe_ready,
    analytics: {
      tracking_enabled: prefs.tracking_enabled,
      daily_goal_minutes: prefs.daily_goal_minutes,
      banner_dismissed_at: prefs.banner_dismissed_at,
    },
  });
});

app.get(`${BASE}/api/analytics/prefs`, _requireUser, (req, res) => {
  res.json(getAnalyticsPrefs(req.user.id));
});

app.put(`${BASE}/api/analytics/prefs`, _requireUser, (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.tracking_enabled === "boolean") patch.tracking_enabled = body.tracking_enabled;
  if (Number.isFinite(body.daily_goal_minutes)) {
    patch.daily_goal_minutes = Math.max(1, Math.min(600, Math.floor(body.daily_goal_minutes)));
  }
  if (body.banner_dismissed_at === null || typeof body.banner_dismissed_at === "string") {
    patch.banner_dismissed_at = body.banner_dismissed_at;
  }
  setAnalyticsPrefs(req.user.id, patch);
  res.json(getAnalyticsPrefs(req.user.id));
});

function _handleSessionUpsert(req, res) {
  const dnt = req.get("DNT") || req.get("dnt");
  if (!isAnalyticsAllowed(req.user.id, dnt)) return res.status(204).end();
  const body = req.body || {};
  const site = body.site === "mansion" ? "mansion" : SITE;
  upsertAnalyticsSession(req.user.id, {
    ...body,
    site,
    user_agent: (req.get("user-agent") || "").slice(0, 256) || null,
  });
  res.status(204).end();
}
app.put(`${BASE}/api/analytics/session`, _requireUser, _handleSessionUpsert);
app.post(`${BASE}/api/analytics/session-beacon`, _requireUser, _handleSessionUpsert);

function _handleEventsUpload(req, res) {
  const dnt = req.get("DNT") || req.get("dnt");
  if (!isAnalyticsAllowed(req.user.id, dnt)) return res.status(204).end();
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 200) : [];
  for (const e of events) {
    if (e && e.site !== "mansion") e.site = SITE;
  }
  const n = insertAnalyticsEvents(req.user.id, events);
  res.json({ accepted: n });
}
app.post(`${BASE}/api/analytics/events`, _requireUser, _handleEventsUpload);
app.post(`${BASE}/api/analytics/events-beacon`, _requireUser, _handleEventsUpload);

app.get(`${BASE}/api/analytics/summary`, _requireUser, (req, res) => {
  const days = Number(req.query.days);
  const site = req.query.site;
  res.json(getAnalyticsSummary(req.user.id, {
    days: Number.isFinite(days) ? days : 30,
    site,
  }));
});

app.get(`${BASE}/api/analytics/export`, _requireUser, (req, res) => {
  const data = exportAnalyticsForUser(req.user.id);
  res.setHeader("Content-Disposition", `attachment; filename="analytics-${req.user.id}.json"`);
  res.json(data);
});

app.delete(`${BASE}/api/analytics/data`, _requireUser, (req, res) => {
  purgeAnalyticsForUser(req.user.id);
  res.status(204).end();
});

// User-facing analytics dashboard page.
app.get(`${BASE}/analytics`, (req, res) => {
  if (!req.user) return res.redirect(`${BASE}/account?next=${encodeURIComponent(BASE + '/analytics')}`);
  res.sendFile(path.join(deployedDir, "analytics.html"));
});

// Admin-only sitewide analytics. Same gate as Mansion: email match.
app.get(`${BASE}/api/admin/analytics/summary`, _requireAdmin, (req, res) => {
  const days = Number(req.query.days);
  const site = req.query.site;
  res.json(getAdminAnalyticsSummary({
    days: Number.isFinite(days) ? days : 30,
    site,
  }));
});
app.get(`${BASE}/admin/analytics`, _requireAdmin, (req, res) => {
  res.sendFile(path.join(deployedDir, "admin-analytics.html"));
});

app.get(BASE, (_req, res) => res.sendFile(path.join(deployedDir, "index.html")));
app.get(`${BASE}/`, (_req, res) => res.sendFile(path.join(deployedDir, "index.html")));

// Reader page
app.get(`${BASE}/read/:id`, (_req, res) => res.sendFile(path.join(deployedDir, "reader.html")));
app.get(`${BASE}/contact`,   (_req, res) => res.sendFile(path.join(deployedDir, "contact.html")));
app.get(`${BASE}/contact/`,  (_req, res) => res.sendFile(path.join(deployedDir, "contact.html")));
app.get(`${BASE}/terms`,     (_req, res) => res.sendFile(path.join(deployedDir, "terms.html")));
app.get(`${BASE}/terms/`,    (_req, res) => res.sendFile(path.join(deployedDir, "terms.html")));
app.get(`${BASE}/privacy`,   (_req, res) => res.sendFile(path.join(deployedDir, "privacy.html")));
app.get(`${BASE}/privacy/`,  (_req, res) => res.sendFile(path.join(deployedDir, "privacy.html")));

// Per-language section pages
for (const lang of VALID_LANGS) {
  app.get(`${BASE}/${lang}`, (_req, res) => res.sendFile(path.join(deployedDir, "language.html")));
  app.get(`${BASE}/${lang}/`, (_req, res) => res.sendFile(path.join(deployedDir, "language.html")));
}

// Category landing pages (Celtic, Germanic) — Option C: categories live
// as their own URLs but the languages under them remain flat.
for (const cat of VALID_CATEGORIES) {
  app.get(`${BASE}/${cat}`, (_req, res) => res.sendFile(path.join(deployedDir, "category.html")));
  app.get(`${BASE}/${cat}/`, (_req, res) => res.sendFile(path.join(deployedDir, "category.html")));
}

// Category API — returns metadata + child-language summaries for rendering
// the landing page.
app.get(`${BASE}/api/category/:slug`, async (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase();
  const cat = CATEGORIES[slug];
  if (!cat) return res.status(404).json({ error: "Unknown category." });
  res.json(cat);
});

// ============================================================
// Curriculum & Diploma
// ============================================================

// Attach the same SQLite DB the commerce layer uses, so curriculum tables
// live beside the subscription/access tables.
const _curDb = new Database(path.join(__dirname, "data", "sessions.db"));
attachCurriculumDb(_curDb);

function _requireUserCur(req, res, next) {
  if (!req.user || !req.user.email) {
    return res.status(401).json({ error: "sign in required" });
  }
  next();
}

// Curriculum manifest for a language.
app.get(`${BASE}/api/curriculum/:lang`, async (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const m = await loadCurriculumManifest(lang);
  if (!m) return res.status(404).json({ error: "no curriculum yet" });
  res.json(m);
});

// Capstone exam spec (without the answer keys).
app.get(`${BASE}/api/curriculum/:lang/capstone-spec`, async (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const examPath = path.join(__dirname, "data", "curriculum", lang, `capstone.json`);
  try {
    const exam = JSON.parse(await fs.readFile(examPath, "utf8"));
    // Strip answer keys so they aren't leaked to the client.
    const safe = JSON.parse(JSON.stringify(exam));
    for (const sec of safe.sections || []) {
      for (const it of sec.items || []) {
        delete it.answer;
        delete it.reference;
        delete it.keywords;
        delete it.threshold;
      }
    }
    res.json(safe);
  } catch {
    res.status(404).json({ error: "capstone not found" });
  }
});

// Per-lesson detail.
app.get(`${BASE}/api/curriculum/:lang/lesson/:id`, async (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const id = String(req.params.id || "").replace(/[^0-9.]/g, "");
  const lesson = await loadCurriculumLesson(lang, id);
  if (!lesson) return res.status(404).json({ error: "lesson not found" });
  res.json(lesson);
});

// Mark a lesson complete (requires sign-in).
app.post(`${BASE}/api/curriculum/:lang/lesson/:id/complete`, _requireUserCur, (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const id = String(req.params.id || "").replace(/[^0-9.]/g, "");
  const minutes = Number(req.body?.minutes || 0);
  markLessonComplete(req.user.email, lang, id, minutes);
  res.json({ ok: true });
});

// Progress summary for a language. Returns an empty progress shape for
// anonymous users so the curriculum page can render in a logged-out state.
app.get(`${BASE}/api/curriculum/:lang/progress`, (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  if (!req.user || !req.user.email) {
    return res.json({ lessons: {}, checkpoints: {}, capstone: null, anonymous: true });
  }
  res.json(getCurriculumProgress(req.user.email, lang));
});

// Submit a checkpoint exam (Stage 1–4).
app.post(`${BASE}/api/curriculum/:lang/checkpoint/:cid`, _requireUserCur, async (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const cid = String(req.params.cid || "").replace(/[^a-z0-9-]/gi, "");
  const examPath = path.join(__dirname, "data", "curriculum", lang, `${cid}.json`);
  let exam;
  try { exam = JSON.parse(await fs.readFile(examPath, "utf8")); }
  catch { return res.status(404).json({ error: "checkpoint not found" }); }
  const responses = req.body?.responses || {};
  // Flatten sectioned exams into a single items array for scoring.
  const items = exam.items || (exam.sections || []).flatMap((s) => s.items || []);
  const result = scoreExam({ items }, responses);
  const passMark = exam.scoring?.pass_mark || 0.75;
  const passed = result.score >= passMark;
  const rec = recordCheckpoint(req.user.email, lang, cid, result.score, passed, responses, result.results);
  res.json({ score: result.score, passed, pass_mark: passMark, attempt_no: rec.attempt_no, results: result.results });
});

// Submit the capstone exam (Stage 5).
app.post(`${BASE}/api/curriculum/:lang/capstone`, _requireUserCur, async (req, res) => {
  const lang = String(req.params.lang || "").toLowerCase();
  if (!VALID_LANGS.includes(lang)) return res.status(404).json({ error: "unknown language" });
  const examPath = path.join(__dirname, "data", "curriculum", lang, `capstone.json`);
  let exam;
  try { exam = JSON.parse(await fs.readFile(examPath, "utf8")); }
  catch { return res.status(404).json({ error: "capstone not found" }); }

  const trackId = String(req.body?.track_id || "");
  const responses = req.body?.responses || {};
  const honorCode = !!req.body?.honor_code_accepted;
  const publicName = String(req.body?.public_name || "").trim().slice(0, 64);
  if (!honorCode) return res.status(400).json({ error: "honor_code_required" });
  if (!publicName) return res.status(400).json({ error: "public_name_required" });

  // Sectioned exam: filter items by track if any.
  const items = (exam.sections || []).flatMap((s) => s.items || [])
    .filter((it) => !it.track || it.track === trackId);
  const result = scoreExam({ items }, responses);
  const passMark = exam.scoring?.pass_mark || 0.70;
  const honorsMark = exam.scoring?.honors_mark || 0.85;
  const passed = result.score >= passMark;
  const honors = result.score >= honorsMark;

  const cap = recordCapstone(req.user.email, lang, trackId, result.score, passed, honors, responses, result.results);

  let mint = null;
  if (passed) {
    const manifest = await loadCurriculumManifest(lang);
    const tracks = manifest?.stages?.find((s) => s.tracks)?.tracks || [];
    const track = tracks.find((t) => t.id === trackId);
    try {
      mint = await mintDiploma({
        publicName,
        userEmail: req.user.email,
        lang,
        displayName: manifest?.display_name || lang,
        trackId,
        trackName: track?.name || null,
        honors,
        scriptHash: cap.script_hash,
        scorePct: result.score,
      });
      markCertMinted(req.user.email, lang, cap.attempt_no, mint.tokenId, mint.txHash);
    } catch (err) {
      console.error("diploma mint failed:", err);
      mint = { error: "mint_failed", detail: String(err.message || err) };
    }
  }

  res.json({
    score: result.score,
    passed,
    honors,
    pass_mark: passMark,
    honors_mark: honorsMark,
    attempt_no: cap.attempt_no,
    script_hash: cap.script_hash,
    diploma: mint,
    chain: mintChainName(),
    chain_live: mintIsLive(),
  });
});

// Public verify endpoint — anyone can look up a diploma by token id.
app.get(`${BASE}/api/verify/:tokenId`, (req, res) => {
  const tokenId = String(req.params.tokenId || "").replace(/[^0-9a-fA-F]/g, "");
  if (!tokenId) return res.status(400).json({ error: "bad token id" });
  let row = null;
  try { row = getCertByTokenId(tokenId); } catch {}
  // If no DB row, fall back to on-disk cert record (covers dry-run mints
  // and certs produced before the verify endpoint indexed them).
  if (!row) {
    const certFile = path.join(__dirname, "data", "curriculum", "certs", `${tokenId}.json`);
    return fs.readFile(certFile, "utf8").then((raw) => {
      const rec = JSON.parse(raw);
      res.json({
        token_id: tokenId,
        chain: rec.chain,
        contract: rec.contract,
        tx_hash: rec.txHash,
        minted_at: rec.mintedAt,
        public_name: rec.publicName,
        language: rec.displayName,
        track: rec.trackName,
        honors: rec.honors,
        score_pct: rec.scorePct,
        script_hash: rec.scriptHash,
        metadata: rec.metadata,
      });
    }).catch(() => res.status(404).json({ error: "not_found" }));
  }
  // Re-load the IPFS-pinned (or local-dry-run) record for full metadata.
  const certFile = path.join(__dirname, "data", "curriculum", "certs", `${tokenId}.json`);
  fs.readFile(certFile, "utf8").then((raw) => {
    const rec = JSON.parse(raw);
    res.json({
      token_id: tokenId,
      chain: rec.chain,
      contract: rec.contract,
      tx_hash: rec.txHash,
      minted_at: rec.mintedAt,
      public_name: rec.publicName,
      language: rec.displayName,
      track: rec.trackName,
      honors: rec.honors,
      score_pct: rec.scorePct,
      script_hash: rec.scriptHash,
      metadata: rec.metadata,
    });
  }).catch(() => {
    // Fall back to just the DB record if the on-disk metadata is missing.
    res.json({
      token_id: tokenId,
      language: row.lang,
      track: row.track_id,
      honors: !!row.honors,
      score_pct: row.score,
      minted_at: row.cert_minted_at,
      tx_hash: row.cert_tx_hash,
      script_hash: row.script_hash,
    });
  });
});

// Curriculum tab page (delegates rendering to language.html — same shell).
for (const lang of VALID_LANGS) {
  // The curriculum is a SEPARATE section from the rest of Kalopaideia.
  // Its own page, its own design, its own bar at the top.
  app.get(`${BASE}/${lang}/curriculum`, (_req, res) => res.sendFile(path.join(deployedDir, "curriculum.html")));
  app.get(`${BASE}/${lang}/curriculum/:lessonId`, (_req, res) => res.sendFile(path.join(deployedDir, "lesson.html")));
  app.get(`${BASE}/${lang}/capstone`, (_req, res) => res.sendFile(path.join(deployedDir, "capstone.html")));
}

app.get(`${BASE}/verify`, (_req, res) => res.sendFile(path.join(deployedDir, "verify.html")));
app.get(`${BASE}/verify/:tokenId`, (_req, res) => res.sendFile(path.join(deployedDir, "verify.html")));

app.listen(PORT, () => console.log(`Kalopaideia on :${PORT}${BASE}`));
