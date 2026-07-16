// Restart-persistent rate limiter for the audio TTS surface.
//
// Per the 2026-05-20 audio remediation plan
// (paideia/docs/AUDIO-REMEDIATION.md) and the follow-up review:
// "Every cost ceiling is only as real as the database table behind it."
//
// V1 of this module used in-memory Maps, which reset on every
// `systemctl restart paideia`. V2 (this file) persists to SQLite so
// the caps survive restarts. SQLite is overkill at our scale but it's
// already in the project (better-sqlite3) and the alternative —
// trusting Postgres for a per-request hot path — is worse.
//
// Tables (created on first import):
//   audio_daily(ip, day, total, misses)         PRIMARY KEY (ip, day)
//   audio_burst(ip, window_start, misses)       PRIMARY KEY (ip, window_start)
//   audio_global(day, misses)                   PRIMARY KEY (day)
//
// Counters reset by date-bucket, not by sliding TTL. A "day" is UTC
// YYYY-MM-DD. A "burst window" is the 10-minute slot the request fell
// into. Reads are O(1) (PK lookups). Writes are UPSERTs.
//
// Old rows are pruned by a daily sweeper (entries older than 7 days).
//
// Bypass: set `AUDIO_BYPASS_TOKEN` env var and send `X-Audio-Bypass`
// header matching it. For admin scripts and regression tests.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "audio-rate-limit.db");

// Caps. Tuned to be invisible to humans, deadly to bots.
const PER_IP_DAILY_TOTAL = 200;        // total requests (cache hit OR miss)
const PER_IP_DAILY_MISSES = 30;        // synth requests only
const PER_IP_BURST_MISSES = 10;        // synth requests / 10 min
const GLOBAL_DAILY_MISSES = 500;       // synth requests / day, all IPs

const TEN_MIN_SEC = 10 * 60;

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS audio_daily (
    ip TEXT NOT NULL,
    day TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    misses INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip, day)
  );

  CREATE TABLE IF NOT EXISTS audio_burst (
    ip TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    misses INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip, window_start)
  );

  CREATE TABLE IF NOT EXISTS audio_global (
    day TEXT PRIMARY KEY,
    misses INTEGER NOT NULL DEFAULT 0
  );
`);

const stmtGetDaily = db.prepare(`SELECT total, misses FROM audio_daily WHERE ip = ? AND day = ?`);
const stmtUpsertDaily = db.prepare(`
  INSERT INTO audio_daily (ip, day, total, misses) VALUES (?, ?, ?, ?)
  ON CONFLICT (ip, day) DO UPDATE SET
    total = total + excluded.total,
    misses = misses + excluded.misses
`);
const stmtGetBurst = db.prepare(`SELECT misses FROM audio_burst WHERE ip = ? AND window_start = ?`);
const stmtUpsertBurst = db.prepare(`
  INSERT INTO audio_burst (ip, window_start, misses) VALUES (?, ?, ?)
  ON CONFLICT (ip, window_start) DO UPDATE SET misses = misses + excluded.misses
`);
const stmtGetGlobal = db.prepare(`SELECT misses FROM audio_global WHERE day = ?`);
const stmtUpsertGlobal = db.prepare(`
  INSERT INTO audio_global (day, misses) VALUES (?, ?)
  ON CONFLICT (day) DO UPDATE SET misses = misses + excluded.misses
