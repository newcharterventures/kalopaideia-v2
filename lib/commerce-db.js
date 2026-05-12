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

// Dashboard summary — mirrors mansion/lib/db.js. Same DB, same logic.
// See that file for full schema documentation.
export function getAnalyticsSummary(userId, opts = {}) {
  if (!userId || !_hasAnalyticsTables()) return null;
  const site = opts.site && ['paideia','mansion'].includes(opts.site) ? opts.site : null;
  const days = Math.max(1, Math.min(365, Math.floor(opts.days || 30)));
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1)));
  const fromIso = from.toISOString();
  const siteFilter = site ? 'AND site = ?' : '';
  const siteArgs   = site ? [site] : [];

  const sessionRows = db().prepare(`
    SELECT id, site, surface, context_id, started_at, ended_at, duration_ms,
           pages_turned, words_read, device, user_agent
    FROM analytics_sessions
    WHERE user_id = ? AND started_at >= ? ${siteFilter}
    ORDER BY started_at
  `).all(userId, fromIso, ...siteArgs);

  const dailyMap = new Map();
  let totalMinutes = 0, totalPages = 0, totalWords = 0;
  const hourCounts = new Array(24).fill(0);
  const deviceCounts = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  const surfaceMap = new Map();
  const contextMap = new Map();

  for (const s of sessionRows) {
    const date = (s.started_at || '').slice(0, 10);
    const minutes = (s.duration_ms || 0) / 60000;
    const pages = s.pages_turned || 0;
    const words = s.words_read || 0;
    totalMinutes += minutes;
    totalPages   += pages;
    totalWords   += words;
    const d = dailyMap.get(date) || { date, minutes: 0, pages: 0, words: 0, sessions: 0 };
    d.minutes += minutes; d.pages += pages; d.words += words; d.sessions += 1;
    dailyMap.set(date, d);
    try { hourCounts[new Date(s.started_at).getUTCHours()] += 1; } catch {}
    const dev = (s.device && deviceCounts[s.device] !== undefined) ? s.device : 'unknown';
    deviceCounts[dev] += 1;
    if (s.surface) {
      const v = surfaceMap.get(s.surface) || { surface: s.surface, sessions: 0, minutes: 0 };
      v.sessions += 1; v.minutes += minutes;
      surfaceMap.set(s.surface, v);
    }
    if (s.context_id) {
      const k = `${s.surface || ''}|${s.context_id}`;
      const v = contextMap.get(k) || { surface: s.surface, context_id: s.context_id, sessions: 0, minutes: 0 };
      v.sessions += 1; v.minutes += minutes;
      contextMap.set(k, v);
    }
  }

  const daily = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i));
    const iso = d.toISOString().slice(0, 10);
    const row = dailyMap.get(iso) || { date: iso, minutes: 0, pages: 0, words: 0, sessions: 0 };
    row.minutes = Math.round(row.minutes);
    daily.push(row);
  }

  const activeDates = new Set([...dailyMap.keys()].filter((d) => (dailyMap.get(d)?.sessions || 0) > 0));
  function utcDateMinusDays(n) {
    const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - n * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }
  let currentStreak = 0;
  if (activeDates.has(todayIso) || activeDates.has(utcDateMinusDays(1))) {
    let offset = activeDates.has(todayIso) ? 0 : 1;
    while (activeDates.has(utcDateMinusDays(offset))) { currentStreak += 1; offset += 1; }
  }
  let longestStreak = 0;
  {
    const allDatesRows = db().prepare(`
      SELECT DISTINCT substr(started_at, 1, 10) AS date
      FROM analytics_sessions
      WHERE user_id = ? ${siteFilter}
      ORDER BY date
    `).all(userId, ...siteArgs);
    const allDates = allDatesRows.map((r) => r.date);
    let run = allDates.length ? 1 : 0;
    for (let i = 1; i < allDates.length; i++) {
      const diff = (Date.parse(allDates[i] + 'T00:00:00Z') - Date.parse(allDates[i - 1] + 'T00:00:00Z')) / 86400000;
      if (diff === 1) run += 1;
      else { longestStreak = Math.max(longestStreak, run); run = 1; }
    }
    longestStreak = Math.max(longestStreak, run);
  }

  const todayRow = daily[daily.length - 1] || { minutes: 0, pages: 0, words: 0, sessions: 0 };
  const prefs = getAnalyticsPrefs(userId) || { daily_goal_minutes: 30 };
  const goal = Math.max(1, prefs.daily_goal_minutes || 30);
  const todayPct = Math.min(100, Math.round((todayRow.minutes / goal) * 100));

  const totalSessions = sessionRows.length;
  const closedSessions = sessionRows.filter((s) => s.duration_ms).length;
  const avgMinutes = closedSessions ? totalMinutes / closedSessions : 0;
  const avgPages   = closedSessions ? totalPages   / closedSessions : 0;
  const wpm        = totalMinutes > 0 ? totalWords / totalMinutes : 0;

  const topEventTypes = db().prepare(`
    SELECT event_type, COUNT(*) AS count
    FROM analytics_events
    WHERE user_id = ? AND occurred_at >= ? ${siteFilter}
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT 12
  `).all(userId, fromIso, ...siteArgs);

  const surfaces = Array.from(surfaceMap.values())
    .sort((a, b) => b.minutes - a.minutes).slice(0, 10)
    .map((v) => ({ ...v, minutes: Math.round(v.minutes) }));
  const contexts = Array.from(contextMap.values())
    .sort((a, b) => b.minutes - a.minutes).slice(0, 10)
    .map((v) => ({ ...v, minutes: Math.round(v.minutes) }));

  return {
    range: { from: fromIso, to: today.toISOString(), days },
    site: site || 'all',
    totals: {
      sessions: totalSessions,
      total_minutes: Math.round(totalMinutes),
      pages_read: totalPages,
      words_read: totalWords,
    },
    today: {
      minutes: todayRow.minutes, pages: todayRow.pages,
      words: todayRow.words, sessions: todayRow.sessions,
      goal_minutes: goal, pct: todayPct,
    },
    streak: { current: currentStreak, longest: longestStreak },
    daily,
    averages: {
      minutes_per_session: Math.round(avgMinutes),
      pages_per_session: Math.round(avgPages),
      words_per_minute: Math.round(wpm),
    },
    top: { surfaces, contexts, event_types: topEventTypes },
    device_split: deviceCounts,
    by_hour: hourCounts.map((sessions, hour) => ({ hour, sessions })),
  };
}

