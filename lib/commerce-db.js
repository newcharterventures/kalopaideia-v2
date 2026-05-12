// lib/commerce-db.js — Kalopaideia's view of the SHARED accounts DB.
//
// Identical schema to the Mansion's shared db. We open the SAME file at
// /home/jae/.openclaw/workspace/mansion/data/shared/accounts.db so a user
// who buys at one site has those entitlements at the other site.
//
// SQLite is safe for two writers via WAL mode (which we use). For higher
// scale, migrate to one Postgres with two schemas later.

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const SHARED_DB_PATH = process.env.MANSION_ACCOUNTS_DB
  || "/home/jae/.openclaw/workspace/mansion/data/shared/accounts.db";

if (!fs.existsSync(SHARED_DB_PATH)) {
  console.warn(`[commerce-db] shared DB not found at ${SHARED_DB_PATH}; commerce will be disabled until it exists`);
}

let _db = null;
function db() {
  if (_db) return _db;
  _db = new Database(SHARED_DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("synchronous = NORMAL");
  return _db;
}

// ─── helpers (mirror Mansion's lib/db.js exports) ───
export function findOrCreateUser({ id, email, display_name }) {
  const existing = db().prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (existing) {
    if (existing.email !== email || existing.display_name !== display_name) {
      db().prepare("UPDATE users SET email = ?, display_name = ?, last_seen_at = datetime('now') WHERE id = ?")
        .run(email, display_name || existing.display_name, id);
    } else {
      db().prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(id);
    }
    return existing;
  }
  db().prepare(`INSERT INTO users (id, email, display_name, last_seen_at) VALUES (?, ?, ?, datetime('now'))`)
    .run(id, email, display_name || null);
  // gateway book: same as Mansion
  db().prepare(`INSERT OR IGNORE INTO holdings (user_id, product_kind, product_id) VALUES (?, 'stoa_book', 'odyssey-book-1')`)
    .run(id);
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function getUser(userId) {
  if (!userId) return null;
  const u = db().prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!u) return null;
  const sub = db().prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
  return {
    ...u,
    sub_status: sub?.status || null,
    sub_tier: sub?.tier || null,
    sub_period_end: sub?.current_period_end || null,
    stripe_subscription_id: sub?.stripe_subscription_id || null,
  };
}

export function userOwns(userId, kind, id) {
  if (!userId) return false;
  return !!db().prepare("SELECT 1 FROM holdings WHERE user_id = ? AND product_kind = ? AND product_id = ?")
    .get(userId, kind, id);
}

export function hasStoaAccess(user, book) {
  if (!user) return book?.is_gateway === true;
  if (book?.is_gateway) return true;
  if (userOwns(user.id, "stoa_book", book.id)) return true;
  if (user.sub_status === "active") return true;
  return false;
}

export function listHoldings(userId) {
  if (!userId) return [];
  return db().prepare("SELECT * FROM holdings WHERE user_id = ? ORDER BY acquired_at DESC").all(userId);
}

export function grantHolding(userId, kind, id) {
  db().prepare(`INSERT OR IGNORE INTO holdings (user_id, product_kind, product_id) VALUES (?, ?, ?)`)
    .run(userId, kind, id);
}

export function setStripeCustomer(userId, stripeCustomerId) {
  db().prepare(`
    INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id
  `).run(userId, stripeCustomerId);
}

export function getStripeCustomer(userId) {
  if (!userId) return null;
  return db().prepare("SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?").get(userId)?.stripe_customer_id || null;
}

export function getHolding(userId, kind, id) {
  if (!userId) return null;
  return db().prepare(
    "SELECT * FROM holdings WHERE user_id = ? AND product_kind = ? AND product_id = ?"
  ).get(userId, kind, id) || null;
}

export function saveReadingProgress(userId, kind, id, { cfi = null, progressPct = null } = {}) {
  if (!userId) return false;
  const sets = ["last_read_at = datetime('now')"];
  const vals = [];
  if (cfi != null)         { sets.push("last_cfi = ?");      vals.push(cfi); }
  if (progressPct != null) { sets.push("progress_pct = ?");  vals.push(progressPct); }
  vals.push(userId, kind, id);
  const sql = `UPDATE holdings SET ${sets.join(', ')} WHERE user_id = ? AND product_kind = ? AND product_id = ?`;
  const r = db().prepare(sql).run(...vals);
  return r.changes > 0;
}

export function setSubscription({ userId, stripe_subscription_id, status, tier, current_period_end, cancel_at_period_end }) {
  db().prepare(`
    INSERT INTO subscriptions (user_id, stripe_subscription_id, status, tier, current_period_end, cancel_at_period_end, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_subscription_id = excluded.stripe_subscription_id,
      status                 = excluded.status,
      tier                   = excluded.tier,
      current_period_end     = excluded.current_period_end,
      cancel_at_period_end   = excluded.cancel_at_period_end,
      updated_at             = datetime('now')
  `).run(userId, stripe_subscription_id, status, tier, current_period_end, cancel_at_period_end ? 1 : 0);
}

export function isStripeEventSeen(eventId) {
  return !!db().prepare("SELECT 1 FROM stripe_events WHERE id = ?").get(eventId);
}

export function markStripeEventSeen(eventId, type) {
  db().prepare("INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)").run(eventId, type);
}

// ─────────────────────────────────────────────────────────────────
// Analytics — helpers (Jae 2026-05-12).
// Mirrors mansion/lib/db.js. Same schema is created by the Mansion server
// on its boot (it owns the canonical schema); we just read/write here.
// If the analytics_* tables are missing (Mansion hasn't booted yet), each
// helper degrades to a no-op or empty result without throwing.
// ─────────────────────────────────────────────────────────────────

function _hasAnalyticsTables() {
  try {
    return !!db().prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='analytics_prefs'"
    ).get();
  } catch { return false; }
}

