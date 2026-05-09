// Paideia front-end — renders today's 5-language edition

const BASE = "/paideia";

const LANG_ORDER = ["latin", "greek", "italian", "french", "german", "oldenglish", "middleenglish"];
const LANG_META = {
  latin:         { name: "Latin",          tagline: "Classical Roman letters" },
  greek:         { name: "Greek",          tagline: "Ancient Hellenic letters" },
  italian:       { name: "Italian",        tagline: "Trecento &amp; Renaissance letters" },
  french:        { name: "French",         tagline: "Literary French" },
  german:        { name: "German",         tagline: "Letters &amp; Philosophy" },
  oldenglish:    { name: "Old English",    tagline: "Anglo-Saxon poetry" },
  middleenglish: { name: "Middle English", tagline: "Chaucer &amp; the Pearl-poet" },
};

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Break a word into its constituent letters, separated by middle dots.
 * Handles combining diacritics via NFC normalization + grapheme iteration.
 * Strips punctuation inside compound headwords.
 */
function letterBreakdown(word) {
  if (!word) return "";
  const normalized = String(word).normalize("NFC");
  // Split into graphemes (Array.from handles surrogate pairs + combining marks
  // that are already composed via NFC).
  const letters = Array.from(normalized).filter(ch => {
    // Drop whitespace but keep letters/marks/apostrophes
    return !/\s/.test(ch);
  });
  return letters.join(" · ");
}

function formatDate(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  } catch { return iso; }
}

function renderWord(langKey, entry, date) {
  const hasAudio = true; // audio is generated per language
  const audioPath = `${BASE}/audio/${date}/${langKey}.mp3`;

  const transliteration = entry.transliteration
    ? `<div class="transliteration">${esc(entry.transliteration)}</div>` : "";

  // "In Use" section: original sentence + Listen button after it + translation
  let usage = "";
  if (entry.usage_example) {
    const original = entry.usage_example.split("—")[0].trim();
    const translation = entry.usage_example.includes("—")
      ? entry.usage_example.split("—").slice(1).join("—").trim() : "";
    const sentenceAudio = `${BASE}/api/word-audio/${langKey}/${encodeURIComponent(original)}.mp3`;
    usage = `<div class="detail-section">
         <div class="detail-label">In Use</div>
         <p class="detail-body italic">${esc(original)} <button class="audio-btn inline-audio-btn" data-audio="${sentenceAudio}" aria-label="Listen to sentence">▶</button>${translation ? `<span class="translation">${esc(translation)}</span>` : ""}</p>
       </div>`;
  }

  return `
    <div class="word-card" data-lang="${langKey}">
      <div class="headword-row">
        <h3 class="headword">${esc(entry.word)}</h3>
        <button class="audio-btn" data-audio="${audioPath}" aria-label="Pronounce ${esc(entry.word)}">▶</button>
      </div>
      ${transliteration}
      <div class="pos-line">${esc(entry.part_of_speech || "")}</div>
      <div class="meaning">${esc(entry.meaning || "")}</div>
      <div class="pronunciation"><b>Say:</b> ${esc(entry.pronunciation || "")} <b style="margin-left:12px">IPA:</b> ${esc(entry.ipa || "")}</div>
      ${(typeof LetterPhonetics !== 'undefined') ? LetterPhonetics.renderHtml(entry.word, langKey, esc) : ''}

      ${entry.forms ? `<div class="detail-section"><div class="detail-label">Forms</div><p class="detail-body">${esc(entry.forms)}</p></div>` : ""}
      ${entry.etymology ? `<div class="detail-section"><div class="detail-label">Etymology</div><p class="detail-body">${esc(entry.etymology)}</p></div>` : ""}
      ${entry.literary_context ? `<div class="detail-section"><div class="detail-label">In Literature</div><p class="detail-body">${esc(entry.literary_context)}</p></div>` : ""}
      ${usage}
      ${entry.did_you_know ? `<div class="detail-section"><div class="detail-label">Did You Know</div><p class="detail-body">${esc(entry.did_you_know)}</p></div>` : ""}
    </div>
  `;
}

function renderCulture(vignette) {
  if (!vignette) return `<div class="culture-card"><div class="culture-text"><em class="culture-body">Cultural vignette in preparation.</em></div></div>`;
  const img = vignette.image
    ? `<div class="culture-image-wrap">
         <img class="culture-image" src="${esc(vignette.image.url)}" alt="${esc(vignette.title)}" loading="lazy" />
         <span class="culture-credit">${esc(vignette.image.credit)}</span>
       </div>`
    : "";
  return `
    <div class="culture-card">
      ${img}
      <div class="culture-text">
        <h3 class="culture-title">${esc(vignette.title)}</h3>
        <p class="culture-body">${esc(vignette.body)}</p>
      </div>
    </div>
  `;
}

function renderSection(langKey, entry, culture, date) {
  const meta = LANG_META[langKey] || { name: langKey, tagline: "" };
  return `
    <section class="lang-section" id="${langKey}">
      <div class="lang-header">
        <div class="lang-name">${meta.name}</div>
        <div class="lang-tagline">${meta.tagline}</div>
      </div>
      <div class="word-block">
        ${renderWord(langKey, entry, date)}
        ${renderCulture(culture)}
      </div>
    </section>
  `;
}

