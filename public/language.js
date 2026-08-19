// Kalopaideia language page — primer + daily word archive

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
  // First check ?lang=… for backward-compat with stale links like
  // /paideia/language.html?lang=greek. If a recognizable lang appears
  // there, redirect to the canonical clean URL /paideia/<lang>.
  const qsLang = new URLSearchParams(location.search).get("lang");
  if (qsLang) {
    const clean = qsLang.toLowerCase().replace(/[^a-z]/g, "");
    if (clean) {
      // Hard redirect to the canonical URL. Preserves any hash.
      const target = `${BASE}/${clean}${location.hash || ""}`;
      if (location.pathname !== `${BASE}/${clean}`) {
        location.replace(target);
        return clean; // unreachable, but keeps callers safe pre-redirect
      }
      return clean;
    }
  }
  const parts = location.pathname.split("/").filter(Boolean);
  // Path may be /paideia/<lang>, /paideia/<lang>/, /paideia/<lang>/curriculum,
  // or /paideia/<lang>/curriculum/<lesson>. Pick the first part that matches
  // a known language code.
  for (const p of parts) {
    const clean = p.toLowerCase().replace(/[^a-z]/g, "");
    if (LANG_META && LANG_META[clean]) return clean;
  }
  return parts[parts.length - 1].toLowerCase();
}

function urlSubsection() {
  // Returns 'curriculum' | 'capstone' | null based on the path.
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.find((p) => p === "curriculum" || p === "capstone") || null;
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
        <button class="letter-btn" data-audio="${BASE}/alphabet-audio/${lang}/${idx}.mp3?v=2" aria-label="Pronounce ${esc(entry.char)}">
          <span class="letter-char">${esc(entry.char)}</span>
        </button>
        <div class="letter-name">${esc(entry.name || "")}</div>
        <div class="letter-ipa">${esc(entry.ipa || "")}<button class="letter-play" data-audio="${BASE}/alphabet-audio/${lang}/${idx}.mp3?v=2" aria-label="Pronounce ${esc(entry.char)}"><svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" fill="currentColor"/></svg></button></div>
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
  return `<span class="para-val" data-val="${esc(value)}">${pronValue}<span class="para-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="9" height="9"><polygon points="8,5 19,12 8,19" fill="currentColor"/></svg></span></span>`;
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
  try { return JSON.parse(localStorage.getItem("kalopaideia:bookmarks:v1") || "{}"); }
  catch { return {}; }
}

function bookmarksForLang(lang) {
  const all = getBookmarksSync();
  return Object.entries(all)
    .map(([text_id, d]) => ({ text_id, ...d }))
    .filter((b) => b.language === lang)
    .sort((a, b) => b.updated_at - a.updated_at);
}

// Per Jae 2026-05-12: the Library tab now shows a cover-and-blurb card for
// EVERY book in the language, with two render states:
//   - Subscriber (or anyone for the gateway work): "Open in Reader →" CTA,
//     plus a resume bar if they have saved progress.
//   - Non-subscriber: cover + blurb + "Subscribe — $12.99 / month" CTA. Gated
//     to "Subscribe — coming soon" until Stripe is configured.
// The single promotional Akousma ad card that used to lead this section
// has been removed. The site is the library now, not an ad for one book.

async function renderLibraryAndReading(primer, lang) {
  const pane = document.getElementById("pane-library");
  const readingList = primer.reading_list || [];
  let libraryTexts = [];
  try {
    const res = await fetch(`${BASE}/api/library/${lang}`);
    if (res.ok) libraryTexts = (await res.json()).texts || [];
  } catch {}

  // Match reading-list entries to library texts so we can mark which works
  // are part of the suggested progression vs. extra featured works.
  const usedLibIds = new Set();
  const matchedByLibId = new Map();
  readingList.forEach((r, idx) => {
    const match = matchLibraryToReading(r, libraryTexts);
    if (match) {
      usedLibIds.add(match.id);
      matchedByLibId.set(match.id, { difficulty: idx + 1, description: r });
    }
  });

  const user = window.__USER__ || null;
  const isSubscriber = !!(user && user.sub_status === 'active');
  const isSignedIn = !!user;

  const sections = [];

  // Library section header (echoes the masthead's scholarly treatment).
  sections.push(`
    <header class="library-masthead">
      <img class="library-masthead-emblem" src="${BASE}/img/masthead/temple-ruin.svg" alt="" aria-hidden="true" />
      <h3 class="library-masthead-title">The ${esc(LANG_META[lang]?.name || lang)} Library</h3>
      <p class="library-masthead-sub"><em>Akousma</em> — the audio library of Kalopaideia, by tradition</p>
    </header>
  `);

  sections.push(`<p class="library-intro">Sentence-by-sentence parallel-text readers. Each work opens in its original language alongside an English translation, with a word-by-word gloss on click and audio for every line.</p>`);

  // The Curriculum promo card — a quiet but unmistakable signal that
  // there is a guided course behind this language, not just books.
  sections.push(`
    <a class="curriculum-promo" href="${BASE}/${lang}/curriculum">
      <div class="cp-eyebrow">The Curriculum</div>
      <div class="cp-title">A guided ${esc(LANG_META[lang]?.name || lang)} course, in five stages</div>
      <div class="cp-sub">From the alphabet to the masters. Capstone examination. On-chain diploma.</div>
      <div class="cp-cta">Enter the Curriculum →</div>
    </a>
  `);

  // Subscriber status banner at the top of the library.
  if (isSubscriber) {
    sections.push(`<div class="akv2-sub-banner akv2-sub-banner-active"><b>The Akousma · Active.</b> Every work below is open to you.</div>`);
  } else if (isSignedIn) {
    sections.push(`<div class="akv2-sub-banner"><b>Signed in.</b> The gateway work below is open to you forever. Subscribe to The Akousma to open everything else — here and at <a href="https://newcharterventures.com/mansion/wanderings/akousma">The Reading Mansion</a>.</div>`);
  } else {
    sections.push(`<div class="akv2-sub-banner"><b>Not signed in.</b> <a href="${BASE}/login">Sign in</a> to open the gateway work and save your progress. Subscribe to The Akousma to open the rest — $12.99 a month, every work, present and future.</div>`);
  }

  // Per Jae 2026-05-13: cover-art book grid must render BEFORE the Continue
  // Reading list. The library IS the product; bookmarks are a continuation
  // hint. Greek and Latin had accumulated enough bookmarks that the inline
  // resume list was burying the actual cover-art cards below the fold.
  if (!libraryTexts.length) {
    sections.push(`<p class="library-empty"><em>The ${esc(LANG_META[lang]?.name || lang)} library is still being prepared.</em></p>`);
  } else {
    sections.push(`<h4 class="pane-subheading">The Library</h4>`);
    sections.push(`<div class="akousma-v2-grid">`);
    // Sort: gateway first, then matched (in reading-list order), then unmatched.
    const sorted = libraryTexts.slice().sort((a, b) => {
      if (a.is_gateway && !b.is_gateway) return -1;
      if (!a.is_gateway && b.is_gateway) return 1;
      const ai = matchedByLibId.has(a.id) ? matchedByLibId.get(a.id).difficulty : 999;
      const bi = matchedByLibId.has(b.id) ? matchedByLibId.get(b.id).difficulty : 999;
      return ai - bi;
    });
    for (const t of sorted) {
      const match = matchedByLibId.get(t.id);
      sections.push(bookCardHtml(t, { isSubscriber, isSignedIn, difficulty: match ? match.difficulty : null, description: match ? match.description : null }));
    }
    sections.push(`</div>`);
  }

  // Continue Reading from local bookmarks. Rendered AFTER the library grid
  // so the cover-art books are the first thing the visitor sees; bookmarks
  // are a resume aid below.
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

  // Reading-list entries that have NO matching library text ("preparing")
  // — keep these visible as a roadmap of works in translation.
  const preparing = readingList
    .map((r, idx) => ({ difficulty: idx + 1, description: r, library: matchLibraryToReading(r, libraryTexts) }))
    .filter((it) => !it.library);
  if (preparing.length) {
    sections.push(`<h4 class="pane-subheading">In Preparation</h4>`);
    sections.push(`<p class="library-intro" style="font-size:13px;">Works on the editorial roadmap. Parallel-text readers in preparation; covers and audio still being curated.</p>`);
    sections.push(`<ul class="library-list">`);
    for (const item of preparing) {
      sections.push(`
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
      `);
    }
    sections.push(`</ul>`);
  }

  pane.innerHTML = sections.join("");
}

