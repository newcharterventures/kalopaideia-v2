// lib/curriculum.js — curriculum loader, progress tracking, and exam scoring.
//
// Each language has a manifest at data/curriculum/<lang>.json and optional
// per-lesson files at data/curriculum/<lang>/lesson-<id>.json. Progress is
// kept in the existing commerce SQLite DB (./data/sessions.db) under a new
// table `curriculum_progress` keyed by (user_email, lang, lesson_id).
//
// Capstone exams are auto-graded. Grading rubric per item type:
//   - mcq       : exact match on `answer`
//   - parse     : multi-token order-insensitive match (case + accent normalized)
//   - cloze     : exact match per blank (case + accent normalized)
//   - translate : fuzzy-match against `reference` (token Jaccard >= 0.55)
//                 plus optional `keywords` (all must appear)
//   - compose   : same as translate but Greek/Latin keywords (accent-stripped)
//
// Final score = total points earned / total points possible. Pass at the
// language's `pass_mark` (default 70%); honors at the `honors_mark`
// (default 85%). On capstone pass, an issuance event is queued for the
// on-chain mint pipeline.

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM_DIR = path.resolve(__dirname, "..", "data", "curriculum");

// Cache manifests in memory; they change rarely and never at hot path.
const _manifestCache = new Map();

export async function loadManifest(lang) {
  if (_manifestCache.has(lang)) return _manifestCache.get(lang);
  const file = path.join(CURRICULUM_DIR, `${lang}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const manifest = JSON.parse(raw);
    _manifestCache.set(lang, manifest);
    return manifest;
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function loadLesson(lang, lessonId) {
  const file = path.join(CURRICULUM_DIR, lang, `lesson-${lessonId}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// === Normalization helpers for scoring ===

// Strip Greek accents, breathings, iota subscripts; lowercase; trim.
function stripGreek(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0342\u0345]/g, "")
    .toLowerCase()
    .trim();
}