// Single shared audio state across the page so re-wiring after archive loads
// doesn't create duplicate listeners (which caused echo when one button got
// wired multiple times).
let __audioState = { current: null };

function wireAudio() {
  document.querySelectorAll(".audio-btn").forEach((btn) => {
    if (btn.dataset.wired === "1") return; // already wired
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const src = btn.dataset.audio;
      if (!src) return;
      const cur = __audioState.current;
      if (cur) {
        cur.audio.pause();
        cur.btn.classList.remove("playing");
        cur.btn.textContent = "▶";
        __audioState.current = null;
        if (cur.btn === btn) return; // toggle off
      }
      const audio = new Audio(src);
      btn.classList.add("playing");
      btn.textContent = "■";
      audio.play().catch((err) => {
        console.error("audio play failed", err);
        btn.classList.remove("playing");
        btn.textContent = "▶";
        __audioState.current = null;
      });
      audio.addEventListener("ended", () => {
        btn.classList.remove("playing");
        btn.textContent = "▶";
        if (__audioState.current && __audioState.current.btn === btn) {
          __audioState.current = null;
        }
      });
      __audioState.current = { audio, btn };
    });
  });
}

async function load() {
  try {
    const res = await fetch(`${BASE}/api/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const issue = await res.json();

    document.getElementById("today-date").textContent = formatDate(issue.date);
    document.getElementById("loading").style.display = "none";

    // Load primer alphabets for all languages we'll render (for letter breakdown)
    if (typeof LetterPhonetics !== 'undefined') {
      await Promise.all(
        LANG_ORDER
          .filter((k) => issue.languages?.[k])
          .map((k) => LetterPhonetics.ensurePrimer(k))
      );
    }

    const html = LANG_ORDER
      .filter((k) => issue.languages?.[k])
      .map((k) => renderSection(k, issue.languages[k], issue.culture?.[k], issue.date))
      .join("");
    document.getElementById("sections").innerHTML = html;
    wireAudio();
    
    // Initialize archive scroller below today
    initArchive(issue.date);
  } catch (err) {
    document.getElementById("loading").style.display = "none";
    const e = document.getElementById("error");
    e.style.display = "";
    e.textContent = "Today's edition is still being prepared. Please check back shortly.";
  }
}

// === Archive feed below today ===
let archiveDates = [];
let archiveShown = 0;
const ARCHIVE_BATCH = 3;

async function initArchive(todayDate) {
  try {
    const r = await fetch(`${BASE}/api/archive`);
    if (!r.ok) return;
    const { dates } = await r.json();
    archiveDates = (dates || []).filter((d) => d !== todayDate);
    if (archiveDates.length === 0) return;
    
    const sections = document.getElementById("sections");
    const archiveContainer = document.createElement("div");
    archiveContainer.id = "archive-container";
    sections.parentNode.insertBefore(archiveContainer, sections.nextSibling);
    
    const moreBtn = document.createElement("button");
    moreBtn.id = "archive-more-btn";
    moreBtn.className = "archive-more-btn";
    moreBtn.textContent = "View more";
    moreBtn.addEventListener("click", loadMoreArchive);
    archiveContainer.parentNode.insertBefore(moreBtn, archiveContainer.nextSibling);
    
    // Auto-load first batch
    await loadMoreArchive();
  } catch (e) {
    console.error("archive init failed", e);
  }
}

async function loadMoreArchive() {
  const container = document.getElementById("archive-container");
  const moreBtn = document.getElementById("archive-more-btn");
  if (!container || !moreBtn) return;
  
  moreBtn.disabled = true;
  moreBtn.textContent = "Loading…";
  
  const slice = archiveDates.slice(archiveShown, archiveShown + ARCHIVE_BATCH);
  archiveShown += slice.length;
  
  for (const date of slice) {
    try {
      const r = await fetch(`${BASE}/api/day/${date}`);
      if (!r.ok) continue;
      const issue = await r.json();
      const dayWrap = document.createElement("section");
      dayWrap.className = "archive-day";
      const dateEl = document.createElement("div");
      dateEl.className = "archive-day-date";
      dateEl.textContent = formatDate(issue.date);
      dayWrap.appendChild(dateEl);
      
      const html = LANG_ORDER
        .filter((k) => issue.languages?.[k])
        .map((k) => renderSection(k, issue.languages[k], issue.culture?.[k], issue.date))
        .join("");
      const inner = document.createElement("div");
      inner.innerHTML = html;
      dayWrap.appendChild(inner);
      
      container.appendChild(dayWrap);
    } catch (e) {
      console.error("archive day load failed", date, e);
    }
  }
  
  // Re-wire audio buttons (idempotent — wireAudio re-attaches by class)
  wireAudio();
  
  // Update or hide button
  if (archiveShown >= archiveDates.length) {
    moreBtn.style.display = "none";
  } else {
    moreBtn.disabled = false;
    moreBtn.textContent = `View more (${archiveDates.length - archiveShown} more)`;
  }
}

load();