// Render a single book card. Two visual variants share the same shell:
// the only differences are the CTA button area and whether the cover
// links to the reader directly. Gateway works (Odyssey Book 1) bypass
// the subscription gate entirely.
function bookCardHtml(t, ctx) {
  // New: Claude Design's prototype card vocabulary (.akv2-card), with the
  // lightened-cream palette to match the main Kalopaideia site. Per Jae
  // 2026-05-21. The CTA logic and access gating are unchanged.
  const { isSubscriber, isSignedIn, difficulty, description } = ctx;
  const hasAccess = isSubscriber || t.is_gateway;
  const stripeReady = !!(window.__STRIPE_READY__);

  const cover = t.cover_src
    ? `<img src="${esc(t.cover_src)}" alt="${esc(t.cover_alt || t.title)}" loading="lazy" />`
    : `<div class="akv2-card-cover-placeholder"><span class="akv2-card-cover-mark">Κ</span><span class="akv2-card-cover-sub">AKOUSMA</span></div>`;
  const credits = t.cover_credits
    ? `<p class="akv2-card-credits">${esc(t.cover_credits)}</p>` : '';
  const blurb = t.blurb
    ? `<p class="akv2-card-blurb">${esc(t.blurb)}</p>`
    : `<p class="akv2-card-blurb akv2-card-blurb-empty">Blurb in preparation.</p>`;
  const author = `${esc(t.author || '')}${t.date ? ' · ' + esc(t.date) : ''}`;
  const metaLeft = `${(t.lines_count || 0)} lines`;
  const metaRight = t.translator
    ? `tr. ${esc(t.translator)}${t.translator_date ? ', ' + esc(t.translator_date) : ''}`
    : '';
  const difficultyBadge = difficulty
    ? `<span class="akv2-card-reading-badge">Reading № ${difficulty}</span>` : '';
  const gatewayBadge = t.is_gateway
    ? `<span class="akv2-card-gateway-badge">Free — the gateway</span>` : '';
  const langLabel = (t.language || '').toUpperCase();

  let cta;
  // Per Jae 2026-05-12: The Akousma is an AUDIO library. CTAs say "listen",
  // not "read". Buttons: Open & Listen / Subscribe to listen / Sign in to listen.
  if (hasAccess) {
    cta = `
      <a class="akv2-card-btn" href="${BASE}/read/${esc(t.id)}">Open &amp; Listen →</a>
      ${t.is_gateway && !isSubscriber
        ? '<span class="akv2-card-cta-note">Open to everyone. Subscribe to The Akousma to open the rest.</span>'
        : ''}
    `;
  } else if (isSignedIn) {
    // Per Jae 2026-08-18: after becoming a member, the CTA should lead
    // straight into the reader for the SPECIFIC book being advertised,
    // not the generic /account page. checkout/all-access?next=/read/:id
    // carries the intended destination through Stripe checkout — the
    // success_url handler in commerce-stripe.js honors ?next when present.
    const nextReader = encodeURIComponent(`${BASE}/read/${t.id}`);
    cta = stripeReady
      ? `<form method="POST" action="${BASE}/checkout/all-access?next=${nextReader}" style="display:inline;">
           <button class="akv2-card-btn" type="submit">Become a Member — $12.99 / month</button>
         </form>
         <span class="akv2-card-cta-note">One membership opens every work in The Akousma, here and at The Reading Mansion.</span>`
      : `<button class="akv2-card-btn" type="button" disabled>Become a Member — coming soon</button>
         <span class="akv2-card-cta-note">Membership will open every work in The Akousma. Stripe wiring underway.</span>`;
  } else {
    const nextReader = encodeURIComponent(`${BASE}/read/${t.id}`);
    cta = `
      <a class="akv2-card-btn" href="${BASE}/login?next=${encodeURIComponent('/paideia/' + currentLang())}">Sign in to listen</a>
      <span class="akv2-card-cta-note">${t.is_gateway ? 'This work is free for any signed-in listener.' : 'Sign in, then become a member — $12.99 a month, every work.'}</span>
    `;
  }

  const innerLink = hasAccess ? `<a href="${BASE}/read/${esc(t.id)}" aria-label="Open ${esc(t.title)}">${cover}</a>` : cover;

  return `
    <article class="akv2-card${t.is_gateway ? ' akv2-card-gateway' : ''}${hasAccess ? '' : ' akv2-card-locked'}">
      <div class="akv2-card-head">
        <span class="akv2-card-lang">${esc(langLabel)}</span>
        ${gatewayBadge}${difficultyBadge}
      </div>
      <div class="akv2-card-cover">${innerLink}</div>
      <h3 class="akv2-card-title">${esc(t.title)}</h3>
      <p class="akv2-card-author">${author}</p>
      ${blurb}
      ${description ? `<p class="akv2-card-reading-note">${esc(description)}</p>` : ''}
      <div class="akv2-card-meta">
        <span class="lining">${metaLeft}</span>
        ${metaRight ? `<span>${metaRight}</span>` : ''}
      </div>
      <div class="akv2-card-cta">${cta}</div>
      ${credits}
    </article>
  `;
}

