// Kalopaideia reader v2 — Claude Design's prototype layout.
// Surfaces:
//   work-head (eyebrow / series / title / subline / byline)
//   sticky player bar (transport + line title + view-mode segmented)
//   3-col reader-grid: ToC | parallel-text lines | notes/save panel
//   "Working alongside" library grid at the bottom
//
// All existing behavior preserved: chapter/session/line modes,
// word-click popovers, bookmarks, on-demand line audio, word audio,
// keyboard shortcuts. Pricing/access untouched.

import { recordBookmark, getBookmarks } from "/paideia/bookmarks.js";

const BASE = "/paideia";
const SESSION_SIZE = 10;

function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Render the gloss field as light markdown: **bold**, *italic*. Source
// text is HTML-escaped FIRST so attackers/curators can't inject tags;
// only the literal asterisks become <b>/<i>. Per Jae 2026-05-21: the
// gloss corpus uses **headword** to mark each Greek word it's defining,
// and showing the raw asterisks made the page look broken.
function renderGloss(raw) {
  if (!raw) return "";
  let html = esc(raw);
  // **bold** — non-greedy, must contain at least one non-space char.
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
  // *italic* — single asterisks, only if not adjacent to another asterisk.
  html = html.replace(/(^|[^\*])\*([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>');
  return html;
}

// Wrap each word in a tappable span (preserves leading/trailing punctuation).
function wordify(original) {
  if (!original) return "";
  const parts = original.split(/(\s+)/);
  return parts.map((chunk) => {
    if (/^\s+$/.test(chunk)) return chunk;
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
let activeSectionId = null;
let currentLineIdx = 0;
let currentSessionStart = 0;
let mode = "single";
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
  if (buttonEl) buttonEl.classList.add("playing");
  audio.play().catch(() => {});
  audio.addEventListener("ended", () => { if (buttonEl) buttonEl.classList.remove("playing"); });
  audio.addEventListener("error", () => { if (buttonEl) buttonEl.classList.remove("playing"); });
  currentAudio = audio;

  // Sync the scrubber fill to the playing line, when we know the duration.
  audio.addEventListener("loadedmetadata", () => {
    const fill = document.getElementById("scrub-fill");
    if (fill) fill.style.width = "0%";
  });
  audio.addEventListener("timeupdate", () => {
    const fill = document.getElementById("scrub-fill");
    if (fill && audio.duration) fill.style.width = `${Math.min(100, (audio.currentTime / audio.duration) * 100)}%`;
  });
}

// --- Line-by-line view (single line, large) ---
function renderSingleLine() {
  const lines = currentLines();
  const line = lines[currentLineIdx];
  if (!line) return;

  const greek = `<div class="gr" data-original="${esc(line.original)}" data-english="${esc(line.english || '')}">${wordify(line.original)}</div>`;
  const english = line.english && line.english.trim()
    ? `<div class="en">${esc(line.english)}</div>`
    : `<div class="en"><em style="color:var(--akv2-ink-3)">—</em></div>`;
  const noteMarker = (line.gloss && line.gloss.trim())
    ? `<span class="akv2-note-marker" data-line-n="${line.n}" title="Scholarly note on line ${line.n}" aria-label="Scholarly note on line ${line.n}">✻</span>`
    : '';

  document.getElementById("reader-body").innerHTML = `
    <div class="akv2-line-row current" data-line-n="${line.n}">
      <div class="ln">${line.n}</div>
      ${greek}
      ${english}
      ${noteMarker}
    </div>
    <div class="akv2-reader-footer">
      <div class="lbl">Showing line <span class="lining">${line.n}</span> of <span class="lining">${lines[lines.length - 1]?.n || lines.length}</span></div>
      <div style="display:flex; gap:10px;">
        <button id="footer-prev" ${currentLineIdx === 0 ? "disabled" : ""}>← Previous</button>
        <button id="footer-next" ${currentLineIdx === lines.length - 1 ? "disabled" : ""}>Next line →</button>
      </div>
    </div>
  `;

  document.getElementById("footer-prev")?.addEventListener("click", () => {
    if (currentLineIdx > 0) { currentLineIdx--; renderSingleLine(); updateProgress(); }
  });
  document.getElementById("footer-next")?.addEventListener("click", () => {
    if (currentLineIdx < lines.length - 1) { currentLineIdx++; renderSingleLine(); updateProgress(); }
  });

  refreshNotePanel(line);
}

// --- Session view (N lines at once, the canonical "reading" view) ---
function renderSession() {
  const lines = currentLines();
  const start = currentSessionStart;
  const end = Math.min(start + SESSION_SIZE, lines.length);
  const slice = lines.slice(start, end);

  const rows = slice.map((l, i) => {
    const isCurrent = (start + i) === currentLineIdx;
    const greek = `<div class="gr" data-original="${esc(l.original)}" data-english="${esc(l.english || '')}">${wordify(l.original)}</div>`;
    const english = l.english && l.english.trim()
      ? `<div class="en">${esc(l.english)}</div>`
      : `<div class="en"><em style="color:var(--akv2-ink-3)">—</em></div>`;
    const noteMarker = (l.gloss && l.gloss.trim())
      ? `<span class="akv2-note-marker" data-line-n="${l.n}" title="Scholarly note on line ${l.n}" aria-label="Scholarly note on line ${l.n}">✻</span>`
      : '';
    return `
      <div class="akv2-line-row${isCurrent ? ' current' : ''}" data-idx="${start + i}" data-line-n="${l.n}">
        <div class="ln">${l.n}</div>
        ${greek}
        ${english}
        ${noteMarker}
      </div>
    `;
  }).join("");

  const hasPrev = start > 0;
  const hasNext = end < lines.length;

  const paragraphsPanel = text.english_paragraphs && text.english_paragraphs.length
    ? `<details class="english-panel" style="margin-top:24px"><summary>Butler's prose translation for this section</summary><div class="english-body">${text.english_paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div></details>`
    : "";

  document.getElementById("reader-body").innerHTML = `
    ${rows}
    ${paragraphsPanel}
    <div class="akv2-reader-footer">
      <div class="lbl">Showing lines <span class="lining">${slice[0]?.n}</span>–<span class="lining">${slice[slice.length - 1]?.n}</span> of <span class="lining">${lines[lines.length - 1]?.n || lines.length}</span></div>
      <div style="display:flex; gap:10px;">
        <button id="footer-prev" ${hasPrev ? "" : "disabled"}>← Previous</button>
        <button id="footer-next" ${hasNext ? "" : "disabled"}>Continue reading →</button>
      </div>
    </div>
  `;

  // Click a row to make it current + play its audio.
  document.querySelectorAll(".akv2-line-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".word")) return; // word popover handles its own clicks
      // The note marker has its own click handler — don't double-fire.
      if (e.target.classList.contains("akv2-note-marker")) return;
      const idx = parseInt(row.dataset.idx, 10);
      if (Number.isNaN(idx)) return;
      currentLineIdx = idx;
      document.querySelectorAll(".akv2-line-row").forEach((r) => r.classList.remove("current"));
      row.classList.add("current");
      const line = lines[idx];
      playLineAudio(line, null);
      refreshNotePanel(line);
      updateProgress();
    });
  });

  // ✻ note-marker clicks: make the line current AND focus the notes panel.
  document.querySelectorAll(".akv2-note-marker").forEach((marker) => {
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = marker.closest(".akv2-line-row");
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      if (!Number.isNaN(idx)) {
        currentLineIdx = idx;
        document.querySelectorAll(".akv2-line-row").forEach((r) => r.classList.remove("current"));
        row.classList.add("current");
      }
      const lineN = parseInt(marker.dataset.lineN, 10);
      const line = currentLines().find((l) => l.n === lineN);
      if (line) {
        refreshNotePanel(line);
        // Scroll the notes panel into view on narrow screens (where it's not sticky)
        const notesEl = document.querySelector(".akv2-notes");
        if (notesEl && window.innerWidth < 1100) {
          notesEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      updateProgress();
    });
  });

  document.getElementById("footer-prev")?.addEventListener("click", () => {
    if (hasPrev) {
      currentSessionStart = Math.max(0, start - SESSION_SIZE);
      currentLineIdx = currentSessionStart;
      renderSession();
      updateProgress();
    }
  });
  document.getElementById("footer-next")?.addEventListener("click", () => {
    if (hasNext) {
      currentSessionStart = end;
      currentLineIdx = end;
      renderSession();
      updateProgress();
    }
  });

  // Initial note panel for the current line in this slice.
  const initial = lines[currentLineIdx] || slice[0];
  if (initial) refreshNotePanel(initial);
}

// --- Chapter chooser ---
function renderChapters() {
  const sections = text.sections || [];
  document.getElementById("reader-body").innerHTML = `
    <div style="padding: 24px 0 12px;">
      <p style="font-family: var(--akv2-body); font-style: italic; font-size: 15px; color: var(--akv2-ink-2); line-height: 1.6; margin: 0 0 24px;">This work is divided into sections. Open any section to read it in 10-line sessions or one line at a time.</p>
      <div class="akv2-toc-list" id="chapter-pick-list">
        ${sections.map((s, i) => `
          <a class="akv2-toc-book" data-section="${esc(s.id)}" href="#" style="text-decoration:none;">
            <span class="n">${esc(s.label || `Book ${i + 1}`)}</span>
            <span class="t">${esc(s.title || '')}</span>
            <span class="mins">${s.lines.length} lines</span>
          </a>
        `).join("")}
      </div>
    </div>
  `;
  document.querySelectorAll("#chapter-pick-list .akv2-toc-book").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activeSectionId = a.dataset.section;
      currentLineIdx = 0;
      currentSessionStart = 0;
      mode = "session";
      setActiveModeTab("session");
      renderMode();
      updateProgress();
    });
  });
}

