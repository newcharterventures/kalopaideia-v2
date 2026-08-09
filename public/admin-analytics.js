/*
 * admin-analytics.js — sitewide aggregate dashboard for the proprietor.
 * Shared by Kalopaideia and Mansion. Reads site from #admin-dash-root[data-site].
 * Per Jae 2026-05-12. Anonymized aggregates only; no per-user breakdown.
 */
(function () {
  'use strict';

  const root = document.getElementById('admin-dash-root');
  if (!root) return;
  const SITE = root.dataset.site || 'paideia';
  const BASE = SITE === 'paideia' ? '/paideia' : '/mansion';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtNumber(n) { return Number(n || 0).toLocaleString(); }
  function fmtMinutes(m) {
    if (!m) return '0m';
    if (m < 60) return Math.round(m) + 'm';
    const h = m / 60;
    if (h < 10) return h.toFixed(1) + 'h';
    return Math.round(h) + 'h';
  }
  function pluralize(n, s, p) { return `${n} ${n === 1 ? s : (p || s + 's')}`; }
  function shortDate(iso) {
    try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
    catch { return iso; }
  }

  let activeRange = 30;
  let activeSite = SITE; // sitewide filter: 'paideia' | 'mansion' | 'all'

  async function loadSummary(days, site) {
    const q = new URLSearchParams();
    q.set('days', String(days));
    if (site && site !== 'all') q.set('site', site);
    const r = await fetch(`${BASE}/api/admin/analytics/summary?${q}`, { credentials: 'include' });
    if (r.status === 403) {
      root.innerHTML = `<div class="dash-empty"><h3>Forbidden.</h3><p class="dash-muted">This page is for the proprietor.</p></div>`;
      return null;
    }
    if (r.status === 401) {
      root.innerHTML = `<div class="dash-empty"><h3>Sign in required.</h3></div>`;
      return null;
    }
    if (!r.ok) {
      root.innerHTML = `<div class="dash-empty"><h3>Could not load.</h3><p class="dash-muted">${r.status}</p></div>`;
      return null;
    }
    return await r.json();
  }

  function renderUsersTopRow(u) {
    return `
      <div class="dash-row-quad">
        <article class="card stat-card"><div class="stat-icon">●</div><div class="stat-big">${fmtNumber(u.dau)}</div><div class="stat-label">DAU</div></article>
        <article class="card stat-card"><div class="stat-icon">●●</div><div class="stat-big">${fmtNumber(u.wau)}</div><div class="stat-label">WAU</div></article>
        <article class="card stat-card"><div class="stat-icon">◉</div><div class="stat-big">${fmtNumber(u.mau)}</div><div class="stat-label">MAU</div></article>
        <article class="card stat-card"><div class="stat-icon">⌖</div><div class="stat-big">${fmtNumber(u.active_total)}</div><div class="stat-label">Ever active</div></article>
      </div>
      <div class="dash-row-quad">
        <article class="card stat-card"><div class="stat-icon">👤</div><div class="stat-big">${fmtNumber(u.total_accounts)}</div><div class="stat-label">Accounts</div></article>
        <article class="card stat-card"><div class="stat-icon">🛇</div><div class="stat-big">${fmtNumber(u.opted_out)}</div><div class="stat-label">Opted out</div></article>
        <article class="card stat-card"><div class="stat-icon">∫</div><div class="stat-big">${fmtNumber(u.total_accounts - u.active_total - u.opted_out)}</div><div class="stat-label">Inactive</div></article>
        <article class="card stat-card"><div class="stat-icon">%</div><div class="stat-big">${u.total_accounts ? Math.round((u.active_total/u.total_accounts)*100) : 0}%</div><div class="stat-label">Activation</div></article>
      </div>
    `;
  }

  // Multi-line: daily users (left axis), daily minutes (right axis).
  function renderDailyChart(daily) {
    if (!daily.length) return '<div class="dash-muted">No data yet.</div>';
    const W = 600, H = 200, padL = 40, padR = 40, padB = 30, padT = 16;
    const cw = W - padL - padR;
    const ch = H - padB - padT;
    const maxUsers   = Math.max(1, ...daily.map((d) => d.users));
    const maxMinutes = Math.max(1, ...daily.map((d) => d.minutes));
    const labelEvery = daily.length <= 14 ? 2 : daily.length <= 30 ? 4 : Math.ceil(daily.length / 8);
    const stepX = cw / Math.max(1, daily.length - 1);

    const usersPath = daily.map((d, i) => {
      const x = padL + i * stepX;
      const y = padT + ch - (d.users / maxUsers) * ch;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Minutes bars (low-priority background)
    const bars = daily.map((d, i) => {
      const h = (d.minutes / maxMinutes) * ch;
      const x = padL + i * stepX - 3;
      const y = padT + ch - h;
      return `<rect class="admin-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="6" height="${Math.max(1, h).toFixed(1)}" rx="1"><title>${shortDate(d.date)} — ${pluralize(d.users, 'user')}, ${fmtMinutes(d.minutes)}</title></rect>`;
    }).join('');

    // X-axis labels
    const labels = daily.map((d, i) => {
      if (i % labelEvery !== 0 && i !== daily.length - 1) return '';
      const x = padL + i * stepX;
      return `<text x="${x.toFixed(1)}" y="${(H - padB + 14).toFixed(1)}" class="bar-label" text-anchor="middle">${esc(shortDate(d.date))}</text>`;
    }).join('');

    // Y-axis left labels (users), right labels (minutes)
    const yTicksU = [0, Math.ceil(maxUsers / 2), maxUsers];
    const yTicksM = [0, Math.ceil(maxMinutes / 2), maxMinutes];
    const yLeftLabels = yTicksU.map((v) => {
      const y = padT + ch - (v / maxUsers) * ch;
      return `<text x="${(padL - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="bar-label" text-anchor="end">${v}</text>`;
    }).join('');
    const yRightLabels = yTicksM.map((v) => {
      const y = padT + ch - (v / maxMinutes) * ch;
      return `<text x="${(W - padR + 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="bar-label" text-anchor="start">${fmtMinutes(v)}</text>`;
    }).join('');

    return `
      <svg class="bar-chart admin-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily active users and minutes">
        ${bars}
        <path d="${usersPath}" class="users-line" fill="none" stroke-width="2"></path>
        ${labels}
        ${yLeftLabels}
        ${yRightLabels}
      </svg>
      <p class="dash-muted dash-small">Line = daily active users · Bars = total minutes.</p>
    `;
  }

  function renderCohorts(cohorts) {
    if (!cohorts.length) return '<div class="dash-muted">Not enough data for cohorts yet.</div>';
    return `
      <table class="cohort-table">
        <thead>
          <tr><th>Week</th><th class="num">New users</th><th class="num">Returned wk+1</th><th class="num">Retention</th></tr>
        </thead>
        <tbody>
          ${cohorts.map((c) => `
            <tr>
              <td>${esc(c.cohort_week)}</td>
              <td class="num">${fmtNumber(c.new_users)}</td>
              <td class="num">${fmtNumber(c.returned_w2)}</td>
              <td class="num"><span class="retention-pill" style="--pct:${c.retention_pct}">${c.retention_pct}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderTopContexts(items) {
    if (!items.length) return '<div class="dash-muted">No contexts seen yet.</div>';
    return '<ul class="top-list">' + items.map((c) => {
      const label = c.surface === 'language' ? `${capitalize(c.context_id)} primer`
        : c.surface === 'reader' ? `Reader · ${c.context_id}`
        : `${c.surface} · ${c.context_id}`;
      return `<li><span class="top-label">${esc(label)}</span><span class="top-value">${fmtNumber(c.users)}u · ${fmtMinutes(c.minutes)}</span></li>`;
    }).join('') + '</ul>';
  }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  function renderTopSurfaces(items) {
    if (!items.length) return '<div class="dash-muted">No surface data.</div>';
    return '<ul class="top-list">' + items.map((s) => {
      return `<li><span class="top-label">${esc(s.surface)}</span><span class="top-value">${fmtNumber(s.users)}u · avg ${s.avg_minutes}m · ${fmtNumber(s.sessions)}s</span></li>`;
    }).join('') + '</ul>';
  }

  function renderDropoff(items) {
    if (!items.length) return '<div class="dash-muted">No drop-off data yet.</div>';
    return `
      <p class="dash-muted dash-small">Surfaces ranked by shortest average session (probable bounce points). Min 5 sessions.</p>
      <ul class="top-list">${items.map((s) => `
        <li><span class="top-label">${esc(s.surface)}</span><span class="top-value">avg ${s.avg_minutes}m · ${fmtNumber(s.sessions)}s</span></li>
      `).join('')}</ul>
    `;
  }

  function renderEventMix(items) {
    if (!items.length) return '<div class="dash-muted">No events yet.</div>';
    const labels = {
      session_start: 'sessions',
      word_seen: 'words seen',
      word_tooltip: 'pron. tooltips',
      word_audio_play: 'word audio',
      alphabet_audio_play: 'alphabet audio',
      lesson_view: 'primer panes',
      library_line_read: 'library lines',
      library_line_audio_play: 'library audio',
      page_turn: 'page turns',
    };
    return '<ul class="top-list">' + items.map((e) => `
      <li><span class="top-label">${esc(labels[e.event_type] || e.event_type)}</span><span class="top-value">${fmtNumber(e.count)} · ${fmtNumber(e.users)}u</span></li>
    `).join('') + '</ul>';
  }

  function renderHeatmap(byHour) {
    const max = Math.max(1, ...byHour.map((h) => h.sessions));
    return `<div class="hour-grid">${byHour.map((h) => `
      <div class="hour-cell" style="--intensity:${(0.06 + (h.sessions/max) * 0.94).toFixed(2)}" title="${h.hour}:00 UTC — ${pluralize(h.sessions, 'session')}">
        <span class="hour-label">${h.hour}</span>
      </div>
    `).join('')}</div><p class="dash-muted dash-small">Sitewide, UTC.</p>`;
  }

  function renderDeviceSplit(split) {
    const total = Object.values(split).reduce((s, n) => s + n, 0);
    if (!total) return '<div class="dash-muted">No device data.</div>';
    return ['mobile','desktop','tablet','unknown'].map((k) => {
      const n = split[k] || 0;
      if (!n) return '';
      const pct = ((n / total) * 100).toFixed(0);
      return `<div class="device-row">
        <span class="device-name">${k}</span>
        <div class="device-bar"><div class="device-fill" style="width:${pct}%"></div></div>
        <span class="device-count">${pct}% · ${fmtNumber(n)}</span>
      </div>`;
    }).join('');
  }

  function renderPerSite(perSite) {
    if (!perSite || !perSite.length) return '';
    return `
      <article class="card">
        <h3>Per-site split</h3>
        <ul class="top-list">${perSite.map((s) => `
          <li><span class="top-label">${esc(s.site)}</span><span class="top-value">${fmtNumber(s.users)}u · ${fmtMinutes(s.minutes)} · ${fmtNumber(s.sessions)}s</span></li>
        `).join('')}</ul>
      </article>
    `;
  }

  async function refresh() {
    const data = await loadSummary(activeRange, activeSite);
    if (!data) return;
    const rangeTabs = [
      { d: 7,   label: '7 Days'  },
      { d: 30,  label: '30 Days' },
      { d: 90,  label: '90 Days' },
      { d: 365, label: 'All'     },
    ].map((t) => {
      const a = t.d === activeRange ? 'active' : '';
      return `<button class="range-tab ${a}" data-days="${t.d}">${t.label}</button>`;
    }).join('');

    const siteTabs = [
      { s: SITE, label: SITE === 'paideia' ? 'Kalopaideia' : 'Mansion' },
      { s: SITE === 'paideia' ? 'mansion' : 'paideia', label: SITE === 'paideia' ? 'Mansion' : 'Kalopaideia' },
      { s: 'all',     label: 'Both sites' },
    ].map((t) => {
      const a = t.s === activeSite ? 'active' : '';
      return `<button class="site-tab ${a}" data-site="${esc(t.s)}">${esc(t.label)}</button>`;
    }).join('');

    root.innerHTML = `
      <div class="admin-toolbar">
        <div class="range-tabs">${rangeTabs}</div>
        <div class="range-tabs">${siteTabs}</div>
      </div>

      ${renderUsersTopRow(data.users)}

      <article class="card chart-card">
        <header class="card-head"><h3>Users &amp; minutes per day</h3></header>
        ${renderDailyChart(data.daily)}
      </article>

      <article class="card">
        <h3>Weekly cohort retention</h3>
        ${renderCohorts(data.cohorts)}
      </article>

      <div class="dash-row-half">
        <article class="card">
          <h3>Top contexts (languages / texts)</h3>
          ${renderTopContexts(data.top_contexts)}
        </article>
        <article class="card">
          <h3>Top surfaces</h3>
          ${renderTopSurfaces(data.top_surfaces)}
        </article>
      </div>

      <div class="dash-row-half">
        <article class="card">
          <h3>Drop-off surfaces</h3>
          ${renderDropoff(data.dropoff_surfaces)}
        </article>
        <article class="card">
          <h3>Event mix</h3>
          ${renderEventMix(data.event_mix)}
        </article>
      </div>

      <div class="dash-row-half">
        <article class="card">
          <h3>When readers read</h3>
          ${renderHeatmap(data.by_hour)}
        </article>
        <article class="card">
          <h3>Devices</h3>
          ${renderDeviceSplit(data.device_split)}
        </article>
      </div>

      ${renderPerSite(data.per_site)}
    `;

    root.querySelectorAll('.range-tab').forEach((b) => b.addEventListener('click', () => {
      const d = Number(b.dataset.days);
      if (d && d !== activeRange) { activeRange = d; refresh(); }
    }));
    root.querySelectorAll('.site-tab').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.site;
      if (s && s !== activeSite) { activeSite = s; refresh(); }
    }));
  }

  refresh();
})();
