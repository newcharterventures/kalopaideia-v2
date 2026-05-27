/* support-epic.js — patron CTA component, vanilla.
 *
 * Drop-in widget for any HTML page on Kalopaideia or the Mansion.
 *
 *   <div data-support-epic
 *        data-site="kalopaideia"
 *        data-mission="Help us expand…"
 *        data-blurb="Optional supporting paragraph"
 *        data-onetime-link="https://buy.stripe.com/…"
 *        data-monthly-5-link="https://buy.stripe.com/…"
 *        data-monthly-10-link="https://buy.stripe.com/…"
 *        data-monthly-25-link="https://buy.stripe.com/…"
 *        data-summary-url="/paideia/api/patrons/summary"
 *        data-tos-url="/paideia/terms.html"></div>
 *
 * Per Jae 2026-05-20: a small blurb appears ABOVE the tier grid:
 *   "Help us expand our reach, grow our library, improve our site
 *    by becoming a sponsor."
 *
 * NCV for-profit disclosure with TOS link appears BELOW the grid.
 * Recurring/one-time toggle mirrors Guardian's epic pattern.
 *
 * Talks to the server's /api/patrons/summary endpoint for the
 * progress-bar counter; degrades gracefully if the endpoint isn't
 * available yet.
 */
(function () {
  'use strict';

  const DEFAULT_BLURB =
    'Help us expand our reach, grow our library, improve our site by becoming a sponsor.';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function openExternal(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function fmtMoney(cents) {
    if (cents == null) return '$0';
    const d = (cents / 100);
    return d >= 1000
      ? '$' + Math.round(d).toLocaleString()
      : '$' + d.toFixed(2).replace(/\.00$/, '');
  }

  function render(host) {
    const ds = host.dataset;
    const site = ds.site || 'kalopaideia';
    const siteName = ds.siteName || (site === 'mansion' ? 'The Reading Mansion' : 'Kalopaideia');
    const mission = ds.mission || '';
    const blurb = ds.blurb || DEFAULT_BLURB;
    const oneTimeLink = ds.onetimeLink || '';
    const t5 = ds.monthly5Link || '';
    const t10 = ds.monthly10Link || '';
    const t25 = ds.monthly25Link || '';
    const summaryUrl = ds.summaryUrl || '';
    const tosUrl = ds.tosUrl || '/terms.html';

    host.innerHTML = `
      <section class="support-epic" role="region" aria-label="Become a sponsor">
        <div class="support-epic-wrap">
          <p class="support-epic-eyebrow">A note from ${escapeHtml(siteName)}</p>
          ${mission ? `<h2 class="support-epic-mission">${escapeHtml(mission)}</h2>` : ''}
          <p class="support-epic-blurb">${escapeHtml(blurb)}</p>

          <div class="support-epic-progress" data-progress hidden>
            <div class="support-epic-progress-meta">
              <span class="support-epic-progress-patrons" data-progress-patrons>—</span>
              <span class="support-epic-progress-goal" data-progress-goal>This month</span>
            </div>
            <div class="support-epic-progress-bar">
              <div class="support-epic-progress-fill" data-progress-fill style="width:0%"></div>
            </div>
          </div>

          <div class="support-epic-tabs" role="tablist">
            <button type="button" class="support-epic-tab is-active" data-mode="monthly" role="tab" aria-selected="true">Monthly</button>
            <button type="button" class="support-epic-tab" data-mode="onetime" role="tab" aria-selected="false">One time</button>
          </div>

          <div class="support-epic-tiers" data-monthly>
            <button type="button" class="support-epic-tier" data-tier="reader"  data-link="${escapeHtml(t5)}">
              <div class="support-epic-tier-amount">$5</div>
              <div class="support-epic-tier-per">Per month</div>
              <div class="support-epic-tier-label">Reader</div>
            </button>
            <button type="button" class="support-epic-tier is-highlighted" data-tier="scholar" data-link="${escapeHtml(t10)}">
              <span class="support-epic-tier-badge">Most common</span>
              <div class="support-epic-tier-amount">$10</div>
              <div class="support-epic-tier-per">Per month</div>
              <div class="support-epic-tier-label">Scholar</div>
            </button>
            <button type="button" class="support-epic-tier" data-tier="patron" data-link="${escapeHtml(t25)}">
              <div class="support-epic-tier-amount">$25</div>
              <div class="support-epic-tier-per">Per month</div>
              <div class="support-epic-tier-label">Patron</div>
            </button>
          </div>

          <button type="button" class="support-epic-onetime" data-onetime data-link="${escapeHtml(oneTimeLink)}" hidden>
            Contribute any amount →
          </button>

          <p class="support-epic-disclosure">
            ${escapeHtml(siteName)} is published by New Charter Ventures LLC, an
            independent for-profit company. Contributions are voluntary and
            <strong>not tax-deductible</strong>. See our
            <a href="${escapeHtml(tosUrl)}">Terms of Service</a> for details.
            Payments are processed securely by Stripe; cancel any recurring
            support anytime from your receipt email.
          </p>
        </div>
      </section>
    `;

    // Mode toggle
    const tabs = host.querySelectorAll('[data-mode]');
    const monthlyEl = host.querySelector('[data-monthly]');
    const oneTimeEl = host.querySelector('[data-onetime]');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        tabs.forEach(t => {
          const isActive = t === tab;
          t.classList.toggle('is-active', isActive);
          t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        monthlyEl.hidden = (mode !== 'monthly');
        oneTimeEl.hidden = (mode !== 'onetime');
      });
    });

    // Tier + one-time click handlers
    host.querySelectorAll('.support-epic-tier').forEach(btn => {
      btn.addEventListener('click', () => openExternal(btn.getAttribute('data-link')));
    });
    oneTimeEl.addEventListener('click', () => openExternal(oneTimeEl.getAttribute('data-link')));

    // Progress bar — fetch summary if endpoint provided
    if (summaryUrl) {
      fetch(summaryUrl, { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !data.this_month) return;
          const m = data.this_month;
          const goal = data.goal || Math.max(50, Math.ceil(m.patrons / 50) * 50 + 50);
          const pct = Math.min(100, Math.round((m.patrons / goal) * 100));
          const wrap = host.querySelector('[data-progress]');
          wrap.hidden = false;
          host.querySelector('[data-progress-patrons]').textContent =
            `${m.patrons.toLocaleString()} patrons this month`;
          host.querySelector('[data-progress-goal]').textContent =
            `Goal — ${goal.toLocaleString()}`;
          host.querySelector('[data-progress-fill]').style.width = pct + '%';
        })
        .catch(() => { /* silent failure — progress bar just stays hidden */ });
    }
  }

  function init() {
    document.querySelectorAll('[data-support-epic]').forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
