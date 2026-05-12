import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { lookupWord } from "./pipeline/word-lookup.js";
import { buildCommerce } from "./lib/commerce.js";
import {
  hasStoaAccess,
  getAnalyticsPrefs,
  setAnalyticsPrefs,
  isAnalyticsAllowed,
  upsertAnalyticsSession,
  insertAnalyticsEvents,
  purgeAnalyticsForUser,
  exportAnalyticsForUser,
} from "./lib/commerce-db.js";
import { stoaById } from "./lib/commerce-catalog.js";

// Per Jae 2026-05-09: subscription pricing is $11.99/mo for both sites.
// Paideia's audio/library content can be paywalled with the same
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
  return { status: 402, body: { error: "subscription_required", work_id: work.id, all_access_url: `${BASE}/store/${encodeURIComponent(work.id)}` } };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3026;
const BASE = "/paideia";

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

// Library API: total count of audio works across the entire AKOUSMA corpus.
// Excludes any *.backup-*.json snapshots. Per Jae 2026-05-09 — the count
// is fetched live by the front-end so it updates automatically as new
// works are added to data/library/.
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
  if (!req.user) return res.json({ user: null });
  const prefs = getAnalyticsPrefs(req.user.id);
  res.json({
    user: { id: req.user.id, display_name: req.user.display_name || null },
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

app.get(`${BASE}/api/analytics/export`, _requireUser, (req, res) => {
  const data = exportAnalyticsForUser(req.user.id);
  res.setHeader("Content-Disposition", `attachment; filename="analytics-${req.user.id}.json"`);
  res.json(data);
});

app.delete(`${BASE}/api/analytics/data`, _requireUser, (req, res) => {
  purgeAnalyticsForUser(req.user.id);
  res.status(204).end();
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

// Category landing pages (Celtic, Germanic) — Option C: categories live
// as their own URLs but the languages under them remain flat.
for (const cat of VALID_CATEGORIES) {
  app.get(`${BASE}/${cat}`, (_req, res) => res.sendFile(path.join(__dirname, "public", "category.html")));
  app.get(`${BASE}/${cat}/`, (_req, res) => res.sendFile(path.join(__dirname, "public", "category.html")));
}

// Category API — returns metadata + child-language summaries for rendering
// the landing page.
app.get(`${BASE}/api/category/:slug`, async (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase();
  const cat = CATEGORIES[slug];
  if (!cat) return res.status(404).json({ error: "Unknown category." });
  res.json(cat);
});

app.listen(PORT, () => console.log(`Paideia on :${PORT}${BASE}`));
