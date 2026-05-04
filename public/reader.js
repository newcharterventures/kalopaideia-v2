// Paideia reader — supports flat texts and multi-section texts with session pagination

import { recordBookmark, getBookmarks } from "/paideia/bookmarks.js";

const BASE = "/paideia";
const SESSION_SIZE = 10; // lines per session view

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Wrap each word in a tappable span for dictionary lookup.
// Preserves punctuation by emitting it outside the spans.
function wordify(original) {
  if (!original) return "";
  // Split by whitespace, preserving whitespace in between
  const parts = original.split(/(\s+)/);
  return parts.map((chunk) => {
    if (/^\s+$/.test(chunk)) return chunk;
    // Split off leading/trailing punctuation from the word core
    const m = chunk.match(/^([\p{P}\p{S}]*)(.*?)([\p{P}\p{S}]*)$/u);
    if (!m) return esc(chunk);
    const [, pre, core, post] = m;
    if (!core) return esc(chunk);
    return `${esc(pre)}<span class="word" data-word="${esc(core)}">${esc(core)}</span>${esc(post)}`;
  }).join("");
}

function currentId() {
  return location.pathname.split("/").pop();
}

let text = null;
let activeSectionId = null;       // null = text has no sections; otherwise the current section id
let currentLineIdx = 0;           // index within the flat or active-section lines
let currentSessionStart = 0;      // start index of the current session window
let mode = "single";              // "single" | "session" | "chapters"
let currentAudio = null;

function sectionById(sectionId) {
  if (!text?.sections) return null;
  return text.sections.find((s) => s.id === sectionId) || null;
}

function currentLines() {
  if (activeSectionId) return sectionById(activeSectionId)?.lines || [];
  return text.lines || [];
}

// --- Audio ---
function playLineAudio(lineObj, buttonEl) {
  if (!lineObj) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const src = `${BASE}/library-audio/${text.id}/${lineObj.n}.mp3`;
  const audio = new Audio(src);
  if (buttonEl) {
    buttonEl.classList.add("playing");
  }
  audio.play().catch(() => {});
  audio.addEventListener("ended", () => {
    if (buttonEl) buttonEl.classList.remove("playing");
  });
  audio.addEventListener("error", () => {
    if (buttonEl) buttonEl.classList.remove("playing");
  });
  currentAudio = audio;
}

// --- Single-line mode (existing UI) ---
function renderSingleLine() {
  const lines = currentLines();
  const line = lines[currentLineIdx];
  if (!line) return;

  document.getElementById("reader-body").innerHTML = `
    <div class="reader-line-card" data-line-n="${line.n}">
      <div class="reader-line-num">Line ${line.n}</div>
      <div class="reader-original" data-original="${esc(line.original)}" data-english="${esc(line.english)}">${wordify(line.original)}</div>
      ${line.english && line.english.trim() ? `<div class="reader-english">${esc(line.english)}</div>` : ""}
      <button class="reader-audio-btn" id="play-btn" aria-label="Play pronunciation">▶ Listen</button>
      <div class="reader-gloss">
        ${line.gloss ? `<div class="gloss-label">Notes</div><div class="gloss-body">${esc(line.gloss)}</div>` : ""}
      </div>
    </div>
    <div class="reader-controls">
      <button class="reader-nav-btn" id="prev-btn" ${currentLineIdx === 0 ? "disabled" : ""}>← Previous</button>
      <button class="reader-nav-btn" id="next-btn" ${currentLineIdx === lines.length - 1 ? "disabled" : ""}>Next →</button>
    </div>
  `;

  document.getElementById("play-btn").addEventListener("click", (e) => playLineAudio(line, e.currentTarget));
  document.getElementById("prev-btn").addEventListener("click", () => {
    if (currentLineIdx > 0) { currentLineIdx--; renderSingleLine(); updateProgress(); }
  });
  document.getElementById("next-btn").addEventListener("click", () => {
    if (currentLineIdx < lines.length - 1) { currentLineIdx++; renderSingleLine(); updateProgress(); }
  });
}

