// Paideia front-end — renders today's 5-language edition

const BASE = "/paideia";

// Daily-rotation order. Hybrid plan (Jae 2026-05-11): Welsh and Old Norse
// JOIN the rotation; Gaulish stays reference-only (no daily word). Front
// page now shows nine cards on a regular day.
const LANG_ORDER = ["greek", "latin", "french", "german", "italian", "oldenglish", "middleenglish", "welsh", "oldnorse"];
const LANG_META = {
  // Taglines: Title Case to match the prototype's editorial register (Jae 2026-05-21).
  latin:         { name: "Latin",          tagline: "Classical Roman Letters" },
  greek:         { name: "Greek",          tagline: "Ancient Hellenic Letters" },
  italian:       { name: "Italian",        tagline: "Trecento &amp; Renaissance Letters" },
  french:        { name: "French",         tagline: "Literary French" },
  german:        { name: "German",         tagline: "Letters &amp; Philosophy" },
  oldenglish:    { name: "Olde English",   tagline: "Anglo-Saxon Poetry" },
  middleenglish: { name: "Middle English", tagline: "Chaucer &amp; the Pearl-Poet" },
  gaulish:       { name: "Gaulish",        tagline: "Continental Celtic Inscriptions", category: "celtic" },
  welsh:         { name: "Welsh",          tagline: "Middle Welsh &amp; the Modern Bardd", category: "celtic" },
  oldnorse:      { name: "Old Norse",      tagline: "The Saga-Language of Iceland",       category: "germanic" },
};

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Procedural 36-bar waveform matching the prototype's listen card.
// Same algorithm as paideia-prototype-v2/index.html ~1293–1302.
// Used by both the right-rail "Hear the word" card AND the In Literature
// "Hear the passage" card beneath the citation. Per Jae 2026-05-21:
// the citation should use the same elegant card pattern as the headword.
function buildWaveformBars() {
  let out = '';
  for (let i = 0; i < 36; i++) {
    const h = 4 + 16 * Math.abs(Math.sin(i * 0.7) + Math.cos(i * 0.31));
    out += `<div class="bar" style="height:${h.toFixed(1)}px"${i < 13 ? ' data-active="1"' : ''}></div>`;
  }
  return out;
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
  // Per Jae 2026-05-20 v2 design migration: emit the new prototype
  // structure (left panel = department row → hero → quick gloss →
  // numbered sections i/ii/iii/iv). Where the prototype expects
  // richer data than our current word generator produces (cognate
  // grid, multiple definition shades, citation view-toggle, editorial
  // commonplace, daily-practice prompt), we render the live-data
  // equivalent and DROP the richer-only chrome until the generator
  // is upgraded in Phase 1.5.
  //
  // Preserves all existing DOM hooks: .word-card, .headword,
  // .audio-btn[data-audio], .pronunciation — don't rename these;
  // app.js wires up audio playback against them later in the file.

  const audioPath = `${BASE}/audio/${date}/${langKey}.mp3`;
  const meta = LANG_META[langKey] || { name: langKey, tagline: "" };
  const langDisplay = entry.display || meta.name || langKey;
  const posLine = esc(entry.part_of_speech || "");
  const transliteration = entry.transliteration ? esc(entry.transliteration) : "";

  // "In Use" section: original sentence + Listen button after it, then
  // translation on its OWN line below (no audio for the English).
  // Separator may be em-dash (—), en-dash (–), or ASCII hyphen with
  // spaces ( - ); accept all three so prompt variants render correctly.
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

  // Numbered section helper — mirrors the prototype's .section-mark
  // (numeral + line + label).
  const sectionMark = (numeral, label) => `
    <div class="section-mark">
      <span class="numeral">${numeral}</span>
      <div class="line"></div>
      <span class="lbl">${esc(label)}</span>
    </div>`;

  // Definitions section. v2 schema (per Jae 2026-05-20) provides
  // entry.definition_shades as an array of {head, body} objects.
  // Falls back to single-shade rendering from `meaning` + `forms`
  // for archive days generated before the schema upgrade.
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

  // Etymology section. v2 schema provides:
  //   etymology_root  — short root + gloss line above the cognate grid
  //   cognates[]      — array of {language, word, gloss}
  //   etymology_caption — short editorial line below the grid
  // Falls back to plain etymology text when absent.
  let etymologyBlock = "";
  if (Array.isArray(entry.cognates) && entry.cognates.length) {
    const langName = (LANG_META[langKey] || {}).name || langKey;
    const cognateRows = entry.cognates.map((c, i) => {
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
      ${entry.etymology_caption ? `<p class="ety-note">⤷ ${esc(entry.etymology_caption)}</p>` : ""}`;
  } else if (entry.etymology) {
    etymologyBlock = `
      ${sectionMark('ii.', 'Etymology')}
      <p class="ety-intro">${esc(entry.etymology)}</p>`;
  }

  // Literature section. v2 schema provides entry.citation = {source,
  // original, english} plus entry.citation_note. The site renders these
  // side-by-side with a Greek/English/Both toggle, or falls back to
  // the older literary_context + usage_example shape.
  let literatureBlock = "";
  const citation = entry.citation || null;
  if (citation && citation.original) {
    // Toggle label is the LANGUAGE NAME (Greek / Latin / French / ...), not the
    // word "Original". Matches the prototype which hard-codes "Greek" because
    // the prototype only shows Greek; for our 9-language site we use the
    // language's display name dynamically.
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
      <!-- Hear the passage card — sits BELOW the citation in the original
           language section. Same listen-card visual treatment as the
           right-rail "Hear the word" card so the design language stays
           coherent. Per Jae 2026-05-21. -->
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

  // Commonplace / Editor's Note section. v2 schema provides
  // entry.commonplace as an array of paragraphs (an editorial essay
  // signed by The Editor). Falls back to did_you_know when absent.
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
      <!-- Department -->
      <div class="department-row">
        <div class="ornament-row">
          <span class="line"></span>
          <span class="diamond"></span>
          <span class="line"></span>
        </div>
        <div class="dept-line">${esc(langDisplay)}${posLine ? `<span class="sep">◆</span>${posLine}` : ""}</div>
        <div class="dept-sub">${esc(meta.tagline || "")}</div>
      </div>

      <!-- Hero — matches prototype paideia-prototype-v2/index.html lines ~957–995.
           Headword in headword-wrap; hero-meta row with transliteration ◆ play ◆ IPA;
           register-line BELOW with register tags only (no "Say:" prefix — the
           prototype omits it); annot-toggle prompt for the click-to-read-the-marks affordance. -->
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

      <!-- Quick gloss — v2 schema uses entry.quick_gloss; falls back to entry.meaning -->
      ${(entry.quick_gloss || entry.meaning) ? `
        <div class="quick-gloss">
          <div class="ornament-row">
            <span class="line"></span>
            <span class="diamond"></span>
            <span class="line"></span>
          </div>
          <p><em>“${esc(entry.quick_gloss || entry.meaning)}”</em></p>
        </div>` : ""}

      <!-- Letter-by-letter phonetics breakdown DISABLED 2026-05-21 per Jae feedback:
           prototype doesn't show this row, so hide it for visual parity.
           Module is still loaded for potential re-enable as a Phase 1.5 feature. -->
      ${/* (typeof LetterPhonetics !== 'undefined') ? LetterPhonetics.renderHtml(entry.word, langKey, esc) : */ ''}

      ${definitionsBlock}
      ${etymologyBlock}
      ${literatureBlock}
      ${editorBlock}

      <!-- Hidden pronunciation block for backward compat with any external CSS/JS
           that targets .pronunciation. Visually replaced by the .register-line
           inside .hero above. -->
      <div class="pronunciation" style="display:none">Say: ${esc(entry.pronunciation || "")} IPA: ${esc(entry.ipa || "")}</div>
    </div>
  `;
}

// Per-language seed lists for the right-rail "Related" + "Daily Practice"
// sections. Used when the daily-word entry doesn't yet carry related[] or
// daily_practice fields (most of the archive). Once the v2 generator is
// running with the richer schema, entry.related and entry.daily_practice
// take precedence.
const RELATED_SEED = {
  greek:         [['ψυχή', 'psychḗ', 'cold breath-soul; what departs at death'],
                  ['φρένες', 'phrénes', 'the diaphragm; the seat of thought'],
                  ['λόγος', 'lógos', 'word, reason, account'],
                  ['ἀρετή', 'aretḗ', 'excellence, virtue'],
                  ['ποιητής', 'poiētḗs', 'maker, poet']],
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
                  ['ferhð', 'ferhð', 'life, spirit'],
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

function renderCulture(vignette, entry, langKey, date) {
  // v2 design: the right-rail. Three cards in vertical order:
  //   Plate I — Cultural vignette (was already shipped)
  //   Related words — in the headword's language
  //   Hear the word — listen card with daily-word audio
  //   Daily practice — meditative prompt
  // Per Jae 2026-05-21 feedback: do NOT drop these sections. Use
  // entry-provided data when present (richer v2 schema), fall back to
  // per-language seed lists when the entry was generated under the
  // older schema.

  const meta = LANG_META[langKey] || { name: langKey, tagline: "" };
  const langName = meta.name || langKey;
  const audioPath = date && langKey ? `${BASE}/audio/${date}/${langKey}.mp3` : null;

  // ----- Culture plate (unchanged) -----
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

  // ----- Related words -----
  // Prefer entry.related (v2 schema: array of {word, transliteration, gloss});
  // fall back to language seed list.
  const related = Array.isArray(entry && entry.related) && entry.related.length
    ? entry.related.map(r => [r.word || "", r.transliteration || r.tr || "", r.gloss || ""])
    : (RELATED_SEED[langKey] || []);
  const relatedHtml = related.length ? `
    <div class="rail-section">
      <div class="rail-section-label">Related · in ${esc(langName)}</div>
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

  // ----- Listen card -----
  // 36-bar waveform via the shared buildWaveformBars() helper. Same
  // pattern used by the In Literature "Hear the passage" card.
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

  // ----- Daily practice -----
  const practice = (entry && entry.daily_practice)
    ? String(entry.daily_practice).trim()
    : (PRACTICE_SEED[langKey] || "");
  const practiceHtml = practice ? `
    <div class="rail-section">
      <div class="practice-card">
        <div class="tab">Daily Practice</div>
        <p><em>${esc(practice)}</em></p>
        <a href="#" class="open-journal-btn" data-open-journal data-lang="${esc(langKey)}">Open in journal →</a>
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

// AKOUSMA promo card data and renderers live in akousma.js (loaded
// before this file). See AKOUSMA_BOOKS, renderAkousmaCard, fetchAkousmaCount.

function renderSection(langKey, entry, culture, date) {
  const meta = LANG_META[langKey] || { name: langKey, tagline: "" };
  return `
    <section class="lang-section" id="${langKey}" data-lang-section="${langKey}">
      <div class="lang-header">
        <div class="lang-name">${meta.name}</div>
        <div class="lang-tagline">${meta.tagline}</div>
      </div>
      <div class="word-block">
        ${renderWord(langKey, entry, date)}
        ${renderCulture(culture, entry, langKey, date)}
      </div>
      ${renderAkousmaCard(langKey)}
    </section>
  `;
}

// Single shared audio state across the page so re-wiring after archive loads
// doesn't create duplicate listeners (which caused echo when one button got
// wired multiple times).
let __audioState = { current: null };

// Per Jae 2026-05-12: CSS clamp() can't shrink based on a word's actual
// rendered width — only on viewport width. Long German compounds like
// 'Weltfrömmigkeit' overflow even at the clamp's lower bound. Solution:
// measure each .headword after layout and scale its font-size down with
// a binary-search loop until the rendered word fits on a single line
// inside its parent .word-header (minus the audio button's footprint).
// Re-runs on window resize so the type stays fitted at every column width.
function fitHeadwords(root) {
  const heads = (root || document).querySelectorAll(".word-card .word-header .headword");
  heads.forEach((el) => {
    // Available width = parent .headword-row's content box minus the
    // audio button and the row's gap. Measure once, then loop.
    const row = el.parentElement;
    if (!row) return;
    const rowWidth = row.getBoundingClientRect().width;
    const btn = row.querySelector(".audio-btn");
    const gap = parseFloat(getComputedStyle(row).gap) || 0;
    const btnWidth = btn ? btn.getBoundingClientRect().width : 0;
    const available = Math.max(80, rowWidth - btnWidth - gap - 4);
    // Start from the CSS-computed font-size (the clamp() upper bound on
    // wide viewports, or whatever the cascade gave us).
    const cs = getComputedStyle(el);
    let max = parseFloat(cs.fontSize) || 72;
    let min = 18; // hard floor — don't make a headword smaller than this
    // If the word already fits at the current size, leave it.
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";
    if (el.scrollWidth <= available) {
      el.style.whiteSpace = "";
      el.style.overflow = "";
      return;
    }
    // Binary search downward for the largest font-size that fits.
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

// Run fitHeadwords on resize, debounced. Single global listener.
if (!window.__headwordFitWired) {
  window.__headwordFitWired = true;
  let __fitT = null;
  window.addEventListener("resize", () => {
    clearTimeout(__fitT);
    __fitT = setTimeout(() => fitHeadwords(), 120);
  }, { passive: true });
}

// Wire the Greek/English/Both view-toggle in the In Literature citation
// section (one per language section). Each section has a [data-seg] div
// with three <button data-view="greek|english|both">; clicking sets the
// active class and adds matching class to the sibling [data-cit-body].
// Lazy-load the journal modal (HTML + JS) on first "Open in journal" click.
// The CSS is preloaded via <link> in index.html; the markup + behaviour
// arrive only when needed.
let __journalLoaded = false;
let __journalLoading = null;
async function ensureJournalLoaded() {
  if (__journalLoaded) return;
  if (__journalLoading) return __journalLoading;
  __journalLoading = (async () => {
    try {
      const mount = document.getElementById('journal-modal-mount');
      if (!mount) return;
      // Inject the modal HTML
      const r = await fetch(`${BASE}/journal-modal.html?v=1779328917`);
      if (!r.ok) throw new Error('journal-modal.html fetch failed: ' + r.status);
      mount.innerHTML = await r.text();
      // Load the modal JS (an IIFE that wires up its own listeners)
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

// Build the journal-modal ENTRY payload from the cached today.json data for a
// given language. Splits usage_example on em/en/hyphen dashes (same logic as
// the In Literature renderer). Returns null if data isn't loaded yet.
function buildJournalEntry(langKey) {
  const issue = window.__paideiaToday;
  if (!issue || !issue.languages || !issue.languages[langKey]) return null;
  const entry = issue.languages[langKey];
  const meta = LANG_META[langKey] || {};
  // Split usage_example into original / english if present
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
  const today = issue.date || new Date().toISOString().slice(0,10);
  const dateObj = new Date(today);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  const prettyDate = `${monthName} ${day}, ${year}`;
  // Issue number from issueLines if available
  let issueNum = '';
  try {
    const lines = (typeof issueLines === 'function') ? issueLines(today) : null;
    if (lines && lines.issue) issueNum = String(lines.issue).replace(/[^\d]/g, '');
  } catch {}
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
    issueNumber: issueNum,
    dailyPractice: entry.daily_practice || (typeof PRACTICE_SEED !== 'undefined' ? (PRACTICE_SEED[langKey] || '') : ''),
    storageKey: `kp-journal-${today}-${langKey}`,
  };
}

function wireOpenJournal() {
  // Delegate from document so the handler covers buttons added by future
  // section re-renders too. Idempotent: only attaches once.
  if (document.__journalDelegateWired) return;
  document.__journalDelegateWired = true;
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-open-journal]');
    if (!btn) return;
    e.preventDefault();
    const langKey = btn.getAttribute('data-lang') || 'greek';
    await ensureJournalLoaded();
    if (typeof window.__paideiaOpenJournal === 'function') {
      const entryPayload = buildJournalEntry(langKey);
      if (entryPayload) {
        window.__paideiaOpenJournal(entryPayload);
      } else {
        // Data not loaded yet — open with whatever the modal already has
        window.__paideiaOpenJournal();
      }
    } else {
      const overlay = document.getElementById('kp-journal');
      if (overlay) overlay.classList.add('open');
    }
  });
}

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

function wireAudio() {
  document.querySelectorAll(".audio-btn").forEach((btn) => {
    if (btn.dataset.wired === "1") return; // already wired
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const src = btn.dataset.audio;
      if (!src) return;
      if (window.Analytics) {
        // The audio src looks like /paideia/word-audio/<lang>/<word>.mp3 or
        // /paideia/audio/<date>/<lang>.mp3 — strip the lang+word from it.
        const m = src.match(/\/(word-audio|audio)\/([^/]+)\/([^/?]+)\.mp3/);
        window.Analytics.track('word_audio_play', {
          source: src,
          lang: m ? (m[1] === 'word-audio' ? m[2] : null) : null,
          word: m && m[1] === 'word-audio' ? decodeURIComponent(m[3].replace(/\.mp3$/, '')) : null,
          date_or_lang: m && m[1] === 'audio' ? m[3] : null,
        });
      }
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
    // Per Jae 2026-05-12: fetch live akousma cover data FIRST so when
    // renderAkousmaCard() runs it pulls covers from library-meta.json
    // via /api/akousma/cards, not from the stale hardcoded fallback.
    if (typeof fetchAkousmaCards === "function") {
      await fetchAkousmaCards();
    }

    const res = await fetch(`${BASE}/api/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const issue = await res.json();
    // Cache for the journal modal — when the user clicks "Open in journal"
    // on a specific language section, we look up that language here so the
    // modal opens with the correct headword / definitions / citation.
    window.__paideiaToday = issue;

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
    wireCitationToggles();
    wireOpenJournal();
    fitHeadwords();
    fetchAkousmaCount();

    // Analytics: emit one word_seen per language card on initial render.
    // Anonymous + opted-out users get no-op'd inside Analytics.track().
    if (window.Analytics) {
      LANG_ORDER
        .filter((k) => issue.languages?.[k])
        .forEach((k) => {
          const e = issue.languages[k];
          window.Analytics.track('word_seen', {
            lang: k,
            word: e?.word || null,
            date: issue.date,
            archive: false,
          });
        });
    }
    
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
  
  // Re-wire audio buttons and citation toggles (idempotent — both attach
  // a wired-flag so duplicates don't fire)
  wireAudio();
  wireCitationToggles();
  wireOpenJournal();
  fitHeadwords();
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
