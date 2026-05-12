/*
 * analytics-dashboard.js — user-facing reading-analytics dashboard.
 * Shared between Paideia and Mansion. Reads the active site from
 * #dash-root[data-site] (set by the host HTML).
 *
 * Per Jae 2026-05-12. Mirrors the Manus reference screenshot:
 *   - Current streak / today's goal
 *   - Total / Pages / Avg session / Sessions
 *   - Reading time bar chart (7/30/all days)
 *   - Words read with "pages of a book" friendly translation
 * Adds the site-specific extras from "include all":
 *   - Top surfaces (which sections you spent time in)
 *   - Top contexts (languages / books / library texts)
 *   - Event-type breakdown
 *   - Device split
 *   - 24-hour heatmap
 *   - Privacy controls (opt-out, goal change, export, delete)
 */
(function () {
  'use strict';

  const root = document.getElementById('dash-root');
  if (!root) return;
  const SITE = root.dataset.site || 'paideia';
  const BASE = SITE === 'paideia' ? '/paideia' : '/mansion';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // --- range state (7 days / 30 days / all) ---
  // "all" maps to 365 because that's the server retention cap.
  let activeRange = 7;
  let lastData = null;

  async function loadSummary(days) {
    const r = await fetch(`${BASE}/api/analytics/summary?days=${days}`, { credentials: 'include' });
    if (r.status === 401) {
      root.innerHTML = `<div class="dash-empty"><h3>Sign in to see your reading habits.</h3><p><a class="dash-btn" href="${BASE}/account">Sign in</a></p></div>`;
      return null;
    }
    if (!r.ok) {
      root.innerHTML = `<div class="dash-empty"><h3>Could not load analytics.</h3><p class="dash-muted">Server returned ${r.status}.</p></div>`;
      return null;
    }
    return await r.json();
  }

  async function loadPrefs() {
    const r = await fetch(`${BASE}/api/analytics/prefs`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json();
  }

  // ----- Renderers -----
  function pluralize(n, single, plural) {
    return `${n} ${n === 1 ? single : (plural || single + 's')}`;
  }
  function fmtMinutes(mins) {
    if (mins < 1) return '<1m';
    if (mins < 60) return Math.round(mins) + 'm';
    const h = mins / 60;
    if (h < 10) return h.toFixed(1) + 'h';
    return Math.round(h) + 'h';
  }
  function shortDay(iso) {
    try {
      const d = new Date(iso + 'T12:00:00Z');
      return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    } catch { return iso.slice(5); }
  }
  function shortDate(iso) {
    try {
      const d = new Date(iso + 'T12:00:00Z');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch { return iso; }
  }
  function fmtNumber(n) {
    return Number(n || 0).toLocaleString();
  }

  // Bar chart SVG. Days as x-axis. Bar height proportional to minutes.
  function renderBarChart(daily, goalMinutes) {
    if (!daily.length) return '<div class="dash-muted">No reading days yet in this range.</div>';
    const max = Math.max(goalMinutes, ...daily.map((d) => d.minutes), 1);
    const W = 600, H = 180, padL = 32, padR = 32, padB = 30, padT = 12;
    const cw = W - padL - padR;
    const ch = H - padB - padT;
    const barW = Math.max(2, (cw / daily.length) - 4);
    const todayIso = new Date().toISOString().slice(0, 10);
    const bars = daily.map((d, i) => {
      const h = (d.minutes / max) * ch;
      const x = padL + i * (cw / daily.length) + 2;
      const y = padT + ch - h;
      const isToday = d.date === todayIso;
      const cls = isToday ? 'bar bar-today' : 'bar';
      return `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="1.5"><title>${shortDate(d.date)} — ${fmtMinutes(d.minutes)} · ${pluralize(d.pages,'page')}</title></rect>`;
    }).join('');
    // Goal line
    const goalY = padT + ch - (goalMinutes / max) * ch;
    const goalLine = goalMinutes < max
      ? `<line class="goal-line" x1="${padL}" y1="${goalY.toFixed(1)}" x2="${W - padR}" y2="${goalY.toFixed(1)}" stroke-dasharray="4 4"/><text x="${W - padR}" y="${(goalY - 4).toFixed(1)}" class="goal-text" text-anchor="end">Goal: ${fmtMinutes(goalMinutes)}</text>`
      : '';
    // Day labels (only at intervals for 30+ days)
    const labelEvery = daily.length <= 7 ? 1 : daily.length <= 14 ? 2 : daily.length <= 30 ? 4 : Math.ceil(daily.length / 8);
    const labels = daily.map((d, i) => {
      if (i % labelEvery !== 0 && i !== daily.length - 1) return '';
      const x = padL + i * (cw / daily.length) + barW / 2 + 2;
      const text = daily.length <= 14 ? shortDay(d.date) : shortDate(d.date);
      return `<text x="${x.toFixed(1)}" y="${(H - padB + 14).toFixed(1)}" class="bar-label" text-anchor="middle">${esc(text)}</text>`;
    }).join('');
    return `
      <svg class="bar-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily reading minutes chart">
        ${goalLine}
        ${bars}
        ${labels}
      </svg>
    `;
  }

  // 24-hour heatmap. Each hour cell shaded by relative session count.
  function renderHourlyHeatmap(byHour) {
    const max = Math.max(1, ...byHour.map((h) => h.sessions));
    const cells = byHour.map((h) => {
      const intensity = h.sessions / max;
      const opacity = (0.08 + intensity * 0.92).toFixed(2);
      return `<div class="hour-cell" style="--intensity:${opacity}" title="${h.hour}:00 UTC — ${pluralize(h.sessions, 'session')}"><span class="hour-label">${h.hour}</span></div>`;
    }).join('');
    return `<div class="hour-grid">${cells}</div><p class="dash-muted dash-small">Hours in UTC; deeper shade = more reading.</p>`;
  }

  function deviceSplitRow(split) {
    const total = Object.values(split).reduce((s, n) => s + n, 0);
    if (!total) return '<div class="dash-muted">No sessions in range.</div>';
    const order = ['mobile', 'desktop', 'tablet', 'unknown'];
    return order.map((k) => {
      const n = split[k] || 0;
      if (!n) return '';
      const pct = ((n / total) * 100).toFixed(0);
      return `<div class="device-row"><span class="device-name">${esc(k)}</span><div class="device-bar"><div class="device-fill" style="width:${pct}%"></div></div><span class="device-count">${pct}% · ${pluralize(n,'session')}</span></div>`;
    }).join('') || '<div class="dash-muted">No device data.</div>';
  }

  function topList(items, getLabel, getValue) {
    if (!items.length) return '<div class="dash-muted">No data in range.</div>';
    return '<ul class="top-list">' + items.map((it) => {
      return `<li><span class="top-label">${esc(getLabel(it))}</span><span class="top-value">${esc(getValue(it))}</span></li>`;
    }).join('') + '</ul>';
  }

  // Friendly translation: words → pages. Use 250 words/page (standard mass-market).
  function pagesFromWords(words) {
    return Math.round(words / 250);
  }

  function renderEventTypePill(et) {
    // Friendly labels for the event types analytics.js emits.
    const map = {
      session_start: 'sessions started',
      word_seen: 'daily words seen',
      word_tooltip: 'pronunciation tooltips',
      word_audio_play: 'word audio plays',
      alphabet_audio_play: 'alphabet audio plays',
      lesson_view: 'primer panes viewed',
      library_line_read: 'library lines read',
      library_line_audio_play: 'library audio plays',
      page_turn: 'page turns',
      book_open: 'books opened',
      chapter_progress: 'chapter checkpoints',
      audio_play: 'audio plays',
      nav: 'navigations',
    };
    return map[et.event_type] || et.event_type.replace(/_/g, ' ');
  }

  function renderSurfaceLabel(surface) {
    const map = {
      home: 'Home / today',
      today: 'Today',
      language: 'Language primer',
      reader: 'Reader',
      library: 'Library',
      category: 'Category landing',
      lodestar: 'Lodestar',
      wanderings: 'Wanderings',
      holdings: 'Holdings',
      personal: 'Personal',
      quill: 'Quill',
      store: 'Store',
      account: 'Account',
      about: 'About',
      other: 'Other',
    };
    return map[surface] || surface;
  }

  function renderContextLabel(c) {
    const PAIDEIA_LANGS = new Set(['greek','latin','french','german','italian','oldenglish','middleenglish','welsh','oldnorse','gaulish']);
    if (c.surface === 'language' && PAIDEIA_LANGS.has(c.context_id)) {
      const display = c.context_id === 'oldenglish' ? 'Olde English'
        : c.context_id === 'middleenglish' ? 'Middle English'
        : c.context_id === 'oldnorse' ? 'Old Norse'
        : c.context_id[0].toUpperCase() + c.context_id.slice(1);
      return `${display} primer`;
    }
    if (c.surface === 'reader') return `Reader · ${c.context_id}`;
    return `${renderSurfaceLabel(c.surface)} · ${c.context_id}`;
  }

  function renderSiteFilter() {
    // Mansion users only see Mansion; Paideia users see Paideia. The summary
    // endpoint accepts `site=` so we could let users toggle to a combined
    // view if they have analytics on both sites. For v1 we lock per-site.
    return '';
  }

  // ----- Privacy controls -----
  async function renderPrivacy() {
    const prefs = await loadPrefs();
    const enabled = prefs ? !!prefs.tracking_enabled : true;
    const goal = prefs ? prefs.daily_goal_minutes : 30;
    return `
      <details class="dash-privacy">
        <summary>Privacy &amp; data</summary>
        <div class="privacy-body">
          <div class="pref-row">
            <label class="pref-label">
              <input type="checkbox" id="pref-tracking" ${enabled ? 'checked' : ''}>
              Track my reading on ${SITE === 'paideia' ? 'Kalopaideia' : 'The Reading Mansion'}
            </label>
            <p class="dash-muted dash-small">Turn off any time; we never share or sell your data.</p>
          </div>
          <div class="pref-row">
            <label class="pref-label">Daily goal (minutes)
              <input type="number" id="pref-goal" min="1" max="600" value="${esc(goal)}">
            </label>
          </div>
          <div class="pref-row pref-actions">
            <a class="dash-btn" href="${BASE}/api/analytics/export">Download my data</a>
            <button class="dash-btn dash-btn-danger" id="pref-delete">Delete my analytics</button>
          </div>
          <p class="pref-status" id="pref-status" aria-live="polite"></p>
        </div>
      </details>
    `;
  }

  function wirePrivacyControls() {
    const trackingCb = document.getElementById('pref-tracking');
    const goalIn     = document.getElementById('pref-goal');
    const deleteBtn  = document.getElementById('pref-delete');
    const status     = document.getElementById('pref-status');
    function setStatus(msg) { if (status) status.textContent = msg; }
    function patch(body, msg) {
      return fetch(`${BASE}/api/analytics/prefs`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.ok ? setStatus(msg) : setStatus('Save failed.'));
    }
    if (trackingCb) trackingCb.addEventListener('change', () => {
      patch({ tracking_enabled: trackingCb.checked }, trackingCb.checked ? 'Tracking on.' : 'Tracking off. New events will be ignored.');
    });
    let goalTimer = null;
    if (goalIn) goalIn.addEventListener('input', () => {
      clearTimeout(goalTimer);
      goalTimer = setTimeout(() => {
        const v = Math.max(1, Math.min(600, Number(goalIn.value) || 30));
        patch({ daily_goal_minutes: v }, `Goal set to ${v} minutes.`).then(() => refresh());
      }, 500);
    });
    if (deleteBtn) deleteBtn.addEventListener('click', async () => {
      if (!confirm('Permanently delete all of your reading analytics? This cannot be undone.')) return;
      const r = await fetch(`${BASE}/api/analytics/data`, { method: 'DELETE', credentials: 'include' });
      if (r.status === 204) { setStatus('All analytics deleted.'); refresh(); }
      else setStatus('Delete failed.');
    });
  }

  // ----- Main render -----
  async function refresh() {
    const data = await loadSummary(activeRange);
    if (!data) return;
    lastData = data;
    const t = data.today;
    const tot = data.totals;
    const s = data.streak;
    const a = data.averages;

    const tabs = [
      { d: 7,   label: '7 Days'  },
      { d: 30,  label: '30 Days' },
      { d: 365, label: 'All'     },
    ].map((t) => {
      const active = t.d === activeRange ? 'active' : '';
      return `<button class="range-tab ${active}" data-days="${t.d}">${t.label}</button>`;
    }).join('');

    const wordsRead = tot.words_read;
    const pageEquivalent = pagesFromWords(wordsRead);
    const friendlyWords = wordsRead > 0
      ? `That's about ${fmtNumber(pageEquivalent)} ${pluralize(pageEquivalent, 'page')} of a typical book.`
      : `Start reading on ${SITE === 'paideia' ? 'Kalopaideia' : 'The Reading Mansion'} to see your habits here.`;

    const privacy = await renderPrivacy();

    root.innerHTML = `
      <div class="dash-row-top">
        <article class="card streak-card">
          <div class="card-icon">🔥</div>
          <div class="card-label">Current Streak</div>
          <div class="card-big">${esc(s.current)}</div>
          <div class="card-unit">${s.current === 1 ? 'day' : 'days'}</div>
          <div class="card-foot">Longest: ${s.longest} ${s.longest === 1 ? 'day' : 'days'}</div>
        </article>
        <article class="card goal-card">
          <div class="card-icon">◎</div>
          <div class="card-label">Today's Goal</div>
          <div class="card-big">${esc(t.minutes)}</div>
          <div class="card-unit">/ ${esc(t.goal_minutes)}m</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${esc(Math.min(100, t.pct))}%"></div></div>
          <div class="card-foot">${esc(t.pct)}% complete</div>
        </article>
      </div>

      <div class="dash-row-quad">
        <article class="card stat-card"><div class="stat-icon">⏱</div><div class="stat-big">${esc(fmtMinutes(tot.total_minutes))}</div><div class="stat-label">Total</div></article>
        <article class="card stat-card"><div class="stat-icon">📖</div><div class="stat-big">${esc(fmtNumber(tot.pages_read))}</div><div class="stat-label">Pages</div></article>
        <article class="card stat-card"><div class="stat-icon">∿</div><div class="stat-big">${esc(fmtMinutes(a.minutes_per_session))}</div><div class="stat-label">Avg session</div></article>
        <article class="card stat-card"><div class="stat-icon">▦</div><div class="stat-big">${esc(fmtNumber(tot.sessions))}</div><div class="stat-label">Sessions</div></article>
      </div>

      <article class="card chart-card">
        <header class="card-head">
          <h3>Reading Time</h3>
          <div class="range-tabs">${tabs}</div>
        </header>
        ${renderBarChart(data.daily, t.goal_minutes)}
      </article>

      <article class="card words-card">
        <h3>Words Read</h3>
        <div class="words-big">${esc(fmtNumber(wordsRead))}</div>
        <p class="words-foot">${esc(friendlyWords)}</p>
      </article>

      <div class="dash-row-half">
        <article class="card">
          <h3>Most time spent</h3>
          ${topList(data.top.surfaces, (x) => renderSurfaceLabel(x.surface), (x) => `${fmtMinutes(x.minutes)} · ${pluralize(x.sessions, 'session')}`)}
        </article>
        <article class="card">
          <h3>Most explored</h3>
          ${topList(data.top.contexts, renderContextLabel, (x) => `${fmtMinutes(x.minutes)} · ${pluralize(x.sessions, 'session')}`)}
        </article>
      </div>

      <div class="dash-row-half">
        <article class="card">
          <h3>What you do here</h3>
          ${topList(data.top.event_types, renderEventTypePill, (x) => fmtNumber(x.count))}
        </article>
        <article class="card">
          <h3>Devices</h3>
          ${deviceSplitRow(data.device_split)}
        </article>
      </div>

      <article class="card hour-card">
        <h3>When you read</h3>
        ${renderHourlyHeatmap(data.by_hour)}
      </article>

      ${privacy}
    `;

    // Range tabs
    root.querySelectorAll('.range-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = Number(btn.dataset.days);
        if (d && d !== activeRange) { activeRange = d; refresh(); }
      });
    });
    wirePrivacyControls();
  }

  refresh();
})();
