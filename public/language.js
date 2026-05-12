// Paideia language page — primer + daily word archive

const BASE = "/paideia";

const LANG_META = {
  latin:         { name: "Latin", subtitle: "Classical Roman letters — Cicero, Virgil, Ovid, Horace, Tacitus" },
  greek:         { name: "Greek", subtitle: "Ancient Hellenic letters — Homer, Plato, Sappho, Sophocles" },
  italian:       { name: "Italian", subtitle: "Trecento and Renaissance letters — Dante, Petrarch, Boccaccio, Tasso, Manzoni" },
  french:        { name: "French", subtitle: "Literary French — Molière, Baudelaire, Flaubert, Proust" },
  german:        { name: "German", subtitle: "Letters & Philosophy — Goethe, Schiller, Kant, Nietzsche" },
  oldenglish:    { name: "Olde English", subtitle: "Anglo-Saxon poetry — Beowulf, The Wanderer, Exeter Book" },
  middleenglish: { name: "Middle English", subtitle: "Chaucer and the Pearl-poet — Canterbury Tales, Sir Gawain, Pearl, Piers Plowman" },
  // Phase 1 additions — primer + library to be filled in Phase 2.
  gaulish:       { name: "Gaulish", subtitle: "Continental Celtic of pre-Roman Gaul — Coligny calendar, Lezoux plate, votive inscriptions", category: "celtic" },
  welsh:         { name: "Welsh", subtitle: "Middle Welsh and the modern bardd — Pedair Cainc, Dafydd ap Gwilym, Saunders Lewis", category: "celtic" },
  oldnorse:      { name: "Old Norse", subtitle: "The saga-language of medieval Iceland — Völuspá, Hávamál, Njal's Saga", category: "germanic" },
};

function currentLang() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1].toLowerCase();
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Break a word into its constituent letters, separated by middle dots.
 * Handles combining diacritics via NFC normalization.
 */
function letterBreakdown(word) {
  if (!word) return "";
  const normalized = String(word).normalize("NFC");
  const letters = Array.from(normalized).filter(ch => !/\s/.test(ch));
  return letters.join(" · ");
}

/**
 * Wrap words in text with pronunciation tooltips
 * @param {string} text - The text containing words to annotate
 * @param {string} lang - Language code (latin, greek, etc.)
 * @param {boolean} [escapeFirst=true] - Whether to HTML-escape the text first
 * @returns {string} - HTML with <span class="pronounceable"> elements
 */
function addPronunciation(text, lang, escapeFirst = true) {
  if (!text || !lang) return esc(text);
  if (typeof Pronunciation === 'undefined') {
    console.warn('Pronunciation module not loaded');
    return esc(text);
  }
  
  try {
    return _addPronunciationImpl(text, lang, escapeFirst);
  } catch (e) {
    console.error('addPronunciation failed for', lang, ':', e);
    return esc(text);
  }
}

function _addPronunciationImpl(text, lang, escapeFirst = true) {
  const safeText = escapeFirst ? esc(text) : text;
  
  // Match words in the target language
  // Latin: macrons + basic Latin alphabet
  // Greek: Greek alphabet + accents
  // German: umlauts, ß
  // French: accents
  // Olde English: special characters þ, ð, æ, ċ, ġ
  
  const patterns = {
    latin: /[a-zA-ZāēīōūȳĀĒĪŌŪȲ]+/g,
    greek: /[α-ωΑ-Ωάέήίόύώὰὲὴὶὸὺὼᾶῆῖῦῶἀ-ἇἈ-Ἇἐ-ἕἘ-Ἕἠ-ἧἨ-Ἧἰ-ἷἸ-Ἷὀ-ὅὈ-Ὅὐ-ὗὙὛὝὟὠ-ὧὨ-Ὧ]+/g,
    italian: /[a-zA-ZàáèéìíîòóùúüÀÁÈÉÌÍÎÒÓÙÚÜ]+/g,
    german: /[a-zA-ZäöüßÄÖÜ]+/g,
    french: /[a-zA-ZàâæçéèêëïîôùûüÿœÀÂÆÇÉÈÊËÏÎÔÙÛÜŸŒ]+/g,
    oldenglish: /[a-zA-ZæþðĊċĠġÆÞÐ]+/g,
    middleenglish: /[a-zA-ZæþðȜȝÆÞÐ]+/g,
    // Phase 1 additions. Patterns deliberately permissive — will tighten
    // in Phase 2 once the primers + word lists are seeded.
    // Gaulish: Latin alphabet (most inscriptions) plus a small set of
    //   Greek letters used in southern Gaulish inscriptions.
    gaulish: /[a-zA-Zα-ωΑ-Ω]+/g,
    // Welsh: Latin alphabet plus circumflex vowels (âêîôûŷŵ) used
    //   in Modern Welsh; y/w are vowels in Welsh.
    welsh: /[a-zA-ZâêîôûŵŷÂÊÎÔÛŴŶ]+/g,
    // Old Norse: Latin alphabet plus þ ð æ ø ǫ (and capitals)
    //   for Old Icelandic; runes handled separately when needed.
    oldnorse: /[a-zA-ZþðæøǫýÞÐÆØǪÝ]+/g,
  };
  
  const pattern = patterns[lang] || /[a-zA-Z]+/g;
  
  return safeText.replace(pattern, (word) => {
    try {
      const pron = Pronunciation.generate(word, lang);
      if (!pron) return word;
      const tooltip = `${pron.say} • ${pron.ipa}`;
      return `<span class="pronounceable" data-tooltip="${esc(tooltip)}" tabindex="0">${word}</span>`;
    } catch (e) {
      return word;
    }
  });
}