// Strip Latin macrons + accents; lowercase; trim.
function stripDiacritics(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokens(s) {
  return stripDiacritics(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 && B.size === 0) return 1;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

// === Item scoring ===

export function scoreItem(item, response) {
  // item: { type, points, answer | answers | reference | keywords }
  // response: student's string answer
  const points = Number(item.points || 1);
  const r = String(response ?? "").trim();
  if (!r) return { earned: 0, max: points, correct: false, reason: "empty" };

  switch (item.type) {
    case "mcq": {
      const correct = String(item.answer || "").trim() === r;
      return { earned: correct ? points : 0, max: points, correct };
    }
    case "parse": {
      // answer is array of tokens; order does not matter; accent-stripped match
      const expected = (item.answer || []).map((x) => stripGreek(x));
      const given = r.split(/[,;\s]+/).map(stripGreek).filter(Boolean);
      const expSet = new Set(expected);
      const givSet = new Set(given);
      const hit = [...expSet].filter((x) => givSet.has(x)).length;
      const earned = expected.length === 0 ? 0 : (hit / expected.length) * points;
      return { earned, max: points, correct: hit === expected.length && expected.length > 0 };
    }
    case "cloze": {
      // answer is array of blanks; response is array (or pipe-separated)
      const expected = (item.answer || []).map((x) => stripGreek(x));
      const parts = Array.isArray(response) ? response : r.split("|");
      const given = parts.map((x) => stripGreek(x));
      let hit = 0;
      for (let i = 0; i < expected.length; i++) {
        if (given[i] === expected[i]) hit++;
      }
      const earned = expected.length === 0 ? 0 : (hit / expected.length) * points;
      return { earned, max: points, correct: hit === expected.length && expected.length > 0 };
    }
    case "translate": {
      // reference is a string (or array of acceptable strings); keywords array all required
      const refs = Array.isArray(item.reference) ? item.reference : [item.reference];
      let best = 0;
      for (const ref of refs) {
        const j = jaccard(ref, r);
        if (j > best) best = j;
      }
      // keyword gate: every keyword must be present (token match)
      const respTokens = new Set(tokens(r));
      const kws = (item.keywords || []).map(stripDiacritics);
      const kwHit = kws.every((kw) => respTokens.has(kw));
      const passes = best >= (item.threshold || 0.55) && kwHit;
      // partial credit: scale by jaccard floor at 0.3
      const scaled = best < 0.3 ? 0 : best;
      const earned = passes ? points : Math.min(points, scaled * points);
      return { earned, max: points, correct: passes, jaccard: best };
    }
    case "compose": {
      // student writes in target language; reference is canonical answer(s)
      const refs = Array.isArray(item.reference) ? item.reference : [item.reference];
      const respStripped = stripGreek(r);
      let best = 0;
      for (const ref of refs) {
        const refStripped = stripGreek(ref);
        const j = jaccard(refStripped, respStripped);
        if (j > best) best = j;
      }
      const passes = best >= (item.threshold || 0.7);
      const earned = passes ? points : Math.min(points, best * points * 0.6);
      return { earned, max: points, correct: passes, jaccard: best };
    }
    default:
      return { earned: 0, max: points, correct: false, reason: "unknown_type" };
  }
}

export function scoreExam(exam, responses) {
  // exam.items: array of items; responses: { [itemId]: string }
  const results = [];
  let earned = 0;
  let max = 0;
  for (const item of exam.items || []) {
    const resp = responses ? responses[item.id] : undefined;
    const r = scoreItem(item, resp);
    results.push({ itemId: item.id, ...r });
    earned += r.earned;
    max += r.max;
  }
  const score = max === 0 ? 0 : earned / max;
  return { earned, max, score, results };
}

// === Progress (SQLite via better-sqlite3 instance shared with commerce-db) ===

let _db = null;

export function attachDb(db) {
  _db = db;
  _db.exec(`
    CREATE TABLE IF NOT EXISTS curriculum_progress (
      user_email TEXT NOT NULL,
      lang TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      minutes_spent INTEGER DEFAULT 0,
      PRIMARY KEY (user_email, lang, lesson_id)
    );
    CREATE TABLE IF NOT EXISTS curriculum_checkpoints (
      user_email TEXT NOT NULL,
      lang TEXT NOT NULL,
      checkpoint_id TEXT NOT NULL,
      attempt_no INTEGER NOT NULL,
      score REAL NOT NULL,
      passed INTEGER NOT NULL,
      taken_at INTEGER NOT NULL,
      responses_json TEXT,
      results_json TEXT,
      PRIMARY KEY (user_email, lang, checkpoint_id, attempt_no)
    );
    CREATE TABLE IF NOT EXISTS curriculum_capstones (
      user_email TEXT NOT NULL,
      lang TEXT NOT NULL,
      track_id TEXT,
      attempt_no INTEGER NOT NULL,
      score REAL NOT NULL,
      passed INTEGER NOT NULL,
      honors INTEGER NOT NULL,
      taken_at INTEGER NOT NULL,
      script_hash TEXT NOT NULL,
      responses_json TEXT,
      results_json TEXT,
      cert_token_id TEXT,
      cert_tx_hash TEXT,
      cert_minted_at INTEGER,
      PRIMARY KEY (user_email, lang, attempt_no)
    );
    CREATE INDEX IF NOT EXISTS idx_capstone_token ON curriculum_capstones(cert_token_id);
  `);
}

function _requireDb() {
  if (!_db) throw new Error("curriculum: DB not attached");
  return _db;
}

export function markLessonComplete(userEmail, lang, lessonId, minutes = 0) {
  const db = _requireDb();
  db.prepare(`
    INSERT INTO curriculum_progress (user_email, lang, lesson_id, completed_at, minutes_spent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_email, lang, lesson_id) DO UPDATE SET
      completed_at = excluded.completed_at,
      minutes_spent = curriculum_progress.minutes_spent + excluded.minutes_spent
  `).run(userEmail, lang, lessonId, Date.now(), Math.max(0, Math.floor(minutes)));
  return { ok: true };
}

export function getProgress(userEmail, lang) {
  const db = _requireDb();
  const rows = db.prepare(`
    SELECT lesson_id, completed_at, minutes_spent
    FROM curriculum_progress
    WHERE user_email = ? AND lang = ?
  `).all(userEmail, lang);
  const checkpoints = db.prepare(`
    SELECT checkpoint_id, MAX(attempt_no) AS attempt_no, MAX(score) AS best_score,
           MAX(passed) AS passed
    FROM curriculum_checkpoints
    WHERE user_email = ? AND lang = ?
    GROUP BY checkpoint_id
  `).all(userEmail, lang);
  const capstone = db.prepare(`
    SELECT track_id, MAX(score) AS best_score, MAX(passed) AS passed,
           MAX(honors) AS honors, MAX(cert_token_id) AS cert_token_id,
           MAX(cert_minted_at) AS cert_minted_at
    FROM curriculum_capstones
    WHERE user_email = ? AND lang = ?
  `).get(userEmail, lang);
  return {
    lessons: rows.reduce((acc, r) => { acc[r.lesson_id] = { completed_at: r.completed_at, minutes: r.minutes_spent }; return acc; }, {}),
    checkpoints: checkpoints.reduce((acc, r) => { acc[r.checkpoint_id] = { attempt_no: r.attempt_no, best_score: r.best_score, passed: !!r.passed }; return acc; }, {}),
    capstone: capstone && capstone.best_score != null ? {
      track_id: capstone.track_id,
      best_score: capstone.best_score,
      passed: !!capstone.passed,
      honors: !!capstone.honors,
      cert_token_id: capstone.cert_token_id,
      cert_minted_at: capstone.cert_minted_at,
    } : null,
  };
}

export function recordCheckpoint(userEmail, lang, checkpointId, score, passed, responses, results) {
  const db = _requireDb();
  const prev = db.prepare(`
    SELECT MAX(attempt_no) AS n FROM curriculum_checkpoints
    WHERE user_email = ? AND lang = ? AND checkpoint_id = ?
  `).get(userEmail, lang, checkpointId);
  const attempt_no = (prev?.n || 0) + 1;
  db.prepare(`
    INSERT INTO curriculum_checkpoints
      (user_email, lang, checkpoint_id, attempt_no, score, passed, taken_at, responses_json, results_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userEmail, lang, checkpointId, attempt_no, score, passed ? 1 : 0, Date.now(),
          JSON.stringify(responses || {}), JSON.stringify(results || []));
  return { attempt_no };
}

export function recordCapstone(userEmail, lang, trackId, score, passed, honors, responses, results) {
  const db = _requireDb();
  const prev = db.prepare(`
    SELECT MAX(attempt_no) AS n FROM curriculum_capstones
    WHERE user_email = ? AND lang = ?
  `).get(userEmail, lang);
  const attempt_no = (prev?.n || 0) + 1;
  const script_hash = crypto.createHash("sha256")
    .update(JSON.stringify({ userEmail, lang, trackId, responses, ts: Date.now() }))
    .digest("hex");
  db.prepare(`
    INSERT INTO curriculum_capstones
      (user_email, lang, track_id, attempt_no, score, passed, honors, taken_at, script_hash, responses_json, results_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userEmail, lang, trackId || null, attempt_no, score, passed ? 1 : 0, honors ? 1 : 0,
          Date.now(), script_hash, JSON.stringify(responses || {}), JSON.stringify(results || []));
  return { attempt_no, script_hash };
}

export function getCapstoneRecord(userEmail, lang) {
  const db = _requireDb();
  return db.prepare(`
    SELECT * FROM curriculum_capstones
    WHERE user_email = ? AND lang = ? AND passed = 1
    ORDER BY attempt_no DESC LIMIT 1
  `).get(userEmail, lang);
}

export function markCertMinted(userEmail, lang, attempt_no, tokenId, txHash) {
  const db = _requireDb();
  db.prepare(`
    UPDATE curriculum_capstones
    SET cert_token_id = ?, cert_tx_hash = ?, cert_minted_at = ?
    WHERE user_email = ? AND lang = ? AND attempt_no = ?
  `).run(String(tokenId), String(txHash), Date.now(), userEmail, lang, attempt_no);
  return { ok: true };
}

export function getCertByTokenId(tokenId) {
  const db = _requireDb();
  return db.prepare(`
    SELECT user_email, lang, track_id, score, honors, taken_at, script_hash,
           cert_token_id, cert_tx_hash, cert_minted_at
    FROM curriculum_capstones
    WHERE cert_token_id = ?
  `).get(String(tokenId));
}