// Kept for backwards compat with any caller still using libraryItemHtml.
// Forwards to the new card with no-access defaults.
function libraryItemHtml(t) {
  return bookCardHtml(t, { isSubscriber: false, isSignedIn: false, difficulty: null, description: null });
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

// === Curriculum ===

let _curriculumLoaded = false;
async function renderCurriculum(lang) {
  if (_curriculumLoaded) return;
  _curriculumLoaded = true;
  const pane = document.getElementById("pane-curriculum");
  if (!pane) return;
  pane.innerHTML = `<p class="loading"><em>Loading curriculum…</em></p>`;

  let manifest = null;
  let progress = null;
  try {
    const m = await fetch(`${BASE}/api/curriculum/${lang}`);
    if (m.ok) manifest = await m.json();
  } catch {}
  try {
    const p = await fetch(`${BASE}/api/curriculum/${lang}/progress`);
    if (p.ok) progress = await p.json();
  } catch {}

  if (!manifest) {
    pane.innerHTML = `
      <h3 class="pane-heading">Curriculum</h3>
      <p class="grammar-para"><em>A guided curriculum for ${esc(LANG_META[lang]?.name || lang)} is in preparation.</em></p>`;
    return;
  }

  const cert = manifest.certification || {};
  const stages = manifest.stages || [];
  const totalLessons = stages.reduce((n, s) => n + (s.lessons?.length || 0), 0);
  const doneLessons = progress?.lessons ? Object.keys(progress.lessons).length : 0;
  const pct = totalLessons === 0 ? 0 : Math.round((doneLessons / totalLessons) * 100);
  const capstone = progress?.capstone;

  const html = [];
  html.push(`
    <div class="curriculum-header">
      <h3 class="pane-heading">${esc(manifest.display_name)} — Curriculum</h3>
      <p class="curriculum-tagline">${esc(manifest.tagline || "")}</p>
      <div class="curriculum-meta">
        <span><strong>Duration:</strong> ${esc(manifest.duration_estimate || "—")}</span>
        <span><strong>Method:</strong> ${esc(manifest.method || "—")}</span>
      </div>
      <div class="curriculum-progress">
        <div class="curriculum-progress-bar"><div class="curriculum-progress-fill" style="width:${pct}%"></div></div>
        <span class="curriculum-progress-label">${doneLessons} / ${totalLessons} lessons complete (${pct}%)</span>
      </div>
      ${capstone && capstone.passed ? `
        <div class="curriculum-diploma-banner">
          <strong>Diploma issued</strong>
          ${capstone.honors ? " (with Honors)" : ""}
          — Token <code>${esc(String(capstone.cert_token_id || "pending"))}</code>
          <a class="diploma-verify-link" href="${BASE}/verify/${esc(String(capstone.cert_token_id || ""))}">Verify</a>
        </div>` : ""}
    </div>
    <div class="curriculum-philosophy">${esc(manifest.philosophy || "").split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  `);

  for (const stage of stages) {
    const lessons = stage.lessons || [];
    const stageDone = lessons.filter((l) => progress?.lessons?.[l.id]).length;
    const cpDone = progress?.checkpoints?.[stage.checkpoint?.id]?.passed;
    html.push(`
      <section class="curriculum-stage">
        <header class="curriculum-stage-head">
          <h4 class="curriculum-stage-name">Stage ${stage.number} — ${esc(stage.name)}</h4>
          <span class="curriculum-stage-count">${stageDone}/${lessons.length} lessons · ${esc(stage.duration || "—")}</span>
        </header>
        <p class="curriculum-stage-subtitle">${esc(stage.subtitle || "")}</p>
        <ol class="curriculum-lesson-list">
          ${lessons.map((l) => {
            const done = !!progress?.lessons?.[l.id];
            return `<li class="curriculum-lesson ${done ? "done" : ""}">
              <a href="${BASE}/${lang}/curriculum/${esc(l.id)}">
                <span class="lesson-check">${done ? "✓" : "·"}</span>
                <span class="lesson-num">${esc(l.id)}</span>
                <span class="lesson-title">${esc(l.title)}</span>
              </a>
              <span class="lesson-body">${esc(l.content || "")}</span>
            </li>`;
          }).join("")}
        </ol>
        ${stage.checkpoint ? `
          <div class="curriculum-checkpoint ${cpDone ? "passed" : ""}">
            <strong>Checkpoint:</strong> ${esc(stage.checkpoint.title)}
            ${cpDone ? "<span class='cp-status passed'>passed</span>" : (stageDone === lessons.length && lessons.length > 0 ? `<a href="${BASE}/${lang}/curriculum/${esc(stage.checkpoint.id)}">Take the checkpoint →</a>` : "<span class='cp-status locked'>complete the lessons above to unlock</span>")}
          </div>` : ""}
        ${stage.tracks ? `
          <div class="curriculum-tracks">
            <h5 class="curriculum-tracks-head">Three tracks for the capstone:</h5>
            <ul class="curriculum-track-list">
              ${stage.tracks.map((t) => `<li><strong>${esc(t.name)}</strong> — ${esc(t.text)}<br><span class="track-rationale">${esc(t.rationale)}</span></li>`).join("")}
            </ul>
            ${stage.capstone_examination ? `<div class="curriculum-capstone-cta"><a class="capstone-link" href="${BASE}/${lang}/capstone">Sit the capstone examination →</a></div>` : ""}
          </div>` : ""}
      </section>
    `);
  }

  html.push(`
    <section class="curriculum-certification">
      <h4 class="pane-subheading">${esc(cert.credential_name || "Certification")}</h4>
      <p>${esc(cert.what_it_is || "")}</p>
      <p><strong>Issuance:</strong> ${esc(cert.issuance || "")}</p>
      <p><strong>Verification:</strong> <a href="${BASE}/verify">${BASE}/verify</a></p>
      <p><strong>Cost:</strong> ${esc(cert.cost || "Included in the Akousma subscription.")}</p>
    </section>
  `);

  pane.innerHTML = html.join("");
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
  document.querySelectorAll(".letter-btn, .letter-play").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      document.querySelectorAll(".letter-btn.playing, .letter-play.playing").forEach((b) => b.classList.remove("playing"));
      const src = btn.dataset.audio;
      if (!src) return;
      if (window.Analytics) {
        window.Analytics.track('alphabet_audio_play', {
          lang: currentLang(),
          char: btn.dataset.char || btn.textContent?.trim() || null,
        });
      }
      const audio = new Audio(src);
      btn.classList.add("playing");
      audio.addEventListener("ended", () => btn.classList.remove("playing"));
      audio.addEventListener("error", () => btn.classList.remove("playing"));
      audio.play().catch(() => btn.classList.remove("playing"));
      currentAudio = audio;
    });
  });
}