// --- Session mode (N lines at once) ---
function renderSession() {
  const lines = currentLines();
  const start = currentSessionStart;
  const end = Math.min(start + SESSION_SIZE, lines.length);
  const slice = lines.slice(start, end);

  const lineHtml = slice.map((l, i) => `
    <div class="session-line" data-n="${l.n}">
      <div class="session-line-num">${l.n}</div>
      <div class="session-original" data-original="${esc(l.original)}" data-english="${esc(l.english)}">${wordify(l.original)}</div>
      ${l.english && l.english.trim() ? `<div class="session-english">${esc(l.english)}</div>` : ""}
      <button class="session-audio-btn" data-idx="${start + i}" aria-label="Play line ${l.n}">▶</button>
      ${l.gloss ? `<details class="session-gloss"><summary>Notes</summary><div class="gloss-body">${esc(l.gloss)}</div></details>` : ""}
    </div>
  `).join("");

  const hasPrev = start > 0;
  const hasNext = end < lines.length;

  // If text has paragraph-level English translation (long works like Iliad),
  // show a collapsible panel with the relevant portion.
  const paragraphsPanel = text.english_paragraphs && text.english_paragraphs.length
    ? `<details class="english-panel"><summary>Butler's prose translation for this section</summary><div class="english-body">${text.english_paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div></details>`
    : "";

  document.getElementById("reader-body").innerHTML = `
    <div class="session-card">
      <div class="session-header">Lines ${slice[0]?.n}–${slice[slice.length-1]?.n} of ${lines[0]?.n}–${lines[lines.length-1]?.n}</div>
      ${lineHtml}
    </div>
    ${paragraphsPanel}
    <div class="reader-controls">
      <button class="reader-nav-btn" id="prev-session" ${hasPrev ? "" : "disabled"}>← Previous session</button>
      <button class="reader-nav-btn" id="next-session" ${hasNext ? "" : "disabled"}>Continue →</button>
    </div>
  `;

  // Wire audio buttons
  document.querySelectorAll(".session-audio-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const line = lines[idx];
      playLineAudio(line, btn);
    });
  });

  document.getElementById("prev-session").addEventListener("click", () => {
    if (hasPrev) { currentSessionStart = Math.max(0, start - SESSION_SIZE); renderSession(); updateProgress(); }
  });
  document.getElementById("next-session").addEventListener("click", () => {
    if (hasNext) { currentSessionStart = end; renderSession(); updateProgress(); }
  });
}

// --- Chapter chooser (for texts with sections) ---
function renderChapters() {
  const sections = text.sections || [];
  document.getElementById("reader-body").innerHTML = `
    <div class="chapters-wrap">
      <h3 class="pane-heading">Chapters</h3>
      <p class="library-intro">This text is divided into sections. Open any section to read it one line at a time or one session at a time.</p>
      <ul class="library-list">
        ${sections.map((s) => `
          <li class="library-item">
            <a href="#" class="library-link chapter-link" data-section="${esc(s.id)}">
              <div class="lib-row">
                <div class="lib-main">
                  <div class="lib-title">${esc(s.title)}</div>
                  <div class="lib-meta">${s.lines.length} lines</div>
                </div>
                <span class="lib-status lib-status-open">Open</span>
              </div>
            </a>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
  document.querySelectorAll(".chapter-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activeSectionId = a.dataset.section;
      currentLineIdx = 0;
      currentSessionStart = 0;
      mode = "session";
      renderMode();
      updateProgress();
    });
  });
}

// --- Mode switcher ---
function renderMode() {
  if (!text) return;
  if (mode === "chapters") { renderChapters(); return; }
  if (mode === "session") { renderSession(); return; }
  renderSingleLine();
}

function updateProgress() {
  const lines = currentLines();
  const progressEl = document.getElementById("line-current");
  const totalEl = document.getElementById("line-total");
  if (mode === "chapters") {
    progressEl.textContent = "—";
    totalEl.textContent = "—";
  } else if (mode === "session") {
    const end = Math.min(currentSessionStart + SESSION_SIZE, lines.length);
    progressEl.textContent = `${currentSessionStart + 1}–${end}`;
    totalEl.textContent = lines.length;
  } else {
    progressEl.textContent = currentLineIdx + 1;
    totalEl.textContent = lines.length;
  }
  // Record bookmark whenever the user moves in Session or Line-by-Line mode
  if (text && mode !== "chapters" && lines.length) {
    const currentLine = mode === "session" ? lines[currentSessionStart] : lines[currentLineIdx];
    if (currentLine) {
      recordBookmark({
        text_id: text.id,
        language: text.language,
        title: text.title,
        section_id: activeSectionId,
        line_n: currentLine.n,
        total_lines: lines.length,
      });
    }
  }
  // Breadcrumb
  const crumb = document.getElementById("section-crumb");
  if (activeSectionId) {
    const sec = sectionById(activeSectionId);
    crumb.innerHTML = `<button id="crumb-back" class="crumb-back">← Chapters</button><span class="crumb-sep">/</span><span class="crumb-current">${esc(sec?.title || "")}</span>`;
    document.getElementById("crumb-back").addEventListener("click", () => {
      activeSectionId = null;
      currentLineIdx = 0;
      currentSessionStart = 0;
      mode = "chapters";
      renderMode();
      updateProgress();
    });
  } else {
    crumb.innerHTML = "";
  }
}