// Admin-only sitewide summary — mirrors mansion/lib/db.js.
export function getAdminAnalyticsSummary(opts = {}) {
  if (!_hasAnalyticsTables()) return null;
  const site = opts.site && ['paideia','mansion'].includes(opts.site) ? opts.site : null;
  const days = Math.max(1, Math.min(365, Math.floor(opts.days || 30)));
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const fromIso = from.toISOString();
  const siteFilter = site ? 'AND site = ?' : '';
  const siteArgs   = site ? [site] : [];

  function activeUsersInLast(n) {
    const since = new Date(Date.now() - n * 86400000).toISOString();
    const r = db().prepare(`
      SELECT COUNT(DISTINCT user_id) AS n
      FROM analytics_sessions
      WHERE started_at >= ? ${siteFilter}
    `).get(since, ...siteArgs);
    return r?.n || 0;
  }
  const dau = activeUsersInLast(1);
  const wau = activeUsersInLast(7);
  const mau = activeUsersInLast(30);

  const totalUsersR = db().prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM analytics_sessions ${site ? 'WHERE site = ?' : ''}`).get(...siteArgs);
  const totalAccountsR = db().prepare(`SELECT COUNT(*) AS n FROM users`).get();
  const optedOutR = db().prepare(`SELECT COUNT(*) AS n FROM analytics_prefs WHERE tracking_enabled = 0`).get();

  const dailyRows = db().prepare(`
    SELECT substr(started_at, 1, 10) AS date,
           COUNT(DISTINCT user_id) AS users,
           COUNT(*) AS sessions,
           ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0) AS minutes,
           SUM(COALESCE(pages_turned, 0)) AS pages,
           SUM(COALESCE(words_read, 0)) AS words
    FROM analytics_sessions
    WHERE started_at >= ? ${siteFilter}
    GROUP BY date
    ORDER BY date
  `).all(fromIso, ...siteArgs);
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const daily = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i));
    const iso = d.toISOString().slice(0, 10);
    const row = dailyMap.get(iso);
    daily.push(row ? { ...row, minutes: Number(row.minutes) || 0 }
      : { date: iso, users: 0, sessions: 0, minutes: 0, pages: 0, words: 0 });
  }

  const cohortRows = db().prepare(`
    WITH first_sess AS (
      SELECT user_id, MIN(started_at) AS first_at FROM analytics_sessions
      ${site ? 'WHERE site = ?' : ''} GROUP BY user_id
    ),
    cohort AS (
      SELECT user_id, strftime('%Y-%W', first_at) AS cohort_week, first_at FROM first_sess
    )
    SELECT cohort_week,
           COUNT(*) AS new_users,
           SUM(CASE WHEN EXISTS (
             SELECT 1 FROM analytics_sessions s
             WHERE s.user_id = cohort.user_id
               AND s.started_at >= datetime(cohort.first_at, '+7 days')
               AND s.started_at <  datetime(cohort.first_at, '+14 days')
               ${site ? 'AND s.site = ?' : ''}
           ) THEN 1 ELSE 0 END) AS returned_w2
    FROM cohort GROUP BY cohort_week ORDER BY cohort_week DESC LIMIT 8
  `).all(...(site ? [site, site] : []));
  const cohorts = cohortRows.reverse().map((r) => ({
    cohort_week: r.cohort_week,
    new_users: r.new_users || 0,
    returned_w2: r.returned_w2 || 0,
    retention_pct: r.new_users ? Math.round((r.returned_w2 / r.new_users) * 100) : 0,
  }));

  const topContexts = db().prepare(`
    SELECT surface, context_id,
           COUNT(DISTINCT user_id) AS users,
           COUNT(*) AS sessions,
           ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0) AS minutes
    FROM analytics_sessions
    WHERE context_id IS NOT NULL AND started_at >= ? ${siteFilter}
    GROUP BY surface, context_id
    ORDER BY users DESC, minutes DESC
    LIMIT 20
  `).all(fromIso, ...siteArgs);

  const topSurfaces = db().prepare(`
    SELECT surface,
           COUNT(DISTINCT user_id) AS users,
           COUNT(*) AS sessions,
           ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0) AS minutes,
           ROUND(AVG(COALESCE(duration_ms, 0)) / 60000.0, 1) AS avg_minutes
    FROM analytics_sessions
    WHERE surface IS NOT NULL AND started_at >= ? ${siteFilter}
    GROUP BY surface ORDER BY users DESC
  `).all(fromIso, ...siteArgs);

  const dropoff = topSurfaces.filter((s) => s.sessions >= 5)
    .slice().sort((a, b) => (a.avg_minutes || 0) - (b.avg_minutes || 0)).slice(0, 5);

  const eventMix = db().prepare(`
    SELECT event_type, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
    FROM analytics_events
    WHERE occurred_at >= ? ${siteFilter}
    GROUP BY event_type ORDER BY count DESC LIMIT 12
  `).all(fromIso, ...siteArgs);

  const deviceRows = db().prepare(`
    SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS n
    FROM analytics_sessions WHERE started_at >= ? ${siteFilter} GROUP BY device
  `).all(fromIso, ...siteArgs);
  const deviceSplit = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  for (const r of deviceRows) deviceSplit[r.device] = r.n;

  const hourRows = db().prepare(`
    SELECT CAST(strftime('%H', started_at) AS INTEGER) AS hour, COUNT(*) AS sessions
    FROM analytics_sessions WHERE started_at >= ? ${siteFilter} GROUP BY hour
  `).all(fromIso, ...siteArgs);
  const byHour = new Array(24).fill(0).map((_, h) => ({ hour: h, sessions: 0 }));
  for (const r of hourRows) if (r.hour != null) byHour[r.hour].sessions = r.sessions;

  let perSite = null;
  if (!site) {
    perSite = db().prepare(`
      SELECT site, COUNT(DISTINCT user_id) AS users, COUNT(*) AS sessions,
             ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0) AS minutes
      FROM analytics_sessions WHERE started_at >= ?
      GROUP BY site ORDER BY users DESC
    `).all(fromIso);
  }

  return {
    range: { from: fromIso, to: now.toISOString(), days },
    site: site || 'all',
    users: {
      total_accounts: totalAccountsR?.n || 0,
      active_total:   totalUsersR?.n || 0,
      opted_out:      optedOutR?.n || 0,
      dau, wau, mau,
    },
    daily, cohorts,
    top_contexts: topContexts, top_surfaces: topSurfaces,
    dropoff_surfaces: dropoff, event_mix: eventMix,
    device_split: deviceSplit, by_hour: byHour, per_site: perSite,
  };
}