// === Daily word entries ===
//
// Per Jae 2026-08-18: the language-page archive entries must render with
// EXACT feature parity to the homepage's rich v2 word card (renderWord +
// renderCulture in app.js) — definitions ladder, etymology + cognate grid,
// in-literature citation with Greek/English/Both toggle + "hear the
// passage", Commonplace editorial note, and the right-rail (cultural
// vignette, related/cognates, "hear the word", daily practice + journal
// link). This was previously a flatter, older card shape; ported below
// to match app.js's renderWord()/renderCulture() 1:1 (adapted for this
// page's `row.entry` / `row.culture` / `row.date` shape instead of
// app.js's issue.languages[k] / issue.culture[k]).

// Procedural 36-bar waveform — identical algorithm to app.js's
// buildWaveformBars(), used by the "hear the word" and "hear the
// passage" listen cards.
function buildWaveformBars() {
  let out = '';
  for (let i = 0; i < 36; i++) {
    const h = 4 + 16 * Math.abs(Math.sin(i * 0.7) + Math.cos(i * 0.31));
    out += `<div class="bar" style="height:${h.toFixed(1)}px"${i < 13 ? ' data-active="1"' : ''}></div>`;
  }
  return out;
}

// Per-language seed lists for the right-rail "Related" + "Daily Practice"
// sections — identical to app.js's RELATED_SEED / PRACTICE_SEED. Used
// only when an entry doesn't yet carry the richer v2 fields.
const RELATED_SEED = {
  greek:         [['ψυχή', 'psychṗ', 'cold breath-soul; what departs at death'],
                  ['φρένες', 'phrénes', 'the diaphragm; the seat of thought'],
                  ['λόγος', 'lógos', 'word, reason, account'],
                  ['αρετή', 'aretṗ', 'excellence, virtue'],
                  ['ποιητής', 'poiētṗs', 'maker, poet']],
  latin:         [['anima', 'anima', 'breath, soul'],
                  ['animus', 'animus', 'mind, spirit, courage'],
                  ['ratio', 'ratio', 'reason, calculation'],
                  ['virtus', 'virtus', 'manly excellence, courage'],
                  ['otium', 'otium', 'cultured leisure']],
  french:        [['âme', 'âme', 'soul'],
                  ['esprit', 'esprit', 'mind, wit'],
                  ['raison', 'raison', 'reason'],
                  ['cœur', 'cœur', 'heart'],
                  ['volonté', 'volonté', 'will']],
  german:        [['Seele', 'Seele', 'soul'],
                  ['Geist', 'Geist', 'spirit, mind, ghost'],
                  ['Vernunft', 'Vernunft', 'reason'],
                  ['Sehnsucht', 'Sehnsucht', 'longing without object'],
                  ['Wille', 'Wille', 'will']],
  italian:       [['anima', 'anima', 'soul'],
                  ['cuore', 'cuore', 'heart'],
                  ['mente', 'mente', 'mind'],
                  ['ragione', 'ragione', 'reason'],
                  ['sprezzatura', 'sprezzatura', 'studied carelessness']],
  oldenglish:    [['mod', 'mod', 'heart-mind, courage'],
                  ['sāwol', 'sāwol', 'soul'],
                  ['wyrd', 'wyrd', 'fate, what is woven'],
                  ['ferð', 'ferð', 'life, spirit'],
                  ['hyge', 'hyge', 'thought, mind']],
  middleenglish: [['herte', 'herte', 'heart'],
                  ['soule', 'soule', 'soul'],
                  ['wit', 'wit', 'mind, understanding'],
                  ['corage', 'corage', 'heart, spirit'],
                  ['gentilesse', 'gentilesse', 'nobility of soul']],
  welsh:         [['enaid', 'enaid', 'soul'],
                  ['calon', 'calon', 'heart'],
                  ['ysbryd', 'ysbryd', 'spirit'],
                  ['hiraeth', 'hiraeth', 'longing for what is lost'],
                  ['awen', 'awen', 'poetic inspiration']],
  oldnorse:      [['hugr', 'hugr', 'mind, mood, thought'],
                  ['sjál', 'sjál', 'soul'],
                  ['vilji', 'vilji', 'will'],
                  ['móðr', 'móðr', 'courage, wrath'],
                  ['hjarta', 'hjarta', 'heart']],
};

const PRACTICE_SEED = {
  greek:         'Notice where today’s word lives in your body. Then write three lines describing the room around you, as though your breath were the witness.',
  latin:         'Read today’s word aloud three times, slowly. Then write one sentence in English that names something it points to in your day.',
  french:        'Take this word with you on a short walk. When you return, write one paragraph in your own voice that uses it once — not as a quotation, but as a thought.',
  german:        'Sit with this word for one minute, eyes closed, before reading further. Then write one sentence about what it stirred.',
  italian:       'Speak the word three times. Listen to how the vowels open. Then write one line of prose that earns the word’s music.',
  oldenglish:    'Read today’s word aloud as it would have been read in a hall — slow, weighted, low. Write three lines describing what it summons in you.',
  middleenglish: 'Read the word as Chaucer would have read it. Then write one couplet, anything, that holds it.',
  welsh:         'Speak the word aloud, paying attention to the ll, ch, or dd. Then write one sentence about a place that holds its meaning.',
  oldnorse:      'Sit with the word as you would with an old saga — unhurried. Write three short lines that name what the word carries.',
};