function formatDate(iso) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  } catch { return iso; }
}

// === Primer rendering ===
function renderAlphabet(primer, lang) {
  const alphabet = primer.alphabet || [];
  const grid = document.getElementById("alphabet-grid");
  grid.innerHTML = alphabet.map((entry, idx) => {
    // Only promote cells to full-row width in two cases:
    //  (1) The "char" field actually contains multiple characters (e.g., combining accent marks).
    //  (2) The notes field is extremely long (>180 chars) — rare, avoids turning normal letters wide.
    const notesLen = (entry.notes || "").length;
    const charLen = (entry.char || "").length;
    const isWide = charLen > 4 || notesLen > 180;
    return `
      <div class="alphabet-cell${isWide ? " wide" : ""}">
        <button class="letter-btn" data-audio="${BASE}/alphabet-audio/${lang}/${idx}.mp3" aria-label="Pronounce ${esc(entry.char)}">
          <span class="letter-char">${esc(entry.char)}</span>
        </button>
        <div class="letter-name">${esc(entry.name || "")}</div>
        <div class="letter-ipa">${esc(entry.ipa || "")}</div>
        <div class="letter-approx">${esc(entry.approximation || "")}</div>
        ${entry.notes ? `<div class="letter-notes">${esc(entry.notes)}</div>` : ""}
      </div>
    `;
  }).join("");

  const notes = document.getElementById("pron-notes");
  notes.innerHTML = (primer.pronunciation_notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
}

function renderGrammar(primer, lang) {
  const g = primer.grammar || {};
  const out = [];
  const safe = (fn, label) => { try { fn(); } catch (e) { console.error(`renderGrammar ${label} failed:`, e); } };

  // Grammar Reference Card (collapsible)
  safe(() => {
    if (g.reference) {
      const ref = g.reference;
      out.push(`<details class="grammar-reference" open>`);
      out.push(`<summary><strong>${esc(ref.title || "Grammar Reference")}</strong></summary>`);
      if (ref.description) out.push(`<p class="ref-desc">${esc(ref.description)}</p>`);
      
      if (Array.isArray(ref.sections)) {
        for (const section of ref.sections) {
          out.push(`<div class="ref-section">`);
          out.push(`<h5 class="ref-category">${esc(section.category || "")}</h5>`);
          if (Array.isArray(section.terms)) {
            out.push(`<dl class="ref-terms">`);
            for (const t of section.terms) {
              out.push(`<dt>${addPronunciation(t.term || "", lang)}</dt>`);
              out.push(`<dd>${addPronunciation(t.definition || "", lang)}</dd>`);
            }
            out.push(`</dl>`);
          }
          out.push(`</div>`);
        }
      }
      out.push(`</details>`);
    }
  }, 'reference');

  safe(() => {
    if (g.noun_system) {
      out.push(`<h4 class="pane-subheading">Noun System</h4><p class="grammar-para">${esc(g.noun_system)}</p>`);
    }
  }, 'noun_system');

  safe(() => {
    if (Array.isArray(g.declensions) && g.declensions.length) {
      out.push(`<h4 class="pane-subheading">Declensions</h4>`);
      for (const d of g.declensions) {
        try {
          out.push(`<div class="paradigm stack-mobile">`);
          out.push(`<div class="paradigm-name">${esc(d.name || "")}</div>`);
          if (d.description) out.push(`<div class="paradigm-desc">${addPronunciation(d.description, lang)}</div>`);
          if (d.paradigm) out.push(paradigmTable(d.paradigm, lang));
          out.push(`</div>`);
        } catch (e) {
          console.error('declension render failed:', d.name, e);
          out.push(`</div>`);
        }
      }
    } else if (typeof g.declensions === "string") {
      out.push(`<h4 class="pane-subheading">Noun Structure</h4><p class="grammar-para">${esc(g.declensions)}</p>`);
    }
  }, 'declensions');

  safe(() => {
    if (g.verb_system) {
      out.push(`<h4 class="pane-subheading">Verb System</h4><p class="grammar-para">${esc(g.verb_system)}</p>`);
    }
  }, 'verb_system');

  safe(() => {
    if (Array.isArray(g.conjugations) && g.conjugations.length) {
      out.push(`<h4 class="pane-subheading">Conjugations</h4>`);
      for (const c of g.conjugations) {
        try {
          out.push(`<div class="paradigm stack-mobile">`);
          out.push(`<div class="paradigm-name">${esc(c.name || "")}</div>`);
          if (c.description) out.push(`<div class="paradigm-desc">${addPronunciation(c.description, lang)}</div>`);
          if (c.paradigm) out.push(paradigmTable(c.paradigm, lang));
          out.push(`</div>`);
        } catch (e) {
          console.error('conjugation render failed:', c.name, e);
          out.push(`</div>`);
        }
      }
    }
  }, 'conjugations');

  document.getElementById("grammar-content").innerHTML = out.join("");
}

// === Numbers rendering ===
function renderNumbers(primer, lang) {
  const n = primer.numbers;
  const el = document.getElementById("numbers-content");
  if (!el) return;
  if (!n) {
    el.innerHTML = '<div class="center" style="padding:40px 0;color:var(--ink-muted)">Numbers tutorial in preparation.</div>';
    return;
  }

  const out = [];

  if (n.overview) {
    out.push(`<p class="numbers-overview">${esc(n.overview)}</p>`);
  }

  // Cardinals table
  if (Array.isArray(n.cardinals) && n.cardinals.length) {
    out.push(`<h4 class="pane-subheading">Cardinal Numbers</h4>`);
    out.push(`<table class="numbers-table"><thead><tr><th class="val">#</th><th>Word</th><th>IPA</th><th>Say</th><th>Listen</th><th class="note">Note</th></tr></thead><tbody>`);
    for (const c of n.cardinals) {
      const audioSrc = `${BASE}/api/word-audio/${lang}/${encodeURIComponent(c.word)}.mp3`;
      const fmtValue = Number(c.value).toLocaleString("en-US");
      out.push(`<tr>
        <td class="val">${esc(fmtValue)}</td>
        <td class="word">${esc(c.word)}</td>
        <td class="ipa">${esc(c.ipa || "")}</td>
        <td class="say">${esc(c.pronunciation || "")}</td>
        <td class="audio"><button class="audio-btn inline-audio-btn" data-audio="${audioSrc}" aria-label="Listen to ${esc(c.word)}">▶</button></td>
        <td class="note">${esc(c.note || "")}</td>
      </tr>`);
    }
    out.push(`</tbody></table>`);
  }

  // Ordinals table
  if (Array.isArray(n.ordinals) && n.ordinals.length) {
    out.push(`<h4 class="pane-subheading">Ordinal Numbers</h4>`);
    out.push(`<table class="numbers-table"><thead><tr><th class="val">#</th><th>Word</th><th>IPA</th><th>Say</th><th>Listen</th><th class="note">Meaning &amp; Note</th></tr></thead><tbody>`);
    for (const o of n.ordinals) {
      const audioSrc = `${BASE}/api/word-audio/${lang}/${encodeURIComponent(o.word)}.mp3`;
      const noteText = [o.meaning, o.note].filter(Boolean).join(" — ");
      out.push(`<tr>
        <td class="val">${esc(o.rank)}.</td>
        <td class="word">${esc(o.word)}</td>
        <td class="ipa">${esc(o.ipa || "")}</td>
        <td class="say">${esc(o.pronunciation || "")}</td>
        <td class="audio"><button class="audio-btn inline-audio-btn" data-audio="${audioSrc}" aria-label="Listen to ${esc(o.word)}">▶</button></td>
        <td class="note">${esc(noteText)}</td>
      </tr>`);
    }
    out.push(`</tbody></table>`);
  }

  // Teaching notes
  if (Array.isArray(n.teaching_notes) && n.teaching_notes.length) {
    out.push(`<h4 class="pane-subheading">Teaching Notes</h4>`);
    out.push(`<ul class="teaching-notes">`);
    for (const note of n.teaching_notes) {
      out.push(`<li>${esc(note)}</li>`);
    }
    out.push(`</ul>`);
  }

  el.innerHTML = out.join("");
  
  // Wire the audio buttons in this pane
  if (typeof wireWordAudio === 'function') wireWordAudio();
}

// SHA-1 short hash (matches server-side value_hash) for a cell value.
// Uses SubtleCrypto (browser); falls back to raw string if unavailable.
async function sha1Short(text) {
  const clean = text.trim().split("/")[0].trim();
  if (!window.crypto || !window.crypto.subtle) return null;
  const enc = new TextEncoder().encode(clean);
  const buf = await window.crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function cellHtml(value, lang) {
  // Return a span that we upgrade later into a clickable audio link.
  if (!value || !value.trim()) return "";
  const pronValue = addPronunciation(value, lang);
  return `<span class="para-val" data-val="${esc(value)}">${pronValue}</span>`;
}

function paradigmTable(paradigm, lang) {
  const entries = Object.entries(paradigm);
  if (entries.length === 0) return "";
  const isNested = entries.every(([_, v]) => typeof v === "object" && v !== null && !Array.isArray(v));
  if (isNested) {
    const colsSet = new Set();
    for (const [_, inner] of entries) for (const k of Object.keys(inner)) colsSet.add(k);
    const cols = [...colsSet];
    const th = `<thead><tr><th></th>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>`;
    const tr = entries.map(([rowKey, inner]) => {
      const cells = cols.map((c) => `<td data-col="${esc(c)}">${cellHtml(inner[c] || "", lang)}</td>`).join("");
      return `<tr><th>${esc(rowKey)}</th>${cells}</tr>`;
    }).join("");
    return `<table class="para-table">${th}<tbody>${tr}</tbody></table>`;
  }
  const rows = entries.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${cellHtml(v, lang)}</td></tr>`).join("");
  return `<table class="para-table"><tbody>${rows}</tbody></table>`;
}

async function wireParadigmAudio(lang) {
  const cells = document.querySelectorAll(".para-val");
  for (const span of cells) {
    const val = span.dataset.val;
    if (!val) continue;
    const h = await sha1Short(val);
    if (!h) continue;
    span.dataset.audio = `${BASE}/grammar-audio/${lang}/${h}.mp3`;
    span.classList.add("clickable");
    span.title = "Tap to hear pronunciation";
  }
  // Guard: only attach the document-level handler once, even if
  // wireParadigmAudio() runs multiple times. Repeated attachment was the
  // root cause of the audio echo Jae reported (multiple Audio() instances
  // playing the same file in near-sync).
  if (!document.body.dataset.paradigmAudioWired) {
    document.body.dataset.paradigmAudioWired = "1";
    document.addEventListener("click", (e) => {
      const target = e.target.closest(".para-val.clickable");
      if (!target || !target.dataset.audio) return;
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      const audio = new Audio(target.dataset.audio);
      target.classList.add("playing");
      audio.addEventListener("ended", () => target.classList.remove("playing"));
      audio.addEventListener("error", () => target.classList.remove("playing"));
      audio.play().catch(() => target.classList.remove("playing"));
      currentAudio = audio;
    });
  }
}

// Match a library text to a reading-list entry by heuristics (author/title keyword match).
function matchLibraryToReading(readingEntry, libraryTexts) {
  const re = readingEntry.toLowerCase();
  return libraryTexts.find((t) => {
    const author = (t.author || "").toLowerCase();
    const title = (t.title || "").toLowerCase();
    // Try author keyword
    const authorKey = author.split(/[,\s(]/)[0];
    if (authorKey && re.includes(authorKey)) return true;
    // Try title keyword
    const titleKey = title.split(/[,\s—]/)[0];
    if (titleKey && titleKey.length > 3 && re.includes(titleKey)) return true;
    return false;
  });
}

function getBookmarksSync() {
  try { return JSON.parse(localStorage.getItem("paideia:bookmarks:v1") || "{}"); }
  catch { return {}; }
}

function bookmarksForLang(lang) {
  const all = getBookmarksSync();
  return Object.entries(all)
    .map(([text_id, d]) => ({ text_id, ...d }))
    .filter((b) => b.language === lang)
    .sort((a, b) => b.updated_at - a.updated_at);
}

async function renderLibraryAndReading(primer, lang) {
  const pane = document.getElementById("pane-library");
  const readingList = primer.reading_list || [];
  let libraryTexts = [];
  try {
    const res = await fetch(`${BASE}/api/library/${lang}`);
    if (res.ok) libraryTexts = (await res.json()).texts || [];
  } catch {}

  // Build a unified list: for each reading-list entry, look up whether a library text exists
  const usedLibIds = new Set();
  const items = readingList.map((r, idx) => {
    const match = matchLibraryToReading(r, libraryTexts);
    if (match) usedLibIds.add(match.id);
    return {
      difficulty: idx + 1,
      description: r,
      library: match || null,
    };
  });

  // Any library texts not matched go at the top as "Featured readers"
  const unmatched = libraryTexts.filter((t) => !usedLibIds.has(t.id));

  const sections = [];

  // Per Jae 2026-05-09: the Library section gets the same scholarly
  // typographic treatment as the C masthead — a small temple-ruin SVG
  // icon flanking a Bodoni italic heading, with a faint hairline rule
  // beneath. Acts as a section divider that echoes the masthead.
  sections.push(`
    <header class="library-masthead">
      <img class="library-masthead-emblem" src="${BASE}/img/masthead/temple-ruin.svg" alt="" aria-hidden="true" />
      <h3 class="library-masthead-title">The ${esc(LANG_META[lang]?.name || lang)} Library</h3>
      <p class="library-masthead-sub"><em>Akousma</em> — the audio library of Kalopaideia, by tradition</p>
    </header>
  `);

  // Per Jae 2026-05-09 (third ask): the Library section MUST show the
  // Akousma promo card with the actual book cover. The card lives in
  // akousma.js (loaded before this file).
  if (typeof renderAkousmaCard === "function") {
    sections.push(renderAkousmaCard(lang));
  }

  sections.push(`<p class="library-intro">Sentence-by-sentence parallel-text readers. Open any text in the reader to move through one line at a time, listen to the original pronounced aloud, and read the grammar gloss beside each line.</p>`);

  // Continue Reading section (from bookmarks)
  const bookmarks = bookmarksForLang(lang);
  if (bookmarks.length) {
    sections.push(`<h4 class="pane-subheading">Continue Reading</h4>`);
    sections.push(`<ul class="library-list continue-list">`);
    for (const b of bookmarks.slice(0, 5)) {
      const pct = b.total_lines ? Math.min(100, Math.round((b.line_n / b.total_lines) * 100)) : 0;
      const ago = formatAgo(Date.now() - b.updated_at);
      sections.push(`
        <li class="library-item">
          <a href="${BASE}/read/${esc(b.text_id)}?resume=1" class="library-link">
            <div class="lib-row">
              <div class="lib-main">
                <div class="lib-title">${esc(b.title)}</div>
                <div class="lib-meta">Line ${b.line_n}${b.total_lines ? ` of ${b.total_lines}` : ""} · ${ago}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              </div>
              <span class="lib-status lib-status-open">Resume</span>
            </div>
          </a>
        </li>
      `);
    }
    sections.push(`</ul>`);
  }

  if (unmatched.length) {
    sections.push(`<h4 class="pane-subheading">Open Now</h4>`);
    sections.push(`<ul class="library-list">`);
    for (const t of unmatched) sections.push(libraryItemHtml(t, null));
    sections.push(`</ul>`);
  }

  sections.push(`<h4 class="pane-subheading">Suggested Reading, Easier to Harder</h4>`);
  sections.push(`<ul class="library-list">`);
  for (const item of items) {
    sections.push(readingItemHtml(item));
  }
  sections.push(`</ul>`);

  pane.innerHTML = sections.join("");
  // Repopulate the Akousma count on the newly-rendered card.
  if (typeof fetchAkousmaCount === "function") fetchAkousmaCount();
}

function libraryItemHtml(t, difficulty) {
  return `
    <li class="library-item">
      <a href="${BASE}/read/${esc(t.id)}" class="library-link">
        <div class="lib-row">
          <div class="lib-main">
            <div class="lib-title">${esc(t.title)}</div>
            <div class="lib-meta">${esc(t.author)} · ${esc(t.date || "")}</div>
            <div class="lib-trans">tr. ${esc(t.translator || "")}, ${esc(t.translator_date || "")} · ${t.lines_count} lines</div>
          </div>
          <span class="lib-status lib-status-open">Open</span>
        </div>
      </a>
    </li>
  `;
}

function readingItemHtml(item) {
  if (item.library) {
    const t = item.library;
    return `
      <li class="library-item">
        <a href="${BASE}/read/${esc(t.id)}" class="library-link">
          <div class="lib-row">
            <div class="lib-main">
              <div class="lib-title">${item.difficulty}. ${esc(item.description)}</div>
              <div class="lib-meta">Reader open: <em>${esc(t.title)}</em></div>
              <div class="lib-trans">tr. ${esc(t.translator || "")}, ${esc(t.translator_date || "")} · ${t.lines_count} lines</div>
            </div>
            <span class="lib-status lib-status-open">Open</span>
          </div>
        </a>
      </li>
    `;
  }
  return `
    <li class="library-item">
      <div class="library-link library-link-preparing">
        <div class="lib-row">
          <div class="lib-main">
            <div class="lib-title">${item.difficulty}. ${esc(item.description)}</div>
            <div class="lib-meta">Parallel-text reader in preparation.</div>
          </div>
          <span class="lib-status lib-status-preparing">Preparing</span>
        </div>
      </div>
    </li>
  `;
}

function renderReading(_primer) { /* Reading list now merged into Library tab. */ }

function formatAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// === Tabs ===
function wireTabs() {
  document.querySelectorAll(".primer-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".primer-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const targetKey = tab.dataset.tab;
      document.querySelectorAll(".primer-pane").forEach((p) => { p.style.display = "none"; });
      document.getElementById(`pane-${targetKey}`).style.display = "block";
      if (window.Analytics) {
        window.Analytics.track('lesson_view', {
          lang: currentLang(),
          pane: targetKey, // alphabet | grammar | numbers | library
        });
      }
    });
  });
}

// === Letter audio ===
let currentAudio = null;
function wireLetterAudio() {
  document.querySelectorAll(".letter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      const src = btn.dataset.audio;
      if (!src) return;
      if (window.Analytics) {
        window.Analytics.track('alphabet_audio_play', {
          lang: currentLang(),
          char: btn.dataset.char || btn.textContent?.trim() || null,
        });
      }
      const audio = new Audio(src);
      audio.play().catch(() => {});
      currentAudio = audio;
    });
  });
}

// === Daily word entries ===
function entryHtml(row) {
  const e = row.entry;
  const lang = currentLang();
  const trans = e.transliteration ? `<div class="transliteration">${esc(e.transliteration)}</div>` : "";

  // "In Use" section: original sentence + Listen button after + translation (preserves original styling)
  let usage = "";
  if (e.usage_example) {
    const original = e.usage_example.split("—")[0].trim();
    const translation = e.usage_example.includes("—")
      ? e.usage_example.split("—").slice(1).join("—").trim() : "";
    const sentenceAudio = `${BASE}/api/word-audio/${lang}/${encodeURIComponent(original)}.mp3`;
    usage = `<div class="detail-section"><div class="detail-label">In Use</div>
         <p class="detail-body italic">${esc(original)} <button class="audio-btn inline-audio-btn" data-audio="${sentenceAudio}" aria-label="Listen to sentence">▶</button>${translation ? `<span class="translation">${esc(translation)}</span>` : ""}</p>
         </div>`;
  }

  const culture = row.culture
    ? `<div class="culture-card">
         ${row.culture.image ? `<img class="culture-image" src="${esc(row.culture.image.url)}" alt="${esc(row.culture.title)}" loading="lazy" /><span class="culture-credit">${esc(row.culture.image.credit)}</span>` : ""}
         <h4 class="culture-title">${esc(row.culture.title)}</h4>
         <p class="culture-body">${esc(row.culture.body)}</p>
       </div>` : "";
  const audioPath = `${BASE}/audio/${row.date}/${lang}.mp3`;
  return `
    <article class="lang-entry">
      <div class="entry-date">${esc(formatDate(row.date))}</div>
      <div class="word-block">
        <div class="word-card" data-lang="${lang}">
          <div class="headword-row">
            <h3 class="headword">${esc(e.word)}</h3>
            <button class="audio-btn" data-audio="${audioPath}" aria-label="Pronounce ${esc(e.word)}">▶</button>
          </div>
          ${trans}
          <div class="pos-line">${esc(e.part_of_speech || "")}</div>
          <div class="meaning">${esc(e.meaning || "")}</div>
          <div class="pronunciation"><b>Say:</b> ${esc(e.pronunciation || "")} <b style="margin-left:12px">IPA:</b> ${esc(e.ipa || "")}</div>
          ${(typeof LetterPhonetics !== 'undefined') ? LetterPhonetics.renderHtml(e.word, lang, esc) : ''}
          ${e.forms ? `<div class="detail-section"><div class="detail-label">Forms</div><p class="detail-body">${esc(e.forms)}</p></div>` : ""}
          ${e.etymology ? `<div class="detail-section"><div class="detail-label">Etymology</div><p class="detail-body">${esc(e.etymology)}</p></div>` : ""}
          ${e.literary_context ? `<div class="detail-section"><div class="detail-label">In Literature</div><p class="detail-body">${esc(e.literary_context)}</p></div>` : ""}
          ${usage}
          ${e.did_you_know ? `<div class="detail-section"><div class="detail-label">Did You Know</div><p class="detail-body">${esc(e.did_you_know)}</p></div>` : ""}
        </div>
        ${culture}
      </div>
    </article>
  `;
}

function wireWordAudio() {
  document.querySelectorAll(".audio-btn").forEach((btn) => {
    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      const src = btn.dataset.audio;
      if (!src) return;
      const audio = new Audio(src);
      btn.classList.add("playing");
      btn.textContent = "■";
      audio.play().catch(() => {});
      audio.addEventListener("ended", () => {
        btn.classList.remove("playing");
        btn.textContent = "▶";
      });
      currentAudio = audio;
    });
  });
}

async function load() {
  const lang = currentLang();
  const meta = LANG_META[lang];
  if (!meta) {
    document.querySelector("main").innerHTML = '<div class="center">Unknown language.</div>';
    return;
  }
  document.title = `${meta.name} · Kalopaideia`;
  document.getElementById("lang-label").textContent = meta.name;
  document.getElementById("lang-subtitle").textContent = meta.subtitle;

  try {
    const res = await fetch(`${BASE}/api/language/${lang}?limit=50`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.primer) {
      // Register primer with LetterPhonetics for accurate letter breakdown
      if (typeof LetterPhonetics !== 'undefined') {
        LetterPhonetics.setPrimer(lang, data.primer);
      }

      document.getElementById("primer").style.display = "";
      const overview = data.primer.overview
        ? `<p class="primer-overview">${esc(data.primer.overview)}</p>` : "";
      document.getElementById("primer-overview").innerHTML = overview;

      // Wire tabs FIRST so they work even if subsequent renders throw.
      wireTabs();

      try { renderAlphabet(data.primer, lang); } catch (e) { console.error("renderAlphabet failed", e); }
      try { renderGrammar(data.primer, lang); } catch (e) { console.error("renderGrammar failed", e); }
      try { renderNumbers(data.primer, lang); } catch (e) { console.error("renderNumbers failed", e); }
      try { await renderLibraryAndReading(data.primer, lang); } catch (e) { console.error("renderLibraryAndReading failed", e); }
      try { wireLetterAudio(); } catch (e) { console.error("wireLetterAudio failed", e); }
      try { wireParadigmAudio(lang); } catch (e) { console.error("wireParadigmAudio failed", e); }
    }

    const entriesEl = document.getElementById("entries");
    if (!data.entries || data.entries.length === 0) {
      entriesEl.innerHTML = '<div class="center">No daily words recorded yet for this language.</div>';
    } else {
      // Per Jae 2026-05-09: insert an inline Akousma promo card AFTER
      // each daily-word entry, ROTATING through the language's available
      // titles (e.g. Greek alternates Iliad / Odyssey / Republic / Sappho)
      // so the same cover doesn't repeat under every entry.
      const interleaved = data.entries.map(function (row, idx) {
        const ako = (typeof renderAkousmaCard === "function")
          ? renderAkousmaCard(lang, idx) : "";
        return entryHtml(row) + ako;
      }).join("");
      entriesEl.innerHTML = interleaved;
      wireWordAudio();
      setupInfiniteScroll(lang, data.nextBefore, data.hasMore);
    }

    // Populate the dynamic library count on every Akousma card just rendered.
    if (typeof fetchAkousmaCount === "function") fetchAkousmaCount();
  } catch (err) {
    document.getElementById("entries").innerHTML = '<div class="center">Could not load this section.</div>';
    console.error(err);
  }
}

// Infinite scroll: when sentinel near viewport, fetch next page
function setupInfiniteScroll(lang, nextBefore, hasMore) {
  const entriesEl = document.getElementById("entries");
  // Remove any existing sentinel/loader
  document.querySelectorAll(".infinite-sentinel, .infinite-loader, .infinite-end").forEach(el => el.remove());

  if (!hasMore || !nextBefore) {
    const end = document.createElement("div");
    end.className = "infinite-end";
    end.textContent = "· · ·  — end of archive —  · · ·";
    entriesEl.parentNode.insertBefore(end, entriesEl.nextSibling);
    return;
  }

  const sentinel = document.createElement("div");
  sentinel.className = "infinite-sentinel";
  sentinel.dataset.before = nextBefore;
  entriesEl.parentNode.insertBefore(sentinel, entriesEl.nextSibling);

  let loading = false;
  const observer = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || loading) continue;
      loading = true;
      observer.unobserve(sentinel);

      const loader = document.createElement("div");
      loader.className = "infinite-loader";
      loader.textContent = "Loading older words…";
      entriesEl.parentNode.insertBefore(loader, sentinel);

      try {
        const res = await fetch(`${BASE}/api/language/${lang}?limit=20&before=${encodeURIComponent(sentinel.dataset.before)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const more = await res.json();

        loader.remove();
        sentinel.remove();

        if (more.entries && more.entries.length > 0) {
          // Same rotation as the initial load. Use the count of already-rendered
          // entries as the starting offset so the rotation continues seamlessly
          // across paginated loads.
          const offset = entriesEl.querySelectorAll(".lang-entry").length;
          const html = more.entries.map(function (row, idx) {
            const ako = (typeof renderAkousmaCard === "function")
              ? renderAkousmaCard(lang, offset + idx) : "";
            return entryHtml(row) + ako;
          }).join("");
          entriesEl.insertAdjacentHTML("beforeend", html);
          wireWordAudio();
          if (typeof fetchAkousmaCount === "function") fetchAkousmaCount();
        }
        setupInfiniteScroll(lang, more.nextBefore, more.hasMore);
      } catch (e) {
        console.error("Pagination failed", e);
        loader.textContent = "Could not load more. Tap to retry.";
        loader.style.cursor = "pointer";
        loader.addEventListener("click", () => {
          loader.remove();
          setupInfiniteScroll(lang, nextBefore, hasMore);
        });
      }
    }
  }, { rootMargin: "400px" });

  observer.observe(sentinel);
}