function renderMode() {
  if (!text) return;
  if (mode === "chapters") { renderChapters(); return; }
  if (mode === "session") { renderSession(); return; }
  renderSingleLine();
}

// --- ToC sidebar (always shows sections of the active text, if any) ---
function renderTocSidebar() {
  const host = document.getElementById("toc-list");
  if (!host) return;

  if (text.sections && text.sections.length) {
    host.innerHTML = text.sections.map((s, i) => {
      const isActive = s.id === activeSectionId;
      return `
        <a class="akv2-toc-book${isActive ? ' active' : ''}" data-section="${esc(s.id)}" href="#" style="text-decoration:none;">
          <span class="n">${esc(s.label || (i + 1).toString())}</span>
          <span class="t">${esc(s.title || '')}</span>
          <span class="mins">${s.lines.length} lines</span>
        </a>
      `;
    }).join("");
    host.querySelectorAll(".akv2-toc-book").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        activeSectionId = a.dataset.section;
        currentLineIdx = 0;
        currentSessionStart = 0;
        if (mode === "chapters") mode = "session";
        setActiveModeTab(mode === "chapters" ? "session" : mode);
        renderTocSidebar();
        renderMode();
        updateProgress();
      });
    });
  } else {
    // Flat text — show first/last line markers as a tiny "where am I" hint.
    const lines = currentLines();
    const firstN = lines[0]?.n;
    const lastN = lines[lines.length - 1]?.n;
    host.innerHTML = `
      <div class="akv2-toc-book active" style="cursor:default">
        <span class="t">${esc(text.title || '')}</span>
        <span class="mins">${lines.length} lines${firstN !== undefined ? ` · ${firstN}–${lastN}` : ''}</span>
      </div>
    `;
  }
}