// Port of app.js's renderWord(langKey, entry, date) — identical logic,
// same DOM hooks (.word-card, .headword, .audio-btn[data-audio], etc.)
function renderWordCard(langKey, entry, date) {
  const audioPath = `${BASE}/audio/${date}/${langKey}.mp3`;
  const meta = LANG_META[langKey] || { name: langKey, subtitle: "" };
  const langDisplay = entry.display || meta.name || langKey;
  const posLine = esc(entry.part_of_speech || "");
  const transliteration = entry.transliteration ? esc(entry.transliteration) : "";

  let usageOriginal = "";
  let usageTranslation = "";
  let sentenceAudio = "";
  if (entry.usage_example) {
    const ue = entry.usage_example;
    let original = ue, translation = "";
    const splitMatch = ue.match(/\s+[—–]\s+|\s+-\s+/);
    if (splitMatch) {
      const idx = ue.indexOf(splitMatch[0]);
      original = ue.slice(0, idx).trim();
      translation = ue.slice(idx + splitMatch[0].length).trim();
    }
    usageOriginal = original;
    usageTranslation = translation;
    sentenceAudio = `${BASE}/api/word-audio/${langKey}/${encodeURIComponent(original)}.mp3`;
  }

  const sectionMark = (numeral, label) => `
    <div class="section-mark">
      <span class="numeral">${numeral}</span>
      <div class="line"></div>
      <span class="lbl">${esc(label)}</span>
    </div>`;

  let definitionsBlock = "";
  if (Array.isArray(entry.definition_shades) && entry.definition_shades.length) {
    const romanize = ['I.', 'II.', 'III.', 'IV.', 'V.', 'VI.'];
    const shadeHtml = entry.definition_shades.map((s, i) => `
      <div class="shade">
        <div class="n">${romanize[i] || ((i + 1) + '.')}</div>
        <div>
          <div class="head">${esc(s.head || '')}</div>
          ${s.body ? `<p class="body">${esc(s.body)}</p>` : ""}
        </div>
      </div>`).join('');
    definitionsBlock = `
      ${sectionMark('i.', 'Definitions')}
      <div class="shades">${shadeHtml}</div>`;
  } else if (entry.meaning) {
    definitionsBlock = `
      ${sectionMark('i.', 'Definitions')}
      <div class="shades">
        <div class="shade">
          <div class="n">I.</div>
          <div>
            <div class="head">${esc(entry.meaning)}</div>
            ${entry.forms ? `<p class="body">${esc(entry.forms)}</p>` : ""}
          </div>
        </div>
      </div>`;
  }

  let etymologyBlock = "";
  if (Array.isArray(entry.cognates) && entry.cognates.length) {
    const langName = (LANG_META[langKey] || {}).name || langKey;
    const cognateRows = entry.cognates.map((c) => {
      const isActive = (c.language || '').toLowerCase() === langName.toLowerCase();
      return `
        <div class="cognate-row${isActive ? ' active' : ''}">
          <div class="lang">${esc(c.language || '')}</div>
          <div class="word">${esc(c.word || '')}</div>
          <div class="gloss">${esc(c.gloss || '')}</div>
        </div>`;
    }).join('');
    etymologyBlock = `
      ${sectionMark('ii.', 'Etymology')}
      ${entry.etymology_root ? `<p class="ety-intro">From ${esc(entry.etymology_root)}.${entry.etymology ? ' ' + esc(entry.etymology) : ''}</p>` : entry.etymology ? `<p class="ety-intro">${esc(entry.etymology)}</p>` : ""}
      <div class="cognate-label">The cognate strand · across the ten tongues</div>
      <div class="cognate-grid">${cognateRows}</div>
      ${entry.etymology_caption ? `<p class="ety-note">⤴ ${esc(entry.etymology_caption)}</p>` : ""}`;
  } else if (entry.etymology) {
    etymologyBlock = `
      ${sectionMark('ii.', 'Etymology')}
      <p class="ety-intro">${esc(entry.etymology)}</p>`;
  }

  let literatureBlock = "";
  const citation = entry.citation || null;
  if (citation && citation.original) {
    const sourceLangLabel = (LANG_META[langKey] || {}).name || "Original";
    literatureBlock = `
      ${sectionMark('iii.', 'In Literature')}
      <div class="cit-header">
        <div class="cit-source">${esc(citation.source || '')}</div>
        <div class="segmented" data-seg>
          <button data-view="greek">${esc(sourceLangLabel)}</button>
          <button data-view="english">English</button>
          <button data-view="both" class="active">Both</button>
        </div>
      </div>
      <div class="cit-body both" data-cit-body>
        <div class="cit-greek">${esc(citation.original)}</div>
        ${citation.english ? `<div class="cit-english">${esc(citation.english)}</div>` : ""}
      </div>
      <div class="cit-listen rail-section">
        <div class="listen-card">
          <div class="lbl">Hear the passage</div>
          <p class="copy"><em>Read aloud in ${esc(sourceLangLabel)}.</em></p>
          <div class="controls">
            <button class="audio-btn play-btn cit-play" data-audio="${BASE}/api/word-audio/${langKey}/${encodeURIComponent(citation.original.replace(/\n/g, ' '))}.mp3" aria-label="Listen to the passage in ${esc(sourceLangLabel)}">
              <svg viewBox="0 0 16 16" width="11" height="11"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>
            </button>
            <div class="waveform" data-waveform>${buildWaveformBars()}</div>
          </div>
        </div>
      </div>
      ${entry.citation_note ? `<p class="cit-note">${esc(entry.citation_note)}</p>` : ""}`;
  } else if (entry.literary_context || usageOriginal) {
    literatureBlock = `
      ${sectionMark('iii.', 'In Literature')}
      ${entry.literary_context ? `<p class="cit-note" style="margin-top:0">${esc(entry.literary_context)}</p>` : ""}
      ${usageOriginal ? `
        <div class="cit-body both">
          <div class="cit-greek">${esc(usageOriginal)} <button class="audio-btn inline-audio-btn play-btn" data-audio="${sentenceAudio}" aria-label="Listen to sentence"><svg viewBox="0 0 16 16" width="11" height="11"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg></button></div>
          ${usageTranslation ? `<div class="cit-english">${esc(usageTranslation)}</div>` : ""}
        </div>` : ""}
    `;
  }

  let editorBlock = "";
  const commonplaceParas = Array.isArray(entry.commonplace) && entry.commonplace.length
    ? entry.commonplace
    : (entry.did_you_know ? [entry.did_you_know] : []);
  if (commonplaceParas.length) {
    const first = commonplaceParas[0].trim();
    const dropChar = first.charAt(0);
    const firstRest = first.slice(1);
    const restParas = commonplaceParas.slice(1).map(p => `<p>${esc(p)}</p>`).join('');
    editorBlock = `
      ${sectionMark('iv.', 'Commonplace')}
      <div class="commonplace">
        <div class="drop">${esc(dropChar)}</div>
        <div class="body">
          <p>${esc(firstRest)}</p>
          ${restParas}
          <div class="signed">
            <svg viewBox="0 0 20 20" width="13" height="13" style="color:var(--ink-3-proto)"><path d="M16.5 2.5C13 4 7 6 4.5 11.5c-.6 1.3-1 3-1 6 2-3 4-4 6-4.5C13 12 16 9 17 6c.3-1 .2-2-.5-3.5z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9 11l-5 6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
            — The Editor
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="word-card" data-lang="${langKey}">
      <div class="department-row">
        <div class="ornament-row">
          <span class="line"></span>
          <span class="diamond"></span>
          <span class="line"></span>
        </div>
        <div class="dept-line">${esc(langDisplay)}${posLine ? `<span class="sep">◆</span>${posLine}` : ""}</div>
        <div class="dept-sub">${esc(meta.subtitle || meta.tagline || "")}</div>
      </div>

      <div class="hero">
        <div class="headword-wrap">
          <span class="headword">${esc(entry.word)}</span>
        </div>
        <div class="hero-meta">
          ${transliteration ? `<div class="transliteration-h">${transliteration}</div>` : ""}
          ${transliteration ? `<span class="diamond" style="opacity:.5"></span>` : ""}
          <button class="audio-btn play-btn" data-audio="${audioPath}" aria-label="Pronounce ${esc(entry.word)}">
            <svg viewBox="0 0 16 16" width="11" height="11"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>
          </button>
          ${entry.ipa ? `<span class="diamond" style="opacity:.5"></span><div class="ipa">${esc(entry.ipa)}</div>` : ""}
        </div>
        ${Array.isArray(entry.register) && entry.register.length
          ? `<div class="register-line">${entry.register.map(esc).join(' · ')}</div>`
          : (entry.pronunciation ? `<div class="register-line">Say: ${esc(entry.pronunciation)}</div>` : "")}
        <button class="annot-toggle" type="button">— click the word, or here, to read the marks</button>
      </div>

      ${(entry.quick_gloss || entry.meaning) ? `
        <div class="quick-gloss">
          <div class="ornament-row">
            <span class="line"></span>
            <span class="diamond"></span>
            <span class="line"></span>
          </div>
          <p><em>“${esc(entry.quick_gloss || entry.meaning)}”</em></p>
        </div>` : ""}

      ${definitionsBlock}
      ${etymologyBlock}
      ${literatureBlock}
      ${editorBlock}

      <div class="pronunciation" style="display:none">Say: ${esc(entry.pronunciation || "")} IPA: ${esc(entry.ipa || "")}</div>
    </div>
  `;
}

// Port of app.js's renderCulture(vignette, entry, langKey, date) — the
// right-rail: cultural vignette plate, related/cognates, "hear the
// word", daily practice + "open in journal".
function renderCultureRail(vignette, entry, langKey, date) {
  const meta = LANG_META[langKey] || { name: langKey, subtitle: "" };
  const langName = meta.name || langKey;
  const audioPath = date && langKey ? `${BASE}/audio/${date}/${langKey}.mp3` : null;

  let culturePlate;
  if (!vignette) {
    culturePlate = `
      <figure class="culture-figure" style="margin:0">
        <div class="culture-plate">
          <div class="plate-num">Plate I · The Cultural Vignette</div>
        </div>
        <p class="culture-body"><em>Cultural vignette in preparation.</em></p>
      </figure>`;
  } else {
    const img = vignette.image
      ? `<img class="culture-img" src="${esc(vignette.image.url)}" alt="${esc(vignette.title || "")}" loading="lazy" />
         <div class="culture-credit">${esc(vignette.image.credit)}</div>`
      : "";
    culturePlate = `
      <figure class="culture-figure" style="margin:0">
        <div class="culture-plate">
          <div class="plate-num">Plate I · The Cultural Vignette</div>
          ${img}
        </div>
        ${vignette.title ? `<h3 class="culture-title">${esc(vignette.title)}</h3>` : ""}
        <p class="culture-body">${esc(vignette.body || "")}</p>
      </figure>`;
  }

  let related = [];
  let relatedLabel = `Related · in ${esc(langName)}`;

  if (Array.isArray(entry && entry.related) && entry.related.length) {
    related = entry.related.map(r => [r.word || "", r.transliteration || r.tr || "", r.gloss || ""]);
  } else if (Array.isArray(entry && entry.cognates) && entry.cognates.length) {
    const headWord = (entry.word || "").trim();
    const headLang = (LANG_META[langKey] && LANG_META[langKey].name) || langKey;
    const filtered = entry.cognates.filter(c => {
      const w = (c.word || "").trim();
      return w && w !== headWord;
    });
    const sameLang = filtered.filter(c => (c.language || "").toLowerCase() === headLang.toLowerCase());
    const otherLang = filtered.filter(c => (c.language || "").toLowerCase() !== headLang.toLowerCase());
    const picked = sameLang.concat(otherLang).slice(0, 5);
    related = picked.map(c => [c.word || "", c.language || "", c.gloss || ""]);
    relatedLabel = sameLang.length === picked.length
      ? `Related · in ${esc(langName)}`
      : `Cognates · across languages`;
  } else if (Array.isArray(entry && entry.definition_shades) && entry.definition_shades.length) {
    const headWord = (entry.word || "").trim();
    related = entry.definition_shades.slice(0, 5).map(s => {
      const head = String(s.head || "").replace(/^[IVX]+\.\s*/i, "").trim();
      const body = String(s.body || "").replace(/\s+/g, " ").trim().slice(0, 120);
      return [headWord, head, body];
    });
    relatedLabel = `Senses · the word in shades`;
  } else {
    related = RELATED_SEED[langKey] || [];
  }

  const relatedHtml = related.length ? `
    <div class="rail-section">
      <div class="rail-section-label">${relatedLabel}</div>
      <div class="related">
        ${related.map(([w, tr, gl]) => `
          <div class="row">
            <div>
              <div class="word">${esc(w)}</div>
              ${tr ? `<div class="tr">${esc(tr)}</div>` : ""}
            </div>
            <div class="gloss">${esc(gl)}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  const listenHtml = audioPath ? `
    <div class="rail-section">
      <div class="listen-card">
        <div class="lbl">Hear the word</div>
        <p class="copy"><em>The daily reading, in restored ${esc(langName)} pronunciation.</em></p>
        <div class="controls">
          <button class="audio-btn play-btn" data-audio="${audioPath}" aria-label="Play">
            <svg viewBox="0 0 16 16" width="11" height="11"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>
          </button>
          <div class="waveform" data-waveform>${buildWaveformBars()}</div>
        </div>
      </div>
    </div>` : "";

  const practice = (entry && entry.daily_practice)
    ? String(entry.daily_practice).trim()
    : (PRACTICE_SEED[langKey] || "");
  const practiceHtml = practice ? `
    <div class="rail-section">
      <div class="practice-card">
        <div class="tab">Daily Practice</div>
        <p><em>${esc(practice)}</em></p>
        <a href="#" class="open-journal-btn" data-open-journal data-lang="${esc(langKey)}" data-date="${esc(date || '')}">Open in journal →</a>
      </div>
    </div>` : "";

  return `
    <div class="right-rail">
      ${culturePlate}
      ${relatedHtml}
      ${listenHtml}
      ${practiceHtml}
    </div>
  `;
}

function entryHtml(row) {
  const e = row.entry;
  const lang = currentLang();
  return `
    <article class="lang-entry">
      <div class="entry-date">${esc(formatDate(row.date))}</div>
      <div class="word-block">
        ${renderWordCard(lang, e, row.date)}
        ${renderCultureRail(row.culture, e, lang, row.date)}
      </div>
    </article>
  `;
}

// Per Jae 2026-05-12: identical to fitHeadwords() in app.js — binary
// search the largest font-size that keeps each headword on a single
// line inside its parent .word-header / .headword-row. CSS clamp()
// can't do this because it scales on viewport width, not on a word's
// actual rendered length.
function fitHeadwords(root) {
  const heads = (root || document).querySelectorAll(".word-card .word-header .headword");
  heads.forEach((el) => {
    const row = el.parentElement;
    if (!row) return;
    const rowWidth = row.getBoundingClientRect().width;
    const btn = row.querySelector(".audio-btn");
    const gap = parseFloat(getComputedStyle(row).gap) || 0;
    const btnWidth = btn ? btn.getBoundingClientRect().width : 0;
    const available = Math.max(80, rowWidth - btnWidth - gap - 4);
    const cs = getComputedStyle(el);
    let max = parseFloat(cs.fontSize) || 72;
    let min = 18;
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";
    if (el.scrollWidth <= available) {
      el.style.whiteSpace = "";
      el.style.overflow = "";
      return;
    }
    let best = min;
    for (let i = 0; i < 12; i++) {
      const mid = (min + max) / 2;
      el.style.fontSize = mid + "px";
      if (el.scrollWidth <= available) { best = mid; min = mid; }
      else { max = mid; }
    }
    el.style.fontSize = Math.floor(best) + "px";
    el.style.whiteSpace = "";
    el.style.overflow = "";
  });
}
if (!window.__headwordFitWired) {
  window.__headwordFitWired = true;
  let __fitT = null;
  window.addEventListener("resize", () => {
    clearTimeout(__fitT);
    __fitT = setTimeout(() => fitHeadwords(), 120);
  }, { passive: true });
}

// Per Jae 2026-08-18: the ported word-card / right-rail markup uses
// SVG-icon play buttons (.play-btn, matching app.js's homepage cards),
// while the Numbers-pane rows still use plain-text ▶/■ glyph buttons.
// Both share the .audio-btn class, so this must NOT blindly overwrite
// textContent — doing so would destroy the SVG icon inside .play-btn.
// Detect an SVG child and toggle a "playing" class only in that case
// (identical semantics to app.js's wireAudio()); otherwise fall back to
// the original glyph-swap behavior for legacy plain-text buttons.
function wireWordAudio() {
  document.querySelectorAll(".audio-btn").forEach((btn) => {
    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    const hasSvg = !!btn.querySelector("svg");
    btn.addEventListener("click", () => {
      const src = btn.dataset.audio;
      if (!src) return;
      if (currentAudio) {
        const prevBtn = currentAudio.__btn;
        currentAudio.pause();
        if (prevBtn) {
          prevBtn.classList.remove("playing");
          if (!prevBtn.querySelector("svg")) prevBtn.textContent = "▶";
        }
        const wasSameBtn = prevBtn === btn;
        currentAudio = null;
        if (wasSameBtn) return; // toggle off
      }
      const audio = new Audio(src);
      audio.__btn = btn;
      btn.classList.add("playing");
      if (!hasSvg) btn.textContent = "■";
      audio.play().catch(() => {
        btn.classList.remove("playing");
        if (!hasSvg) btn.textContent = "▶";
        currentAudio = null;
      });
      audio.addEventListener("ended", () => {
        btn.classList.remove("playing");
        if (!hasSvg) btn.textContent = "▶";
        if (currentAudio === audio) currentAudio = null;
      });
      currentAudio = audio;
    });
  });
}

// Port of app.js's wireCitationToggles() — wires the Greek/English/Both
// segmented control in the In Literature citation block.
function wireCitationToggles() {
  document.querySelectorAll("[data-seg]").forEach((seg) => {
    if (seg.dataset.wired === "1") return;
    seg.dataset.wired = "1";
    const body = seg.closest(".word-card")?.querySelector("[data-cit-body]");
    const buttons = seg.querySelectorAll("button[data-view]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        buttons.forEach((b) => b.classList.toggle("active", b === btn));
        if (body) {
          body.classList.remove("greek", "english", "both");
          body.classList.add(view);
        }
      });
    });
  });
}

