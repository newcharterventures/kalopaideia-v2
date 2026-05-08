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