// --- Notes panel ---
function refreshNotePanel(line) {
  if (!line) return;
  const nEl = document.getElementById("note-line-n");
  if (nEl) nEl.textContent = line.n;
  const body = document.getElementById("note-body");
  if (!body) return;
  if (line.gloss && line.gloss.trim()) {
    body.innerHTML = renderGloss(line.gloss);
  } else {
    body.innerHTML = `<div class="none"><em>No scholarly note on this line.</em></div>`;
  }
  const keep = document.getElementById("keep-btn");
  if (keep) {
    keep.textContent = `+ Keep line ${line.n}`;
    keep.classList.remove("kept");
    keep.onclick = () => {
      // Lightweight client-side "keep" — recorded as a bookmark with intent=keep.
      recordBookmark({
        text_id: text.id,
        language: text.language,
        title: text.title,
        section_id: activeSectionId,
        line_n: line.n,
        total_lines: currentLines().length,
        kept: true,
      });
      keep.textContent = `✓ Kept line ${line.n}`;
      keep.classList.add("kept");
    };
  }
}

// --- Progress / breadcrumb ---
function updateProgress() {
  const lines = currentLines();
  const currentEl = document.getElementById("line-current");
  const totalEl = document.getElementById("line-total");
  if (currentEl && totalEl) {
    if (mode === "chapters") {
      currentEl.textContent = "—";
      totalEl.textContent = "—";
    } else if (mode === "session") {
      const end = Math.min(currentSessionStart + SESSION_SIZE, lines.length);
      currentEl.textContent = `${(lines[currentSessionStart]?.n) || currentSessionStart + 1}–${(lines[end - 1]?.n) || end}`;
      totalEl.textContent = lines[lines.length - 1]?.n || lines.length;
    } else {
      currentEl.textContent = lines[currentLineIdx]?.n || (currentLineIdx + 1);
      totalEl.textContent = lines[lines.length - 1]?.n || lines.length;
    }
  }

  // Bookmark
  if (text && mode !== "chapters" && lines.length) {
    const currentLine = mode === "session" ? lines[currentLineIdx] || lines[currentSessionStart] : lines[currentLineIdx];
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
  if (crumb) {
    if (activeSectionId) {
      const sec = sectionById(activeSectionId);
      crumb.innerHTML = `<button type="button" id="crumb-back">← All chapters</button> &nbsp;/&nbsp; <span style="color:var(--akv2-ink)">${esc(sec?.title || "")}</span>`;
      document.getElementById("crumb-back").addEventListener("click", () => {
        activeSectionId = null;
        currentLineIdx = 0;
        currentSessionStart = 0;
        mode = "chapters";
        setActiveModeTab("chapters");
        renderTocSidebar();
        renderMode();
        updateProgress();
      });
    } else {
      crumb.innerHTML = "";
    }
  }
}

// --- Mode tab wiring ---
function setActiveModeTab(name) {
  document.querySelectorAll(".akv2-mode-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === name);
  });
}