// Port of app.js's journal-modal lazy loader + "Open in journal" wiring.
// The modal HTML/CSS/JS is shared with the homepage (journal-modal.html/
// .css/.js) — loaded once, lazily, on first click.
let __journalLoaded = false;
let __journalLoading = null;
async function ensureJournalLoaded() {
  if (__journalLoaded) return;
  if (__journalLoading) return __journalLoading;
  __journalLoading = (async () => {
    try {
      const mount = document.getElementById('journal-modal-mount');
      if (!mount) return;
      const r = await fetch(`${BASE}/journal-modal.html?v=1779328917`);
      if (!r.ok) throw new Error('journal-modal.html fetch failed: ' + r.status);
      mount.innerHTML = await r.text();
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = `${BASE}/journal-modal.js?v=1779328917`;
        s.onload = res;
        s.onerror = () => rej(new Error('journal-modal.js load failed'));
        document.body.appendChild(s);
      });
      __journalLoaded = true;
    } catch (e) {
      console.error('[journal] lazy-load failed', e);
    }
  })();
  return __journalLoading;
}

// Build the journal-modal ENTRY payload for a language-page word card.
// Mirrors app.js's buildJournalEntry() but reads the entry directly from
// the clicked button's data attributes + the cached page data, since this
// page doesn't have a single "today" issue object — each archive entry
// carries its own date and entry data.
function buildJournalEntryFromRow(langKey, date) {
  const cache = window.__langEntryCache || {};
  const entry = cache[date];
  if (!entry) return null;
  const meta = LANG_META[langKey] || {};
  let usageOriginal = '', usageEnglish = '';
  if (entry.usage_example) {
    const ue = entry.usage_example;
    const splitMatch = ue.match(/\s+[—–]\s+|\s+-\s+/);
    if (splitMatch) {
      const idx = ue.indexOf(splitMatch[0]);
      usageOriginal = ue.slice(0, idx).trim();
      usageEnglish = ue.slice(idx + splitMatch[0].length).trim();
    } else {
      usageOriginal = ue.trim();
    }
  }
  const dateObj = new Date(date);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  const prettyDate = `${monthName} ${day}, ${year}`;
  return {
    langName: meta.name || langKey,
    word: entry.word || '',
    transliteration: entry.transliteration || '',
    meaning: entry.meaning || '',
    definition_shades: Array.isArray(entry.definition_shades) ? entry.definition_shades : [],
    citation: entry.citation || null,
    usage_original: usageOriginal,
    usage_english: usageEnglish,
    issueDate: prettyDate,
    issueNumber: '',
    dailyPractice: entry.daily_practice || (typeof PRACTICE_SEED !== 'undefined' ? (PRACTICE_SEED[langKey] || '') : ''),
    storageKey: `kp-journal-${date}-${langKey}`,
  };
}

