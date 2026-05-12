// Paideia shared masthead nav — one source of truth for the link list.
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
    { href: "/paideia/store",       label: "Store",   util: true },
    { href: "/paideia/account",     label: "Sign in", util: true },
    { href: "/paideia/about.html",  label: "About",   util: true },
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

  // Tap-to-toggle for touch / pen interactions. Desktop with a mouse gets
  // the CSS :hover path and never trips the JS preventDefault. We detect
  // the trigger type per-event from PointerEvent.pointerType, because
  // viewport width is a bad proxy (hybrid laptops, Surface, iPad Pro with
  // a keyboard, etc. report wide viewports while only supporting touch).
  // Per Jae 2026-05-12: previous media-query gate broke desktop dropdowns
  // on touch-capable laptops where (hover: none) matched.
  function wireDropdownToggles() {
    const toggles = document.querySelectorAll(".nav-dd .nav-dd-toggle");
    toggles.forEach((t) => {
      const dd = t.closest(".nav-dd");
      if (!dd) return;
      let lastPointerType = null;
      t.addEventListener("pointerdown", (e) => { lastPointerType = e.pointerType; });
      t.addEventListener("click", (e) => {
        // Mouse click on desktop: let the CSS hover path handle the panel
        // and let the link navigate to the category landing page.
        if (lastPointerType === "mouse") return;
        // Touch / pen: if the panel is already open, let the click navigate
        // to the landing page (second tap = go).
        if (dd.classList.contains("open")) return;
        // Otherwise (first touch tap), open the panel and swallow the click.
        e.preventDefault();
        document.querySelectorAll(".nav-dd.open").forEach((other) => {
          if (other !== dd) other.classList.remove("open");
        });
        dd.classList.add("open");
      });
    });
    // Tap outside any dropdown closes them.
    document.addEventListener("click", (e) => {
      if (e.target.closest(".nav-dd")) return;
      document.querySelectorAll(".nav-dd.open").forEach((dd) => dd.classList.remove("open"));
    });
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