function wireModeTabs() {
  document.querySelectorAll(".akv2-mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      let next = tab.dataset.mode;
      if (next === "chapters" && !text.sections) {
        next = "single";
      }
      // Default into the first section when entering session/single on a sectioned text.
      if ((next === "session" || next === "single") && text.sections && !activeSectionId) {
        activeSectionId = text.sections[0].id;
        currentLineIdx = 0;
        currentSessionStart = 0;
        renderTocSidebar();
      }
      mode = next;
      setActiveModeTab(next);
      if (mode !== "chapters") {
        currentSessionStart = Math.floor(currentLineIdx / SESSION_SIZE) * SESSION_SIZE;
      }
      renderMode();
      updateProgress();
    });
  });
}

// --- View mode (Greek / English / Both) ---
function wireViewSegmented() {
  const buttons = document.querySelectorAll(".akv2-segmented button");
  buttons.forEach((b) => {
    b.addEventListener("click", () => {
      const view = b.dataset.view;
      buttons.forEach((x) => x.classList.toggle("active", x === b));
      document.body.classList.remove("view-gr", "view-en", "view-both");
      document.body.classList.add(view === "greek" ? "view-gr" : view === "english" ? "view-en" : "view-both");
      // Hide one of the header columns when one-sided.
      const grHead = document.getElementById("col-gr-lbl");
      const enHead = document.getElementById("col-en-lbl");
      if (view === "greek") { grHead.style.display = ""; enHead.style.display = "none"; }
      else if (view === "english") { grHead.style.display = "none"; enHead.style.display = ""; }
      else { grHead.style.display = ""; enHead.style.display = ""; }
    });
  });
}

// --- Player transport ---
function wirePlayerTransport() {
  document.getElementById("play-btn")?.addEventListener("click", () => {
    const lines = currentLines();
    const line = lines[currentLineIdx];
    if (line) {
      const btn = document.querySelector(`.akv2-line-row[data-idx="${currentLineIdx}"]`)
              || document.querySelector(`.akv2-line-row.current`);
      playLineAudio(line, btn);
    }
  });
  document.getElementById("prev-btn")?.addEventListener("click", () => {
    if (currentLineIdx > 0) {
      currentLineIdx--;
      if (mode === "session" && currentLineIdx < currentSessionStart) {
        currentSessionStart = Math.max(0, currentSessionStart - SESSION_SIZE);
        renderSession();
      } else if (mode === "single") {
        renderSingleLine();
      } else if (mode === "session") {
        document.querySelectorAll(".akv2-line-row").forEach((r) => r.classList.remove("current"));
        document.querySelector(`.akv2-line-row[data-idx="${currentLineIdx}"]`)?.classList.add("current");
        refreshNotePanel(currentLines()[currentLineIdx]);
      }
      updateProgress();
    }
  });
  document.getElementById("next-btn")?.addEventListener("click", () => {
    const lines = currentLines();
    if (currentLineIdx < lines.length - 1) {
      currentLineIdx++;
      if (mode === "session" && currentLineIdx >= currentSessionStart + SESSION_SIZE) {
        currentSessionStart = currentLineIdx;
        renderSession();
      } else if (mode === "single") {
        renderSingleLine();
      } else if (mode === "session") {
        document.querySelectorAll(".akv2-line-row").forEach((r) => r.classList.remove("current"));
        document.querySelector(`.akv2-line-row[data-idx="${currentLineIdx}"]`)?.classList.add("current");
        refreshNotePanel(lines[currentLineIdx]);
      }
      updateProgress();
    }
  });
}