function wireOpenJournal() {
  if (document.__journalDelegateWired) return;
  document.__journalDelegateWired = true;
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-open-journal]');
    if (!btn) return;
    e.preventDefault();
    const langKey = btn.getAttribute('data-lang') || currentLang();
    const date = btn.getAttribute('data-date') || '';
    await ensureJournalLoaded();
    if (typeof window.__paideiaOpenJournal === 'function') {
      const entryPayload = buildJournalEntryFromRow(langKey, date);
      if (entryPayload) {
        window.__paideiaOpenJournal(entryPayload);
      } else {
        window.__paideiaOpenJournal();
      }
    } else {
      const overlay = document.getElementById('kp-journal');
      if (overlay) overlay.classList.add('open');
    }
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

  // Per Jae 2026-05-12: fetch live akousma cover data so the per-section
  // promo cards pull covers from library-meta.json, not the stale
  // hardcoded AKOUSMA_BOOKS fallback in akousma.js.
  if (typeof fetchAkousmaCards === "function") {
    await fetchAkousmaCards();
  }

  // Per Jae 2026-05-12: fetch the user's identity + subscription status
  // + the global stripe-ready flag BEFORE rendering the library tab so
  // cards can pick the right CTA (Open / Subscribe / Sign in / coming
  // soon). Fails silently for anonymous users.
  try {
    const wr = await fetch(`${BASE}/api/whoami`, { credentials: 'same-origin' });
    if (wr.ok) {
      const wd = await wr.json();
      window.__USER__ = wd.user || null;
      window.__STRIPE_READY__ = !!wd.stripe_ready;
    } else {
      window.__USER__ = null;
      window.__STRIPE_READY__ = false;
    }
  } catch {
    window.__USER__ = null;
    window.__STRIPE_READY__ = false;
  }

  try {
    const page = Math.max(1, parseInt(new URLSearchParams(location.search).get("page"), 10) || 1);
    const res = await fetch(`${BASE}/api/language/${lang}?page=${page}`);
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

      // If the URL was /paideia/<lang>/curriculum, auto-switch tabs.
      // Curriculum is now its own dedicated page at /paideia/<lang>/curriculum,
// no in-page tab to switch to. Falls through cleanly.
    }

    const entriesEl = document.getElementById("entries");
    if (!data.entries || data.entries.length === 0) {
      entriesEl.innerHTML = '<div class="center">No daily words recorded yet for this language.</div>';
    } else {
      // Per Jae 2026-05-09: insert an inline Akousma promo card AFTER
      // each daily-word entry, ROTATING through the language's available
      // titles (e.g. Greek alternates Iliad / Odyssey / Republic / Sappho)
      // so the same cover doesn't repeat under every entry.
      // Per Jae 2026-08-18: cache each entry by date so the "Open in
      // journal" button (wired from the ported renderCultureRail) can
      // look up the full entry payload later without re-fetching.
      window.__langEntryCache = window.__langEntryCache || {};
      data.entries.forEach((row) => { window.__langEntryCache[row.date] = row.entry; });
      const interleaved = data.entries.map(function (row, idx) {
        const ako = (typeof renderAkousmaCard === "function")
          ? renderAkousmaCard(lang, idx) : "";
        return entryHtml(row) + ako;
      }).join("");
      entriesEl.innerHTML = interleaved;
      wireWordAudio();
      wireCitationToggles();
      wireOpenJournal();
      fitHeadwords();
      renderPager(lang, data.page, data.totalPages);
    }

    // Populate the dynamic library count on every Akousma card just rendered.
    if (typeof fetchAkousmaCount === "function") fetchAkousmaCount();
  } catch (err) {
    document.getElementById("entries").innerHTML = '<div class="center">Could not load this section.</div>';
    console.error(err);
  }
}