load();

// === Analytics: pronunciation tooltip / library line read ===
// Delegated listeners so we don't have to wire each rendered span.
(function wireAnalyticsHooks() {
  if (typeof document === 'undefined') return;

  // word_tooltip: fired when a .pronounceable span receives focus (keyboard
  // or mobile tap) or is hovered for >300 ms (intentful hover, not pass-by).
  const tooltipSeen = new WeakSet();
  function reportTooltip(span) {
    if (!span || tooltipSeen.has(span)) return; // throttle: one per span per pageview
    tooltipSeen.add(span);
    if (!window.Analytics) return;
    window.Analytics.track('word_tooltip', {
      lang: currentLang(),
      word: (span.textContent || '').trim().slice(0, 80),
      tooltip: span.getAttribute('data-tooltip') || null,
    });
  }
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest && e.target.closest('.pronounceable');
    if (t) reportTooltip(t);
  });
  let hoverTimer = null;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('.pronounceable');
    if (!t) return;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => reportTooltip(t), 300);
  });
  document.addEventListener('mouseout', () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  });

  // library_line_read: when a library line scrolls into view (IntersectionObserver).
  function observeLibraryLines() {
    if (!('IntersectionObserver' in window)) return;
    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (seen.has(entry.target)) continue;
        seen.add(entry.target);
        if (!window.Analytics) continue;
        const lineEl = entry.target;
        const lineN = lineEl.dataset.line || null;
        const textId = lineEl.closest('[data-text-id]')?.dataset.textId || null;
        window.Analytics.track('library_line_read', {
          textId,
          line: lineN ? Number(lineN) : null,
          lang: currentLang(),
        });
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px', threshold: 0.6 });
    document.querySelectorAll('.library-line[data-line]').forEach((el) => io.observe(el));
  }
  // Observe after the library pane renders (delayed). Use a MutationObserver
  // on #pane-library so we pick up lines as they're injected.
  const lib = document.getElementById('pane-library');
  if (lib) {
    const mo = new MutationObserver(observeLibraryLines);
    mo.observe(lib, { childList: true, subtree: true });
    observeLibraryLines();
  }
})();