export function getAnalyticsPrefs(userId) {
  if (!userId || !_hasAnalyticsTables()) return { tracking_enabled: true, daily_goal_minutes: 30, banner_dismissed_at: null };
  const row = db().prepare(
    'SELECT tracking_enabled, daily_goal_minutes, banner_dismissed_at FROM analytics_prefs WHERE user_id = ?'
  ).get(userId);
  if (row) {
    return {
      tracking_enabled: !!row.tracking_enabled,
      daily_goal_minutes: row.daily_goal_minutes,
      banner_dismissed_at: row.banner_dismissed_at,
    };
  }
  return { tracking_enabled: true, daily_goal_minutes: 30, banner_dismissed_at: null };
}

export function setAnalyticsPrefs(userId, patch = {}) {
  if (!userId || !_hasAnalyticsTables()) return;
  const existing = db().prepare(
    'SELECT user_id FROM analytics_prefs WHERE user_id = ?'
  ).get(userId);
  if (!existing) {
    db().prepare(`
      INSERT INTO analytics_prefs (user_id, tracking_enabled, daily_goal_minutes, banner_dismissed_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      userId,
      patch.tracking_enabled === false ? 0 : 1,
      Number.isFinite(patch.daily_goal_minutes) ? patch.daily_goal_minutes : 30,
      patch.banner_dismissed_at || null,
    );
    return;
  }
  const sets = [];
  const args = [];
  if (typeof patch.tracking_enabled === 'boolean') {
    sets.push('tracking_enabled = ?'); args.push(patch.tracking_enabled ? 1 : 0);
  }
  if (Number.isFinite(patch.daily_goal_minutes)) {
    sets.push('daily_goal_minutes = ?'); args.push(patch.daily_goal_minutes);
  }
  if (patch.banner_dismissed_at !== undefined) {
    sets.push('banner_dismissed_at = ?'); args.push(patch.banner_dismissed_at);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  args.push(userId);
  db().prepare(`UPDATE analytics_prefs SET ${sets.join(', ')} WHERE user_id = ?`).run(...args);
}

export function isAnalyticsAllowed(userId, dntHeader) {
  if (!userId) return false;
  if (dntHeader === '1') return false;
  const prefs = getAnalyticsPrefs(userId);
  return prefs ? prefs.tracking_enabled : true;
}

export function upsertAnalyticsSession(userId, row) {
  if (!userId || !_hasAnalyticsTables() || !row || !row.id || !row.site || !row.started_at) return;
  db().prepare(`
    INSERT INTO analytics_sessions (
      id, user_id, site, surface, context_id,
      started_at, ended_at, duration_ms,
      pages_turned, words_read, device, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      surface       = COALESCE(excluded.surface,       analytics_sessions.surface),
      context_id    = COALESCE(excluded.context_id,    analytics_sessions.context_id),
      ended_at      = COALESCE(excluded.ended_at,      analytics_sessions.ended_at),
      duration_ms   = COALESCE(excluded.duration_ms,   analytics_sessions.duration_ms),
      pages_turned  = MAX(analytics_sessions.pages_turned, excluded.pages_turned),
      words_read    = MAX(analytics_sessions.words_read,   excluded.words_read),
      device        = COALESCE(excluded.device,        analytics_sessions.device),
      user_agent    = COALESCE(excluded.user_agent,    analytics_sessions.user_agent)
    WHERE analytics_sessions.user_id = excluded.user_id
  `).run(
    String(row.id), userId, String(row.site), row.surface || null, row.context_id || null,
    String(row.started_at), row.ended_at || null,
    Number.isFinite(row.duration_ms) ? row.duration_ms : null,
    Math.max(0, Math.floor(row.pages_turned || 0)),
    Math.max(0, Math.floor(row.words_read || 0)),
    row.device || null, row.user_agent || null,
  );
}

export function insertAnalyticsEvents(userId, events) {
  if (!userId || !_hasAnalyticsTables() || !Array.isArray(events) || events.length === 0) return 0;
  const stmt = db().prepare(`
    INSERT INTO analytics_events (user_id, session_id, site, event_type, payload, occurred_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
  `);
  const tx = db().transaction((rows) => {
    for (const e of rows) {
      if (!e || typeof e !== 'object') continue;
      if (!e.site || !e.event_type) continue;
      stmt.run(
        userId,
        e.session_id || null,
        String(e.site),
        String(e.event_type).slice(0, 64),
        e.payload != null ? JSON.stringify(e.payload).slice(0, 4000) : null,
        e.occurred_at || null,
      );
    }
  });
  tx(events);
  return events.length;
}

export function purgeAnalyticsForUser(userId) {
  if (!userId || !_hasAnalyticsTables()) return;
  const tx = db().transaction(() => {
    db().prepare('DELETE FROM analytics_events   WHERE user_id = ?').run(userId);
    db().prepare('DELETE FROM analytics_sessions WHERE user_id = ?').run(userId);
    db().prepare('DELETE FROM analytics_daily    WHERE user_id = ?').run(userId);
    db().prepare('DELETE FROM analytics_prefs    WHERE user_id = ?').run(userId);
  });
  tx();
}

export function exportAnalyticsForUser(userId) {
  if (!userId || !_hasAnalyticsTables()) return null;
  return {
    prefs: getAnalyticsPrefs(userId),
    sessions: db().prepare('SELECT * FROM analytics_sessions WHERE user_id = ? ORDER BY started_at').all(userId),
    events: db().prepare('SELECT id, session_id, site, event_type, payload, occurred_at FROM analytics_events WHERE user_id = ? ORDER BY occurred_at').all(userId),
    daily: db().prepare('SELECT * FROM analytics_daily WHERE user_id = ? ORDER BY date').all(userId),
  };
}