// === Word popover (unchanged behavior) ===
let popoverEl = null;
function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement("div");
  popoverEl.className = "word-popover";
  popoverEl.hidden = true;
  document.body.appendChild(popoverEl);
  return popoverEl;
}
function hidePopover() { if (popoverEl) popoverEl.hidden = true; }
function positionPopover(anchor) {
  const rect = anchor.getBoundingClientRect();
  const pop = popoverEl;
  pop.hidden = false;
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
  return `<div class="word-pop-audio"><button class="word-pop-listen" data-word="${esc(word)}" aria-label="Listen to pronunciation">▶ Listen</button></div>`;
}
function wireWordAudio(popEl, word) {
  const btn = popEl.querySelector(".word-pop-listen");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const src = `${BASE}/api/word-audio/${encodeURIComponent(text.language)}/${encodeURIComponent(word)}.mp3`;
    btn.textContent = "⬛ Playing";
    btn.classList.add("playing");
    const audio = new Audio(src);
    audio.addEventListener("ended", () => { btn.textContent = "▶ Listen"; btn.classList.remove("playing"); });
    audio.addEventListener("error", () => { btn.textContent = "✗ Audio unavailable"; btn.classList.remove("playing"); });
    try { await audio.play(); } catch { btn.textContent = "✗ Tap to retry"; btn.classList.remove("playing"); }
  });
}
function renderWordEntry(entry) {
  if (!entry) return "<em>No entry.</em>";
  if (entry.source === "wiktionary") {
    const defs = (entry.definitions || []).map((d) => `<div class="word-def">${esc(d.text)}</div>`).join("");
    const formRow = entry.form ? `<div class="word-form">${esc(entry.form)}</div>` : "";
    const lemmaRow = entry.lemma ? `<div class="word-lemma">Lemma: <b>${esc(entry.lemma)}</b></div>` : "";
    const srcUrl = entry.source_url || "https://en.wiktionary.org/";
    const adapted = entry.adapted ? " (adapted)" : "";
    return `
      ${entry.part_of_speech ? `<div class="word-pos">${esc(entry.part_of_speech)}</div>` : ""}
      ${formRow}
      ${lemmaRow}
      ${defs}
      <div class="word-source">
        Source: <a href="${esc(srcUrl)}" target="_blank" rel="noopener">Wiktionary</a>${adapted} &middot;
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>
      </div>
    `;
  }
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
  if (document._paideiaWordsWired) return;
  document._paideiaWordsWired = true;
  document.addEventListener("click", (e) => {
    const w = e.target.closest(".word");
    if (w) { e.preventDefault(); showPopoverFor(w); return; }
    const pop = popoverEl;
    if (pop && !pop.hidden && !e.target.closest(".word-popover")) hidePopover();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hidePopover(); });
}

// --- "Working alongside" library grid at the bottom of the reader ---
async function renderAlongside() {
  const host = document.getElementById("alongside-host");
  const grid = document.getElementById("alongside-grid");
  if (!host || !grid) return;
  try {
    const res = await fetch(`${BASE}/api/library/all`);
    if (!res.ok) return;
    const data = await res.json();
    const all = data.texts || [];
    // Show up to 3 other works (not the current one), prefer same language.
    const others = all.filter((t) => t.id !== text.id);
    others.sort((a, b) => {
      const ag = a.language === text.language ? 0 : 1;
      const bg = b.language === text.language ? 0 : 1;
      return ag - bg;
    });
    const pick = others.slice(0, 3);
    if (!pick.length) return;
    host.hidden = false;
    document.getElementById("alongside-browse").href = `${BASE}/${encodeURIComponent(text.language || 'greek')}`;
    grid.innerHTML = pick.map((t) => {
      const meta = `${esc(t.author || '')}${t.date ? ' · ' + esc(t.date) : ''}`;
      const blurb = t.blurb ? esc(t.blurb).slice(0, 220) + (t.blurb.length > 220 ? '…' : '') : '';
      const cover = t.cover_src
        ? `<img src="${esc(t.cover_src)}" alt="${esc(t.cover_alt || t.title)}" loading="lazy" />`
        : `<div class="akv2-card-cover-placeholder"><span class="akv2-card-cover-mark">Κ</span><span class="akv2-card-cover-sub">AKOUSMA</span></div>`;
      return `
        <a class="akv2-card" href="${BASE}/read/${esc(t.id)}">
          <div class="akv2-card-head">
            <span class="akv2-card-lang">${esc((t.language || '').toUpperCase())}</span>
            ${t.is_gateway ? '<span class="akv2-card-gateway-badge">Gateway</span>' : ''}
          </div>
          <div class="akv2-card-cover">${cover}</div>
          <h3 class="akv2-card-title">${esc(t.title)}</h3>
          <p class="akv2-card-author">${meta}</p>
          ${blurb ? `<p class="akv2-card-blurb">${blurb}</p>` : ''}
          <div class="akv2-card-meta">
            <span class="lining">${t.lines_count || 0} lines</span>
            <span>Open & Listen →</span>
          </div>
        </a>
      `;
    }).join("");
  } catch {}
}

