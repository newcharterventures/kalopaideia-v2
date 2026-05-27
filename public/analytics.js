/*
 * analytics.js — shared client-side reading-analytics tracker.
 * Per Jae 2026-05-12. Logged-in users only; opt-out model.
 *
 * Architecture:
 *   1. On load, fetch /api/whoami. If user==null or tracking disabled, exit.
 *   2. Start a session (uuid generated locally; POSTed to PUT /api/analytics/session).
 *   3. Buffer events; flush every 5s, or on 10 events, or on pagehide via sendBeacon.
 *   4. On pagehide, end the session (PUT /api/analytics/session with ended_at).
 *   5. Auto-detect surface + context from current URL (overridable by page code).
 *
 * Public API (window.Analytics):
 *   Analytics.ready()                     -> Promise<{user, prefs} | null>
 *   Analytics.setContext(surface, ctxId)  -> manually re-tag the live session
 *   Analytics.track(eventType, payload?)  -> queue an event
 *   Analytics.pageTurn(words = 0)         -> increments session pages_turned + words_read
 *   Analytics.flush()                     -> force an immediate flush
 *
 * No-op for anonymous users. Never throws to the page.
 */
(function () {
  'use strict';

  // --- Site detection. Both Paideia and Mansion serve this same file at
  //     /<site>/analytics.js; the path prefix tells us which one.
  function detectSite() {
    const p = (typeof location !== 'undefined' && location.pathname) || '';
    if (p.startsWith('/paideia')) return { site: 'paideia', base: '/paideia' };
    if (p.startsWith('/mansion'))  return { site: 'mansion',  base: '/mansion'  };
    // Fallback: same-origin no prefix.
    return { site: 'unknown', base: '' };
  }
  const { site: SITE, base: BASE } = detectSite();

  // --- Device classification.
  function detectDevice() {
    const ua = navigator.userAgent || '';
    if (/iPad|tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // --- UUID. Prefer crypto.randomUUID; fallback for old browsers.
  function uuid() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch {}
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 10);
    return `${t}-${r}-${r}`;
  }

  // --- Surface/context auto-detection from the URL. Pages can override
  //     with Analytics.setContext(). Keep this list short and obvious.
  function inferSurface() {
    const p = location.pathname;
    if (SITE === 'paideia') {
      if (/^\/paideia\/?$/.test(p)) return { surface: 'home', context_id: null };
      if (/^\/paideia\/celtic\/?$/.test(p))   return { surface: 'category', context_id: 'celtic' };
      if (/^\/paideia\/germanic\/?$/.test(p)) return { surface: 'category', context_id: 'germanic' };
      const langMatch = p.match(/^\/paideia\/([a-z]+)\/?$/);
      if (langMatch && ['greek','latin','french','german','italian','oldenglish','middleenglish','welsh','oldnorse','gaulish'].includes(langMatch[1])) {
        return { surface: 'language', context_id: langMatch[1] };
      }
      const readMatch = p.match(/^\/paideia\/read\/([^/]+)/);
      if (readMatch) return { surface: 'reader', context_id: decodeURIComponent(readMatch[1]) };
      if (/^\/paideia\/store/.test(p))   return { surface: 'store', context_id: null };
      if (/^\/paideia\/account/.test(p)) return { surface: 'account', context_id: null };
      if (/^\/paideia\/about/.test(p))   return { surface: 'about', context_id: null };
      return { surface: 'other', context_id: null };
    }
    if (SITE === 'mansion') {
      if (/^\/mansion\/?$/.test(p))           return { surface: 'today', context_id: null };
      if (/^\/mansion\/lodestar/.test(p))     return { surface: 'lodestar', context_id: null };
      if (/^\/mansion\/wanderings/.test(p))   return { surface: 'wanderings', context_id: null };
      if (/^\/mansion\/holdings/.test(p))     return { surface: 'holdings', context_id: null };
      if (/^\/mansion\/personal/.test(p))     return { surface: 'personal', context_id: null };
      if (/^\/mansion\/quill/.test(p))        return { surface: 'quill', context_id: null };
      if (/^\/mansion\/account/.test(p))      return { surface: 'account', context_id: null };
      if (/^\/mansion\/about/.test(p))        return { surface: 'about', context_id: null };
      const readMatch = p.match(/^\/mansion\/(?:read|book)\/([^/]+)/);
      if (readMatch) return { surface: 'reader', context_id: decodeURIComponent(readMatch[1]) };
      return { surface: 'other', context_id: null };
    }
    return { surface: 'other', context_id: null };
  }

  // --- State. Set lazily after /api/whoami probe succeeds.
  let state = {
    enabled: false,           // becomes true if user logged in + tracking on + no DNT
    user: null,               // { id, display_name }
    prefs: null,              // { tracking_enabled, daily_goal_minutes, banner_dismissed_at }
    sessionId: null,
    sessionStarted: 0,        // ms epoch
    pagesTurned: 0,
    wordsRead: 0,
    surface: null,
    contextId: null,
    eventBuffer: [],
    flushTimer: null,
    readyPromise: null,
  };

  // --- DNT pre-check: skip the whoami probe entirely if DNT=1.
  function dntEnabled() {
    try {
      const dnt = navigator.doNotTrack || window.doNotTrack || (navigator.msDoNotTrack);
      return dnt === '1' || dnt === 'yes' || dnt === true;
    } catch { return false; }
  }

  // --- Fetch wrapper that swallows errors quietly.
  async function safeFetch(path, opts) {
    try {
      const r = await fetch(BASE + path, { credentials: 'include', ...opts });
      if (!r.ok && r.status !== 204) return null;
      if (r.status === 204) return {};
      return await r.json();
    } catch { return null; }
  }

  // --- whoami probe. Always succeeds (returns null on any failure).
  async function whoami() {
    const data = await safeFetch('/api/whoami');
    if (!data || !data.user) return null;
    return data;
  }

  // --- Schedule a flush after 5 seconds. Cancels any pending one.
  function scheduleFlush() {
    if (state.flushTimer) return;
    state.flushTimer = setTimeout(() => { state.flushTimer = null; flushEvents(); }, 5000);
  }

  // --- Push events to the server. Uses fetch with keepalive when small;
  //     sendBeacon is reserved for pagehide.
  async function flushEvents() {
    if (!state.enabled) { state.eventBuffer = []; return; }
    if (state.eventBuffer.length === 0) return;
    const batch = state.eventBuffer.splice(0);
    const body = JSON.stringify({ events: batch });
    try {
      await fetch(BASE + '/api/analytics/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: body.length < 60000, // browser fetch keepalive cap is 64KB
      });
    } catch { /* drop the batch silently */ }
  }

  // --- pagehide handler: flush events + close session via sendBeacon (so
  //     the request survives navigation/tab-close).
  function beaconSessionEnd() {
    if (!state.enabled || !state.sessionId) return;
    const payload = {
      id: state.sessionId,
      site: SITE,
      surface: state.surface,
      context_id: state.contextId,
      started_at: new Date(state.sessionStarted).toISOString(),
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - state.sessionStarted,
      pages_turned: state.pagesTurned,
      words_read: state.wordsRead,
      device: detectDevice(),
    };
    try {
      // sendBeacon takes Blob; Content-Type comes from the blob.
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      // Beacon only supports POST; the server accepts a synonym POST endpoint
      // for session-end. We POST to /api/analytics/session-beacon, which
      // performs the same upsert. For sites that haven't added the alias,
      // we fall back to a keepalive fetch.
      const okBeacon = navigator.sendBeacon && navigator.sendBeacon(BASE + '/api/analytics/session-beacon', blob);
      if (!okBeacon) {
        fetch(BASE + '/api/analytics/session', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch { /* ignore */ }
    // Also flush any buffered events.
    if (state.eventBuffer.length > 0) {
      try {
        const evBlob = new Blob(
          [JSON.stringify({ events: state.eventBuffer })],
          { type: 'application/json' },
        );
        navigator.sendBeacon && navigator.sendBeacon(BASE + '/api/analytics/events-beacon', evBlob);
        state.eventBuffer = [];
      } catch {}
    }
  }

  // --- Open the session row with a started_at timestamp. No-op if disabled.
  async function startSession() {
    if (!state.enabled) return;
    state.sessionId = uuid();
    state.sessionStarted = Date.now();
    const ctx = inferSurface();
    state.surface = ctx.surface;
    state.contextId = ctx.context_id;
    await safeFetch('/api/analytics/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.sessionId,
        site: SITE,
        surface: state.surface,
        context_id: state.contextId,
        started_at: new Date(state.sessionStarted).toISOString(),
        device: detectDevice(),
      }),
    });
    queueEvent('session_start', { surface: state.surface, context_id: state.contextId });
  }

  // --- Add an event to the buffer.
  function queueEvent(eventType, payload) {
    if (!state.enabled || !eventType) return;
    state.eventBuffer.push({
      session_id: state.sessionId,
      site: SITE,
      event_type: String(eventType).slice(0, 64),
      payload: payload || null,
      occurred_at: new Date().toISOString(),
    });
    if (state.eventBuffer.length >= 10) {
      flushEvents();
    } else {
      scheduleFlush();
    }
  }

  // --- Public API.
  const Analytics = {
    site: SITE,
    base: BASE,
    async ready() {
      if (state.readyPromise) return state.readyPromise;
      state.readyPromise = (async () => {
        if (dntEnabled()) return null;
        const data = await whoami();
        if (!data || !data.user) return null;
        state.user = data.user;
        state.prefs = data.analytics || null;
        if (!state.prefs || state.prefs.tracking_enabled === false) return null;
        state.enabled = true;
        await startSession();
        return { user: state.user, prefs: state.prefs };
      })();
      return state.readyPromise;
    },
    setContext(surface, contextId) {
      if (!state.enabled) return;
      state.surface = surface || state.surface;
      state.contextId = (contextId == null ? state.contextId : contextId);
      // Update the open session row.
      safeFetch('/api/analytics/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.sessionId,
          site: SITE,
          surface: state.surface,
          context_id: state.contextId,
          started_at: new Date(state.sessionStarted).toISOString(),
        }),
      });
    },
    track(eventType, payload) {
      queueEvent(eventType, payload);
    },
    pageTurn(words = 0) {
      if (!state.enabled) return;
      state.pagesTurned += 1;
      state.wordsRead += Math.max(0, Math.floor(words) || 0);
      queueEvent('page_turn', { words: words || 0, page_count: state.pagesTurned });
    },
    flush() { return flushEvents(); },
    isEnabled() { return state.enabled; },
    // Exposed for the prefs page / dashboard.
    getUser() { return state.user; },
    getPrefs() { return state.prefs; },
  };

  // --- First-session privacy banner. Shown once per logged-in user until
  //     they dismiss it. Per Jae 2026-05-12; required by the opt-out model.
  function maybeShowBanner() {
    if (!state.enabled || !state.prefs) return;
    if (state.prefs.banner_dismissed_at) return;
    if (typeof document === 'undefined') return;
    // Don't show on the analytics or terms pages themselves.
    const p = location.pathname;
    if (/\/analytics(\b|\/)|\/terms|\/about\/terms/i.test(p)) return;

    // Build the banner. Single, minimal, dismissable.
    const banner = document.createElement('div');
    banner.id = 'analytics-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Reading analytics notice');
    const siteName = SITE === 'paideia' ? 'Kalopaideia' : 'The Reading Mansion';
    const termsHref = SITE === 'paideia' ? BASE + '/terms' : BASE + '/about/terms';
    const dashHref  = BASE + '/analytics';
    banner.innerHTML = `
      <div class="acb-inner">
        <div class="acb-text">
          Reading analytics on ${siteName}: we record your sessions, pages, and time to power your
          <a href="${dashHref}">Reading Analytics</a> page. Anonymized aggregates help us improve the site.
          We never sell or share your data. <a href="${termsHref}">Details</a>.
        </div>
        <div class="acb-actions">
          <button class="acb-btn acb-btn-secondary" id="acb-opt-out">Turn off</button>
          <button class="acb-btn acb-btn-primary" id="acb-dismiss">Got it</button>
        </div>
      </div>
    `;
    // Inline styles — self-contained so we don't need a CSS dependency
    // on every page that loads analytics.js.
    const style = document.createElement('style');
    style.textContent = `
      #analytics-consent-banner {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;
        background: rgba(31, 27, 22, 0.96);
        color: #f6f0e2;
        font-family: 'Source Serif 4', Georgia, serif;
        font-size: 14px;
        padding: 12px 18px;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      #analytics-consent-banner .acb-inner {
        max-width: 980px; margin: 0 auto;
        display: flex; gap: 16px; align-items: center;
        flex-wrap: wrap;
      }
      #analytics-consent-banner .acb-text { flex: 1; min-width: 260px; line-height: 1.45; }
      #analytics-consent-banner a { color: #d8b876; text-decoration: underline; }
      #analytics-consent-banner a:hover { color: #f6f0e2; }
      #analytics-consent-banner .acb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      #analytics-consent-banner .acb-btn {
        font-family: 'Inter', sans-serif;
        font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
        border-radius: 2px; cursor: pointer;
        padding: 8px 14px; border: 1px solid rgba(255,255,255,0.18);
      }
      #analytics-consent-banner .acb-btn-primary {
        background: #d8b876; color: #1f1b16; border-color: #d8b876;
      }
      #analytics-consent-banner .acb-btn-primary:hover { background: #f6f0e2; border-color: #f6f0e2; }
      #analytics-consent-banner .acb-btn-secondary {
        background: transparent; color: #f6f0e2;
      }
      #analytics-consent-banner .acb-btn-secondary:hover { background: rgba(255,255,255,0.08); }
      @media (max-width: 640px) {
        #analytics-consent-banner .acb-inner { flex-direction: column; align-items: stretch; }
        #analytics-consent-banner .acb-actions { justify-content: flex-end; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);

    async function recordDismiss() {
      await safeFetch('/api/analytics/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_dismissed_at: new Date().toISOString() }),
      });
      if (state.prefs) state.prefs.banner_dismissed_at = new Date().toISOString();
      banner.remove();
    }
    async function recordOptOut() {
      await safeFetch('/api/analytics/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_enabled: false, banner_dismissed_at: new Date().toISOString() }),
      });
      state.enabled = false;
      if (state.prefs) {
        state.prefs.tracking_enabled = false;
        state.prefs.banner_dismissed_at = new Date().toISOString();
      }
      banner.remove();
    }
    banner.querySelector('#acb-dismiss').addEventListener('click', recordDismiss);
    banner.querySelector('#acb-opt-out').addEventListener('click', recordOptOut);
  }

  // --- Auto-start when the page loads. We don't block other scripts.
  function bootstrap() {
    Analytics.ready().then(() => maybeShowBanner());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // --- Flush on tab hide / unload. visibilitychange catches mobile
  //     backgrounding; pagehide catches navigation. Both are needed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEvents();
    }
  });
  window.addEventListener('pagehide', () => {
    beaconSessionEnd();
  });

  // --- Public.
  window.Analytics = Analytics;
})();
