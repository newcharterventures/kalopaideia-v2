// Paideia category landing page — renders the category description plus
// a card grid of child languages. Each card links to the language page.

const BASE = "/paideia";

// Mirrors the registry in language.js / app.js. Keep these three in sync if
// you add languages. (TODO long-term: serve LANG_META from the server so
// there's one source of truth.)
const LANG_META = {
  latin:         { name: "Latin",          subtitle: "Classical Roman letters" },
  greek:         { name: "Greek",          subtitle: "Ancient Hellenic letters" },
  italian:       { name: "Italian",        subtitle: "Trecento & Renaissance letters" },
  french:        { name: "French",         subtitle: "Literary French" },
  german:        { name: "German",         subtitle: "Letters & Philosophy" },
  oldenglish:    { name: "Olde English",   subtitle: "Anglo-Saxon poetry" },
  middleenglish: { name: "Middle English", subtitle: "Chaucer & the Pearl-poet" },
  gaulish:       { name: "Gaulish",        subtitle: "The Continental Celtic of pre-Roman Gaul" },
  welsh:         { name: "Welsh",          subtitle: "Middle Welsh poetry & the modern bardd" },
  oldnorse:      { name: "Old Norse",      subtitle: "The saga-language of medieval Iceland" },
};

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function currentCategorySlug() {
  // /paideia/celtic or /paideia/celtic/ -> "celtic"
  const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return (parts[parts.length - 1] || "").toLowerCase();
}

async function loadCategory() {
  const slug = currentCategorySlug();
  if (!slug) return;

  try {
    const r = await fetch(`${BASE}/api/category/${slug}`);
    if (!r.ok) {
      document.getElementById("cat-name").textContent = "Unknown category";
      document.getElementById("cat-subtitle").textContent = "";
      return;
    }
    const cat = await r.json();
    render(cat);
  } catch (e) {
    console.error("Category load failed:", e);
    document.getElementById("cat-subtitle").textContent = "Failed to load.";
  }
}

function render(cat) {
  document.title = `${cat.name} — Kalopaideia`;
  document.getElementById("cat-greek").textContent = cat.greek_label || "";
  document.getElementById("cat-name").textContent = cat.name;
  document.getElementById("cat-subtitle").textContent = cat.subtitle || "";
  document.getElementById("cat-description").textContent = cat.description || "";

  const grid = document.getElementById("cat-grid");
  grid.innerHTML = (cat.languages || []).map((lang) => {
    const meta = LANG_META[lang] || { name: lang, subtitle: "" };
    return `
      <a class="cat-card" href="${BASE}/${lang}">
        <div class="cat-card-name">${esc(meta.name)}</div>
        <div class="cat-card-sub">${esc(meta.subtitle)}</div>
        <div class="cat-card-cta">Enter the primer →</div>
      </a>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", loadCategory);
