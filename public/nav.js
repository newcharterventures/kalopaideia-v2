// Kalopaideia shared masthead nav — one source of truth for the link list.
// Renders into #mast-nav-slot if present (category.html). For legacy pages
// (index.html, language.html) the nav is inlined in HTML and this script
// can also be used to inject Celtic/Germanic dropdowns into an existing
// <nav class="nav mast-nav"> by appending after the last language link.

(function () {
  // Canonical link order. Categories appear AFTER their member languages
  // are exhausted in the flat list; this keeps backward-compat with the
  // original seven and adds Celtic ▾ / Germanic ▾ as discoverable bins.
  const FLAT_LANGUAGES = [
    { href: "/paideia/greek",         label: "Greek" },
    { href: "/paideia/latin",         label: "Latin" },
    { href: "/paideia/french",        label: "French" },
    { href: "/paideia/german",        label: "German" },
    { href: "/paideia/italian",       label: "Italian" },
    { href: "/paideia/oldenglish",    label: "Olde English" },
    { href: "/paideia/middleenglish", label: "Middle English" },
  ];

  const CATEGORIES = [
    {
      href: "/paideia/celtic",
      label: "Celtic",
      children: [
        { href: "/paideia/gaulish", label: "Gaulish" },
        { href: "/paideia/welsh",   label: "Welsh" },
      ],
    },
    {
      href: "/paideia/germanic",
      label: "Germanic",
      children: [
        { href: "/paideia/oldnorse", label: "Old Norse" },
      ],
    },
  ];

  const UTILITY = [
    { href: "/paideia/akousma",          label: "The Akousma", util: true },
    { href: "/paideia/curriculum.html",  label: "Curriculum",  util: true },
    { href: "/paideia/commonplace.html", label: "Commonplace", util: true },
    { href: "/paideia/support.html",     label: "Support",     util: true },
    { href: "/paideia/account",          label: "Sign in",     util: true },
    { href: "/paideia/about.html",       label: "About",       util: true },
  ];

  function renderHtml() {
    const lang = FLAT_LANGUAGES.map(
      (l) => `<a href="${l.href}">${l.label}</a>`,
    ).join("");
    const cats = CATEGORIES.map((c) => {
      const items = c.children.map(
        (ch) => `<a class="nav-dd-item" href="${ch.href}">${ch.label}</a>`,
      ).join("");
      return `
        <span class="nav-dd">
          <a class="nav-dd-toggle" href="${c.href}">${c.label}<span class="nav-dd-caret">▾</span></a>
          <div class="nav-dd-panel">
            <a class="nav-dd-item nav-dd-overview" href="${c.href}">All ${c.label}</a>
            ${items}
          </div>
        </span>`;
    }).join("");
    const util = UTILITY.map(
      (u) => `<a class="util" href="${u.href}">${u.label}</a>`,
    ).join("");
    return lang + cats + util;
  }

  function inject() {
    const slot = document.getElementById("mast-nav-slot");
    if (slot) {
      slot.innerHTML = renderHtml();
      return;
    }
    // Legacy fallback: find an existing .mast-nav and append the Celtic /
    // Germanic dropdowns BEFORE the utility links (so they're discoverable
    // without rewriting the whole nav). Only runs if the nav exists and
    // doesn't already contain a .nav-dd element.
    const nav = document.querySelector(".mast-nav");
    if (!nav || nav.querySelector(".nav-dd")) return;
    const firstUtil = nav.querySelector("a.util");
    const fragHtml = CATEGORIES.map((c) => {
      const items = c.children.map(
        (ch) => `<a class="nav-dd-item" href="${ch.href}">${ch.label}</a>`,
      ).join("");
      return `
        <span class="nav-dd">
          <a class="nav-dd-toggle" href="${c.href}">${c.label}<span class="nav-dd-caret">▾</span></a>
          <div class="nav-dd-panel">
            <a class="nav-dd-item nav-dd-overview" href="${c.href}">All ${c.label}</a>
            ${items}
          </div>
        </span>`;
    }).join("");
    const tmp = document.createElement("div");
    tmp.innerHTML = fragHtml;
    const newNodes = Array.from(tmp.children);
    if (firstUtil) {
      for (const n of newNodes) nav.insertBefore(n, firstUtil);
    } else {
      for (const n of newNodes) nav.appendChild(n);
    }
  }

  // Position a fixed-position panel under its toggle, horizontally centered
  // on the toggle. Called on hover-enter, click-open, scroll, and resize.
  // Skipped on mobile where the CSS @media (max-width: 760px) override
  // re-anchors the panel as position: static below the toggle.
  function positionPanel(dd) {
    if (!dd) return;
    if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) return;
    const toggle = dd.querySelector(".nav-dd-toggle");
    const panel = dd.querySelector(".nav-dd-panel");
    if (!toggle || !panel) return;
    const tr = toggle.getBoundingClientRect();
    // Measure the panel after a temporary visibility flip so getBoundingClientRect
    // reports a real width. Use measured width if available; otherwise fall back
    // to the rendered offsetWidth which is set once the panel is shown.
    const panelWidth = panel.offsetWidth || 200;
    let left = tr.left + tr.width / 2 - panelWidth / 2;
    // Keep the panel inside the viewport (12px breathing room from each edge).
    const minLeft = 12;
    const maxLeft = window.innerWidth - panelWidth - 12;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = Math.max(minLeft, maxLeft);
    // No gap between toggle and panel — the panel's own top padding (10px)
    // bridges the visual distance so the cursor can cross from toggle to
    // menu items without dropping the :hover state.
    const top = tr.bottom;
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  // Mobile detection — use coarse pointer + small viewport as the canonical
  // signal. matchMedia is supported in every browser we care about.
  function isMobile() {
    if (!window.matchMedia) return false;
    return window.matchMedia("(max-width: 760px)").matches
        || window.matchMedia("(pointer: coarse)").matches;
  }

  // Per Jae 2026-05-13: on mobile, the dropdown UX was broken — the inline
  // panel rendered as if open, the parent label didn't navigate, and the
  // tap target was too small. Mobile users now get a direct link to the
  // category landing page (/paideia/celtic, /paideia/germanic) which itself
  // lists the children. Desktop keeps the hover/click dropdown.
  function wireDropdownToggles() {
    const dds = document.querySelectorAll(".nav-dd");
    const mobile = isMobile();
    dds.forEach((dd) => {
      const t = dd.querySelector(".nav-dd-toggle");
      if (!t) return;
      if (mobile) {
        // Strip the caret on mobile — the link goes straight to the page.
        const caret = t.querySelector(".nav-dd-caret");
        if (caret) caret.remove();
        // Defensively close any state, remove the panel from the DOM so it
        // can never render inline.
        dd.classList.remove("open");
        const panel = dd.querySelector(".nav-dd-panel");
        if (panel) panel.remove();
        // No click handler: native <a href> navigation just works.
        return;
      }
      // Desktop: hover positions the panel and sets .open so the cursor
      // can cross from toggle to menu items without dropping :hover.
      dd.addEventListener("pointerenter", () => {
        positionPanel(dd);
        dd.classList.add("open");
      });
      dd.addEventListener("pointerleave", () => {
        dd.classList.remove("open");
      });
      // Click on the toggle: first click opens, second click navigates.
      t.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        if (dd.classList.contains("open")) return;
        e.preventDefault();
        document.querySelectorAll(".nav-dd.open").forEach((other) => {
          if (other !== dd) other.classList.remove("open");
        });
        dd.classList.add("open");
        positionPanel(dd);
      });
    });
    if (mobile) return;  // desktop-only listeners below
    // Click outside any dropdown closes them.
    document.addEventListener("click", (e) => {
      if (e.target.closest(".nav-dd")) return;
      document.querySelectorAll(".nav-dd.open").forEach((dd) => dd.classList.remove("open"));
    });
    // Escape closes any open dropdown (keyboard a11y).
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".nav-dd.open").forEach((dd) => dd.classList.remove("open"));
      }
    });
    // Reposition on scroll / resize while any panel is visible (covers both
    // the hover-open and click-open states).
    function repositionAllVisible() {
      document.querySelectorAll(".nav-dd").forEach((dd) => {
        const panel = dd.querySelector(".nav-dd-panel");
        if (!panel) return;
        // getComputedStyle().visibility is the reliable signal here because
        // it's flipped by both the :hover and .open CSS branches.
        if (getComputedStyle(panel).visibility === "visible") positionPanel(dd);
      });
    }
    window.addEventListener("scroll", repositionAllVisible, { passive: true });
    window.addEventListener("resize", repositionAllVisible);
  }

  function ready() {
    inject();
    wireDropdownToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