function wireModeTabs() {
  document.querySelectorAll(".reader-mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".reader-mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.mode;

      if (mode === "chapters" && !text.sections) {
        mode = "single";
        tab.classList.remove("active");
        document.querySelector('.reader-mode-tab[data-mode="single"]').classList.add("active");
      }

      // For Session or Line-by-Line modes on a sectioned text with no section
      // chosen yet, default to the first section so we have lines to show.
      if ((mode === "session" || mode === "single") && text.sections && !activeSectionId) {
        activeSectionId = text.sections[0].id;
        currentLineIdx = 0;
        currentSessionStart = 0;
      }

      if (mode !== "chapters") {
        currentSessionStart = Math.floor(currentLineIdx / SESSION_SIZE) * SESSION_SIZE;
      }
      renderMode();
      updateProgress();
    });
  });
}

// === Word popover ===
let popoverEl = null;
function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement("div");
  popoverEl.className = "word-popover";
  popoverEl.hidden = true;
  document.body.appendChild(popoverEl);
  return popoverEl;
}

function hidePopover() {
  if (popoverEl) popoverEl.hidden = true;
}

function positionPopover(anchor) {
  const rect = anchor.getBoundingClientRect();
  const pop = popoverEl;
  pop.hidden = false;
  // Position below the word, centered; clamp to viewport
  const popRect = pop.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  let top = rect.bottom + window.scrollY + 8;
  const vw = window.innerWidth;
  if (left < 10) left = 10;
  if (left + popRect.width > vw - 10) left = vw - popRect.width - 10;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

async function showPopoverFor(wordSpan) {
  const word = wordSpan.dataset.word;
  if (!word) return;
  const container = wordSpan.closest("[data-original]");
  const line = container?.dataset?.original || "";
  const english = container?.dataset?.english || "";

  const pop = ensurePopover();
  pop.innerHTML = `
    <div class="word-pop-head">
      <span class="word-pop-word">${esc(word)}</span>
      <button class="word-pop-close" aria-label="Close">×</button>
    </div>
    <div class="word-pop-body"><em>Looking up…</em></div>
  `;
  pop.hidden = false;
  positionPopover(wordSpan);
  pop.querySelector(".word-pop-close").addEventListener("click", hidePopover);

  try {
    const url = `${BASE}/api/word/${encodeURIComponent(text.language)}/${encodeURIComponent(word)}?line=${encodeURIComponent(line)}&en=${encodeURIComponent(english)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    const entry = data.entry;
    pop.querySelector(".word-pop-body").innerHTML = renderWordEntry(entry) + renderWordAudioControl(word);
    wireWordAudio(pop, word);
    positionPopover(wordSpan);
  } catch (err) {
    pop.querySelector(".word-pop-body").innerHTML = `<div class="word-pop-empty">No entry found for <b>${esc(word)}</b>.</div>` + renderWordAudioControl(word);
    wireWordAudio(pop, word);
    positionPopover(wordSpan);
  }
}

function renderWordAudioControl(word) {
  return `
    <div class="word-pop-audio">
      <button class="word-pop-listen" data-word="${esc(word)}" aria-label="Listen to pronunciation">
        ▶ Listen
      </button>
    </div>
  `;
}

function wireWordAudio(popEl, word) {
  const btn = popEl.querySelector(".word-pop-listen");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const src = `${BASE}/api/word-audio/${encodeURIComponent(text.language)}/${encodeURIComponent(word)}.mp3`;
    btn.textContent = "⬛ Playing";
    btn.classList.add("playing");
    const audio = new Audio(src);
    audio.addEventListener("ended", () => {
      btn.textContent = "▶ Listen";
      btn.classList.remove("playing");
    });
    audio.addEventListener("error", () => {
      btn.textContent = "✗ Audio unavailable";
      btn.classList.remove("playing");
    });
    try { await audio.play(); } catch {
      btn.textContent = "✗ Tap to retry";
      btn.classList.remove("playing");
    }
  });
}

function renderWordEntry(entry) {
  if (!entry) return "<em>No entry.</em>";
  if (entry.source === "wiktionary") {
    const defs = (entry.definitions || []).map((d) => `<div class="word-def">${esc(d.text)}</div>`).join("");
    const formRow = entry.form ? `<div class="word-form">${esc(entry.form)}</div>` : "";
    const lemmaRow = entry.lemma ? `<div class="word-lemma">Lemma: <b>${esc(entry.lemma)}</b></div>` : "";
    return `
      ${entry.part_of_speech ? `<div class="word-pos">${esc(entry.part_of_speech)}</div>` : ""}
      ${formRow}
      ${lemmaRow}
      ${defs}
      <div class="word-source">Wiktionary</div>
    `;
  }
  // Claude-sourced entry (structured)
  const rows = [];
  if (entry.lemma && entry.lemma !== entry.word) rows.push(`<div><b>Lemma:</b> ${esc(entry.lemma)}</div>`);
  if (entry.part_of_speech) rows.push(`<div class="word-pos">${esc(entry.part_of_speech)}</div>`);
  if (entry.form) rows.push(`<div><b>Form:</b> ${esc(entry.form)}</div>`);
  if (entry.meaning) rows.push(`<div class="word-def">${esc(entry.meaning)}</div>`);
  if (entry.etymology) rows.push(`<div class="word-etym">${esc(entry.etymology)}</div>`);
  if (entry.in_context) rows.push(`<div class="word-ctx"><em>${esc(entry.in_context)}</em></div>`);
  rows.push(`<div class="word-source">Kalopaideia lexicon</div>`);
  return rows.join("");
}

function wireWordClicks() {
  // One delegated listener, idempotent
  if (document._paideiaWordsWired) return;
  document._paideiaWordsWired = true;
  document.addEventListener("click", (e) => {
    const w = e.target.closest(".word");
    if (w) { e.preventDefault(); showPopoverFor(w); return; }
    const pop = popoverEl;
    if (pop && !pop.hidden && !e.target.closest(".word-popover")) hidePopover();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePopover();
  });
}

async function load() {
  const id = currentId();
  try {
    const res = await fetch(`${BASE}/api/library/text/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.json();

    document.title = `${text.title} · Kalopaideia`;
    document.getElementById("reader-title").textContent = text.title;
    document.getElementById("reader-author").textContent = `${text.author}${text.date ? " · " + text.date : ""}`;
    document.getElementById("reader-trans").textContent = text.translator
      ? `Translated by ${text.translator}, ${text.translator_date || ""}. ${text.license || ""}.`
      : "";
    document.getElementById("reader-notes").textContent = text.reading_notes || "";
    document.getElementById("reader-section-label").textContent = (text.language || "").replace(/^./, (c) => c.toUpperCase());

    // Restore from bookmark if present
    const bookmarks = getBookmarks();
    const existing = bookmarks.find((b) => b.text_id === text.id);
    const shouldResume = existing && new URLSearchParams(location.search).get("resume") !== "0";

    // Set mode based on whether text has sections
    if (text.sections && text.sections.length > 0) {
      document.getElementById("mode-chapters").style.display = "";
      if (shouldResume && existing.section_id) {
        activeSectionId = existing.section_id;
        mode = "session";
        const lines = currentLines();
        const lineIdx = lines.findIndex((l) => l.n === existing.line_n);
        if (lineIdx >= 0) {
          currentLineIdx = lineIdx;
          currentSessionStart = Math.floor(lineIdx / SESSION_SIZE) * SESSION_SIZE;
        }
        document.querySelectorAll(".reader-mode-tab").forEach((t) => t.classList.remove("active"));
        document.querySelector('.reader-mode-tab[data-mode="session"]').classList.add("active");
      } else {
        activeSectionId = null;
        mode = "chapters";
        document.querySelectorAll(".reader-mode-tab").forEach((t) => t.classList.remove("active"));
        document.getElementById("mode-chapters").classList.add("active");
      }
    } else {
      document.getElementById("mode-chapters").style.display = "none";
      if (shouldResume) {
        const lines = currentLines();
        const lineIdx = lines.findIndex((l) => l.n === existing.line_n);
        if (lineIdx >= 0) {
          currentLineIdx = lineIdx;
          currentSessionStart = Math.floor(lineIdx / SESSION_SIZE) * SESSION_SIZE;
        }
      }
      mode = "session";
      document.querySelectorAll(".reader-mode-tab").forEach((t) => t.classList.remove("active"));
      document.querySelector('.reader-mode-tab[data-mode="session"]').classList.add("active");
    }

    document.getElementById("reader-loading").style.display = "none";
    document.getElementById("reader").style.display = "";

    wireModeTabs();
    wireWordClicks();
    renderMode();
    updateProgress();

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (mode === "single") {
        if (e.key === "ArrowLeft") document.getElementById("prev-btn")?.click();
        if (e.key === "ArrowRight") document.getElementById("next-btn")?.click();
        if (e.key === " ") { e.preventDefault(); document.getElementById("play-btn")?.click(); }
      } else if (mode === "session") {
        if (e.key === "ArrowLeft") document.getElementById("prev-session")?.click();
        if (e.key === "ArrowRight") document.getElementById("next-session")?.click();
      }
    });
  } catch (err) {
    document.getElementById("reader-loading").textContent = "Could not open this text.";
    console.error(err);
  }
}

load();