// Numbered pagination (Jae 2026-08-18: replaces the old infinite-scroll
// sentinel/IntersectionObserver approach). Renders Prev / page numbers /
// Next below the entries list. Clicking a page number updates ?page= in
// the URL (so pages are shareable/bookmarkable) and re-runs load().
function renderPager(lang, page, totalPages) {
  const entriesEl = document.getElementById("entries");
  document.querySelectorAll(".word-pager").forEach(el => el.remove());

  if (totalPages <= 1) return;

  const pager = document.createElement("nav");
  pager.className = "word-pager";
  pager.setAttribute("aria-label", "Daily word archive pages");

  function pageLink(label, targetPage, opts = {}) {
    const disabled = opts.disabled || targetPage === page;
    const cls = ["pager-btn"];
    if (opts.current) cls.push("pager-current");
    if (disabled && !opts.current) cls.push("pager-disabled");
    if (disabled) {
      return `<span class="${cls.join(" ")}">${label}</span>`;
    }
    return `<a class="${cls.join(" ")}" href="?page=${targetPage}" data-page="${targetPage}">${label}</a>`;
  }

  const parts = [];
  parts.push(pageLink("‹ Prev", page - 1, { disabled: page <= 1 }));

  // Windowed page numbers: first, last, and a few around current.
  const windowSize = 2;
  const pagesToShow = new Set([1, totalPages]);
  for (let p = page - windowSize; p <= page + windowSize; p++) {
    if (p >= 1 && p <= totalPages) pagesToShow.add(p);
  }
  const sorted = [...pagesToShow].sort((a, b) => a - b);
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) parts.push(`<span class="pager-ellipsis">…</span>`);
    parts.push(pageLink(String(p), p, { current: p === page }));
    prev = p;
  }

  parts.push(pageLink("Next ›", page + 1, { disabled: page >= totalPages }));

  pager.innerHTML = parts.join("");
  entriesEl.parentNode.insertBefore(pager, entriesEl.nextSibling);

  pager.querySelectorAll("a.pager-btn").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPage = a.dataset.page;
      const url = new URL(location.href);
      url.searchParams.set("page", targetPage);
      history.pushState({}, "", url);
      entriesEl.parentNode.insertBefore(
        Object.assign(document.createElement("div"), { className: "center", textContent: "Loading…" }),
        entriesEl
      );
      load();
      // Scroll to the top of the archive section, not the whole page.
      entriesEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

window.addEventListener("popstate", () => { load(); });

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