// --- Player sticky shadow toggle ---
function wirePlayerStickyShadow() {
  const player = document.getElementById("player");
  if (!player || !("IntersectionObserver" in window)) return;
  // Sentinel right above the player to detect when it sticks.
  const sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  player.parentNode.insertBefore(sentinel, player);
  const obs = new IntersectionObserver(([entry]) => {
    player.classList.toggle("stuck", !entry.isIntersecting);
  }, { threshold: 0 });
  obs.observe(sentinel);
}

// --- Load ---
async function load() {
  const id = currentId();
  try {
    const res = await fetch(`${BASE}/api/library/text/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.json();

    document.title = `${text.title} · Kalopaideia`;
    document.getElementById("reader-title").textContent = text.title;
    document.getElementById("reader-author").textContent = `${text.author || ''}${text.date ? ' · ' + text.date : ''}`;

    // Subline: book label / subtitle if we have sections, otherwise empty.
    const subEl = document.getElementById("reader-subline");
    if (text.sections && text.sections.length && activeSectionId) {
      const sec = sectionById(activeSectionId);
      subEl.innerHTML = sec ? `${esc(sec.label || '')}${sec.title ? '<span class="sep">·</span><span class="book-subtitle">' + esc(sec.title) + '</span>' : ''}` : '';
    } else if (text.subtitle) {
      subEl.innerHTML = `<span class="book-subtitle">${esc(text.subtitle)}</span>`;
    } else {
      subEl.innerHTML = '';
    }

    document.getElementById("reader-trans").innerHTML = text.translator
      ? `Tr. <span class="reader-name">${esc(text.translator)}</span>${text.translator_date ? ', ' + esc(text.translator_date) : ''}${text.license ? '<span class="sep">·</span>' + esc(text.license) : ''}`
      : '';
    document.getElementById("reader-notes").textContent = text.reading_notes || '';

    // Column labels
    const lang = (text.language || '').toUpperCase();
    document.getElementById("col-gr-lbl").textContent = lang ? `${lang} · Original` : 'Original';
    document.getElementById("col-en-lbl").textContent = text.translator
      ? `English · tr. ${text.translator}`
      : 'English';

    // Restore from bookmark if present
    const bookmarks = getBookmarks();
    const existing = bookmarks.find((b) => b.text_id === text.id);
    const shouldResume = existing && new URLSearchParams(location.search).get("resume") !== "0";

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
        setActiveModeTab("session");
      } else {
        activeSectionId = null;
        mode = "chapters";
        setActiveModeTab("chapters");
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
      setActiveModeTab("session");
    }

    document.getElementById("reader-loading").style.display = "none";
    document.getElementById("reader").style.display = "";

    renderTocSidebar();
    wireModeTabs();
    wireViewSegmented();
    wirePlayerTransport();
    wirePlayerStickyShadow();
    wireWordClicks();
    renderMode();
    updateProgress();
    renderAlongside();

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (mode === "chapters") return;
      if (e.key === "ArrowLeft") document.getElementById("prev-btn")?.click();
      if (e.key === "ArrowRight") document.getElementById("next-btn")?.click();
      if (e.key === " ") { e.preventDefault(); document.getElementById("play-btn")?.click(); }
    });
  } catch (err) {
    document.getElementById("reader-loading").textContent = "Could not open this text.";
    console.error(err);
  }
}

load();
