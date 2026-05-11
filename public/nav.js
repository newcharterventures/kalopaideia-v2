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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
