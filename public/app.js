// Paideia front-end — renders today's 5-language edition

const BASE = "/paideia";

// Daily-rotation order. Hybrid plan (Jae 2026-05-11): Welsh and Old Norse
// JOIN the rotation; Gaulish stays reference-only (no daily word). Front
// page now shows nine cards on a regular day.
const LANG_ORDER = ["greek", "latin", "french", "german", "italian", "oldenglish", "middleenglish", "welsh", "oldnorse"];
const LANG_META = {
  latin:         { name: "Latin",          tagline: "Classical Roman letters" },
  greek:         { name: "Greek",          tagline: "Ancient Hellenic letters" },
  italian:       { name: "Italian",        tagline: "Trecento &amp; Renaissance letters" },
  french:        { name: "French",         tagline: "Literary French" },
  german:        { name: "German",         tagline: "Letters &amp; Philosophy" },
  oldenglish:    { name: "Olde English",   tagline: "Anglo-Saxon poetry" },
  middleenglish: { name: "Middle English", tagline: "Chaucer &amp; the Pearl-poet" },
  // Phase 1 additions — metadata only, not yet in daily rotation:
  gaulish:       { name: "Gaulish",        tagline: "Continental Celtic inscriptions", category: "celtic" },
  welsh:         { name: "Welsh",          tagline: "Middle Welsh &amp; the modern bardd", category: "celtic" },
  oldnorse:      { name: "Old Norse",      tagline: "The saga-language of Iceland",       category: "germanic" },
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

// Roman numeral helper for masthead Anno line.
function toRoman(num) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = Math.max(0, Math.floor(num));
  let out = "";
  for (const [v, s] of map) { while (n >= v) { out += s; n -= v; } }
  return out;
}

// Issue/Volume numbering for the Athenaeum masthead.
// Volume = years since 2026 (launch year) + 1 → Volume I in 2026.
// Issue  = day of the year (1-366), so it resets each January 1.
function issueLines(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt   = new Date(Date.UTC(y, m - 1, d));
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const dayOfYear = Math.floor((dt - jan1) / 86400000) + 1;
    const launchYear = 2026;
    const volume = (y - launchYear) + 1;
    return {
      issue: `Issue №\u00a0${dayOfYear}`,
      vol:   `Volume ${toRoman(volume)}`,
      anno:  `Anno Domini ${toRoman(y)}`,
    };
  } catch {
    return { issue: "Issue —", vol: "Volume —", anno: "—" };
  }
}

function renderWord(langKey, entry, date) {
  const hasAudio = true; // audio is generated per language
  const audioPath = `${BASE}/audio/${date}/${langKey}.mp3`;

  const transliteration = entry.transliteration
    ? `<div class="transliteration">${esc(entry.transliteration)}</div>` : "";

  // "In Use" section: original sentence + Listen button after it, then
  // translation on its OWN line below (no audio for the English).
  // Per Jae 2026-05-09: the audio belongs only to the foreign-language
  // sentence; the translation is a silent subtitle. Original/translation
  // separator may be em-dash (—), en-dash (–), or ASCII hyphen with
  // spaces ( - ); accept all three so prompt variants render correctly.
  let usage = "";
  if (entry.usage_example) {
    const ue = entry.usage_example;
    let original = ue, translation = "";
    const splitMatch = ue.match(/\s+[—–]\s+|\s+-\s+/);
    if (splitMatch) {
      const idx = ue.indexOf(splitMatch[0]);
      original = ue.slice(0, idx).trim();
      translation = ue.slice(idx + splitMatch[0].length).trim();
    }
    const sentenceAudio = `${BASE}/api/word-audio/${langKey}/${encodeURIComponent(original)}.mp3`;
    usage = `<div class="detail-section in-use">
         <div class="detail-label">In Use</div>
         <p class="detail-body italic in-use-original">${esc(original)} <button class="audio-btn inline-audio-btn" data-audio="${sentenceAudio}" aria-label="Listen to sentence">▶</button></p>
         ${translation ? `<p class="detail-body in-use-translation">${esc(translation)}</p>` : ""}
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

// AKOUSMA promo card data and renderers live in akousma.js (loaded
// before this file). See AKOUSMA_BOOKS, renderAkousmaCard, fetchAkousmaCount.

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
      ${renderAkousmaCard(langKey)}
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

    // Athenaeum masthead: populate the three ledger lines.
    document.getElementById("today-date").textContent = formatDate(issue.date);
    const lines = issueLines(issue.date);
    const issueEl = document.getElementById("issue-line");
    const volEl   = document.getElementById("vol-line");
    const annoEl  = document.getElementById("anno-line");
    if (issueEl) issueEl.textContent = lines.issue;
    if (volEl)   volEl.textContent   = lines.vol;
    if (annoEl)  annoEl.textContent  = lines.anno;
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
    fetchAkousmaCount();
    
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
  // Re-populate the dynamic Akousma count on any newly-rendered cards.
  fetchAkousmaCount();
  
  // Update or hide button
  if (archiveShown >= archiveDates.length) {
    moreBtn.style.display = "none";
  } else {
    moreBtn.disabled = false;
    moreBtn.textContent = `View more (${archiveDates.length - archiveShown} more)`;
  }
}

load();