`);
const stmtSweepDaily = db.prepare(`DELETE FROM audio_daily WHERE day < ?`);
const stmtSweepBurst = db.prepare(`DELETE FROM audio_burst WHERE window_start < ?`);
const stmtSweepGlobal = db.prepare(`DELETE FROM audio_global WHERE day < ?`);

function today() {
  return new Date().toISOString().slice(0, 10);
}
function burstWindow() {
  return Math.floor(Date.now() / 1000 / TEN_MIN_SEC) * TEN_MIN_SEC;
}
function secondsUntilTomorrow() {
  const now = new Date();
  const t = new Date(now);
  t.setUTCDate(t.getUTCDate() + 1);
  t.setUTCHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((t.getTime() - now.getTime()) / 1000));
}
function secondsUntilNextBurst() {
  const next = (burstWindow() + TEN_MIN_SEC) * 1000;
  return Math.max(1, Math.ceil((next - Date.now()) / 1000));
}

function isBypassed(req) {
  const tok = process.env.AUDIO_BYPASS_TOKEN;
  return !!(tok && req && req.get && req.get("x-audio-bypass") === tok);
}

export function checkAudioRequest(req) {
  if (isBypassed(req)) return { ok: true, bypass: true };
  const ip = req.ip || "unknown";
  const row = stmtGetDaily.get(ip, today()) || { total: 0, misses: 0 };
  if (row.total >= PER_IP_DAILY_TOTAL) {
    return {
      ok: false,
      status: 429,
      reason: "per_ip_daily_total",
      retryAfterSec: secondsUntilTomorrow(),
    };
  }
  return { ok: true };
}

export function checkAudioSynth(req) {
  if (isBypassed(req)) return { ok: true, bypass: true };

  const day = today();
  const ip = req.ip || "unknown";

  const g = stmtGetGlobal.get(day) || { misses: 0 };
  if (g.misses >= GLOBAL_DAILY_MISSES) {
    return {
      ok: false,
      status: 503,
      reason: "global_daily_synth",
      retryAfterSec: secondsUntilTomorrow(),
    };
  }

  const d = stmtGetDaily.get(ip, day) || { total: 0, misses: 0 };
  if (d.misses >= PER_IP_DAILY_MISSES) {
    return {
      ok: false,
      status: 429,
      reason: "per_ip_daily_synth",
      retryAfterSec: secondsUntilTomorrow(),
    };
  }

  const b = stmtGetBurst.get(ip, burstWindow()) || { misses: 0 };
  if (b.misses >= PER_IP_BURST_MISSES) {
    return {
      ok: false,
      status: 429,
      reason: "per_ip_burst_synth",
      retryAfterSec: secondsUntilNextBurst(),
    };
  }

  return { ok: true };
}

export function recordAudioRequest(req, { synth }) {
  if (isBypassed(req)) return;
  const ip = req.ip || "unknown";
  const day = today();
  stmtUpsertDaily.run(ip, day, 1, synth ? 1 : 0);
  if (synth) {
    stmtUpsertBurst.run(ip, burstWindow(), 1);
    stmtUpsertGlobal.run(day, 1);
  }
}

// Backward-compat alias for the old in-memory API.
// Bumped from 200 → 800 chars 2026-05-21 to accommodate In Literature
// citation passages (Iliad/Aeneid lines etc.), which are LLM-curated
// editorial text and routinely run 300–500 chars. 800 is the comfortable
// upper bound — long enough for any citation we'd ship, short enough that
// abuse damage is still bounded (800 chars × 30 synths/IP/day = 24KB of
// TTS input per IP, ~$0.0004/day at Azure neural rates).
export function validateAudioInput(rawWord) {
  if (typeof rawWord !== "string") return { status: 400, error: "invalid_input" };
  const w = rawWord.trim();
  if (!w) return { status: 400, error: "empty_input" };
  if (w.length > 800) return { status: 413, error: "input_too_long" };
  if (/[\x00-\x08\x0b-\x1f\x7f]/.test(w)) return { status: 400, error: "invalid_chars" };
  return null;
}

export function getAudioRateLimitStats() {
  const day = today();
  const g = stmtGetGlobal.get(day) || { misses: 0 };
  const ipCount = db.prepare(`SELECT COUNT(*) AS n FROM audio_daily WHERE day = ?`).get(day).n;
  const burstCount = db.prepare(`SELECT COUNT(*) AS n FROM audio_burst WHERE window_start >= ?`).get(burstWindow() - TEN_MIN_SEC).n;
  return {
    day,
    perIpEntriesToday: ipCount,
    burstEntriesActive: burstCount,
    globalMissesToday: g.misses,
    limits: {
      PER_IP_DAILY_TOTAL,
      PER_IP_DAILY_MISSES,
      PER_IP_BURST_MISSES,
      GLOBAL_DAILY_MISSES,
    },
    dbPath: DB_PATH,
  };
}

// Daily sweep: drop rows older than 7 days (cheap to run, keeps DB tiny).
function sweep() {
  const cutoffDay = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoffBurst = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  try {
    stmtSweepDaily.run(cutoffDay);
    stmtSweepBurst.run(cutoffBurst);
    stmtSweepGlobal.run(cutoffDay);
  } catch (e) {
    console.error("[rate-limit-audio sweep]", e.message);
  }
}
setInterval(sweep, 6 * 60 * 60 * 1000).unref();
sweep();
