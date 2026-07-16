// journal-modal.js — extracted from paideia-prototype-v2/index.html lines 1760-2179 (Claude Design)
(function(){
  // ============================================================
  // Journal modal logic — Claude Design handoff
  // ============================================================

  // Insertable content from the day's entry. Originally hardcoded to
  // θυμός (the prototype's demo word). Now MUTABLE — app.js calls
  // window.__paideiaSetJournalEntry({ ... }) with the language the user
  // clicked on, replacing the headword, definitions, citation, and use
  // example with that language's data from /api/today.
  let ENTRY = {
    headword: { gl: 'θυμός', tr: 'thymos' },
    shades: [
      { n: 'i.',  head: 'Breath. Spirit. Life.',                       body: 'The warm, animating principle that flares and subsides within the breast.' },
      { n: 'ii.', head: 'Seat of strong feeling.',                     body: 'The chamber in which anger, courage, longing, and grief are kindled.' },
      { n: 'iii.',head: 'Will. Desire. Impulse.',                      body: 'That from which action springs — what bids a person to go, to stay, to speak.' },
      { n: 'iv.', head: '(Later) The spirited part of the soul.',      body: 'In Plato\u2019s Republic, the middle horse of the soul — between reason and appetite.' },
    ],
    citation: {
      source: 'Homer · Iliad I. 192–194',
      greek: 'ἧος ὁ ταῦθ᾽ ὥρμαινε κατὰ φρένα καὶ κατὰ θῡμόν,\nἕλκετο δ᾽ ἐκ κολεοῖο μέγα ξίφος, ἦλθε δ᾽ Ἀθήνη\nοὐρανόθεν· πρὸ γὰρ ἧκε θεὰ λευκώλενος Ἕρη.',
      english: 'While he was turning these things over in his mind and in his thymós,\nand drawing the great sword from its sheath, Athena came down\nfrom heaven — for white-armed Hera had sent her forth.',
    },
    use: {
      greek: 'μένος καὶ θυμὸν ἐνὶ στήθεσσιν ἔχοντες.',
      english: 'Having might and spirited courage in their breasts.',
      source: 'Homer, Iliad',
    },
  };

  const TAG_GROUPS = [
    { id: 'mood',   label: 'MOOD',   options: ['calm','agitated','longing','hopeful','restless','melancholic','contemplative','joyful'] },
    { id: 'place',  label: 'PLACE',  options: ['at home','train','café','library','park','garden','kitchen','study'] },
    { id: 'source', label: 'SOURCE', options: ['morning','afternoon','evening','dream','memory','conversation','reading'] },
  ];

  const JOURNAL_PAST = [
    { issue:138, date:'May 18', lang:'Latin',        word:'fūror',     excerpt:'Furor sits behind the breastbone. When it climbs, it climbs without warning — yesterday a small thing started it; today it has burnt itself out and I am tired, but lighter. The Romans were right about the storm and the wreckage that follows.', minutes:6 },
    { issue:137, date:'May 17', lang:'Greek',        word:'ψυχή',       excerpt:'I sat with the word on the train, watching my breath leave the window as a small fog. The cold breath, Homer says, that goes out at death. I am still warm.', minutes:4 },
    { issue:136, date:'May 16', lang:'Latin',        word:'sapientia',   excerpt:'Wisdom not as facts but as a relation to time. To know the day, to sit with it.', minutes:3 },
    { issue:135, date:'May 15', lang:'German',       word:'Sehnsucht',   excerpt:'Hard to write about a German word in English. The longing without an object — for a country one has not yet seen.', minutes:7 },
    { issue:134, date:'May 14', lang:'Olde English', word:'wyrd',        excerpt:'Fate or weave. The thread of the day that is being made by what I do in it. I noticed today I was already weaving when I thought I was choosing.', minutes:5 },
    { issue:133, date:'May 13', lang:'French',       word:'flâner',      excerpt:'To wander without purpose is its own purpose. The afternoon was kind to me; the city did not ask where I was going.', minutes:5 },
  ];

  // Storage key is per-(date,lang) so each language's draft is independent.
  // app.js calls __paideiaSetJournalEntry({storageKey: 'kp-journal-2026-05-21-latin'}).
  let STORAGE_KEY_DYNAMIC = 'kp-journal-default';

  // ---- helpers ----
  function sanitize(html) {
    if (!html) return '';
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
  function timeAgo(ts) {
    if (!ts) return 'not yet saved';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'saved just now';
    if (s < 60) return 'saved ' + s + 's ago';
    if (s < 3600) return 'saved ' + Math.floor(s/60) + ' min ago';
    return 'saved ' + new Date(ts).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  }

  // ---- DOM refs ----
  const overlay     = document.getElementById('kp-journal');
  const trigger     = document.getElementById('open-journal');
  const backdrop    = document.getElementById('kp-journal-backdrop');
  const closeBtn    = document.getElementById('kp-journal-close');
  const cancelBtn   = document.getElementById('kp-cancel');
  const saveBtn     = document.getElementById('kp-save');
  const editor      = document.getElementById('kp-editor');
  const savedot     = document.getElementById('kp-savedot');
  const savedtxt    = document.getElementById('kp-savedtxt');
  const countsEl    = document.getElementById('kp-counts');
  const tagsRoot    = document.getElementById('kp-tags');
  const pastList    = document.getElementById('kp-pastlist');
  const toast       = document.getElementById('kp-toast');
  const shadeToggle = document.getElementById('kp-shade-toggle');
  const shadeMenu   = document.getElementById('kp-shade-menu');

  // ---- state ----
  let tags = { mood:[], place:[], source:[], custom:[] };
  let savedAt = null;
  let savedRange = null;
  let debounceTimer = null;
  let tickTimer = null;

  // ---- Build tags UI ----
  function renderTags() {
    tagsRoot.innerHTML = '';
    TAG_GROUPS.forEach(g => {
      const row = document.createElement('div');
      row.className = 'kp-tagrow';
      row.innerHTML = '<div class="kp-smallcaps" style="color:var(--ink-3); letter-spacing:.28em; width:60px; flex:0 0 auto; font-size:10px">' + g.label + '</div>';
      const chips = document.createElement('div');
      chips.className = 'kp-tagchips';
      g.options.forEach(o => {
        const b = document.createElement('button');
        b.className = 'kp-tag' + (tags[g.id].includes(o) ? ' on' : '');
        b.textContent = o;
        b.addEventListener('click', () => {
          if (tags[g.id].includes(o)) tags[g.id] = tags[g.id].filter(x => x !== o);
          else tags[g.id] = tags[g.id].concat(o);
          renderTags();
          saveNow();
        });
        chips.appendChild(b);
      });
      row.appendChild(chips);
      tagsRoot.appendChild(row);
    });
    // Custom row
    const customRow = document.createElement('div');
    customRow.className = 'kp-tagrow';
    customRow.innerHTML = '<div class="kp-smallcaps" style="color:var(--ink-3); letter-spacing:.28em; width:60px; flex:0 0 auto; font-size:10px">CUSTOM</div>';
    const customChips = document.createElement('div');
    customChips.className = 'kp-tagchips';
    tags.custom.forEach(t => {
      const pill = document.createElement('span');
      pill.className = 'kp-tag on';
      pill.style.paddingRight = '6px';
      pill.textContent = '#' + t;
      const x = document.createElement('button');
      x.setAttribute('aria-label', 'Remove ' + t);
      x.style.cssText = 'appearance:none; background:transparent; border:0; color:inherit; cursor:pointer; padding:0; margin-left:6px; opacity:.6';
      x.textContent = '×';
      x.addEventListener('click', () => {
        tags.custom = tags.custom.filter(v => v !== t);
        renderTags(); saveNow();
      });
      pill.appendChild(x);
      customChips.appendChild(pill);
    });
    const form = document.createElement('form');
    form.style.display = 'inline-flex';
    const input = document.createElement('input');
    input.className = 'kp-taginput';
    input.placeholder = '+ add tag';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim().replace(/^#+/, '');
      if (!v || tags.custom.includes(v)) { input.value = ''; return; }
      tags.custom = tags.custom.concat(v);
      input.value = '';
      renderTags(); saveNow();
    });
    form.appendChild(input);
    customChips.appendChild(form);
    customRow.appendChild(customChips);
    tagsRoot.appendChild(customRow);
  }

  // ---- Past entries ----
  function renderPast() {
    pastList.innerHTML = '';
    JOURNAL_PAST.forEach(e => {
      const art = document.createElement('article');
      art.className = 'kp-journal-pastitem';
      const excerpt = e.excerpt.length > 200 ? e.excerpt.slice(0, 200).trim() + '…' : e.excerpt;
      art.innerHTML =
        '<div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px">' +
          '<div class="kp-smallcaps" style="color:var(--ink-3); letter-spacing:.28em">' + e.date.toUpperCase() + ' · Nº <span class="lining">' + e.issue + '</span></div>' +
          '<div style="font-family:var(--body); font-style:italic; font-size:11.5px; color:var(--ink-3)">' + e.minutes + ' min</div>' +
        '</div>' +
        '<div style="font-family:var(--display); font-size:22px; color:var(--ink); margin-top:4px">' +
          e.word + ' &nbsp;<span style="font-style:italic; font-size:13px; color:var(--ink-3)">· ' + e.lang.toLowerCase() + '</span>' +
        '</div>' +
        '<p style="font-family:var(--body); font-size:13.5px; line-height:1.55; color:var(--ink-2); margin:8px 0 0">' + excerpt + '</p>';
      pastList.appendChild(art);
    });
    const viewAll = document.createElement('a');
    viewAll.href = './commonplace.html';
    viewAll.className = 'kp-journal-viewall';
    viewAll.innerHTML = '<span class="kp-smallcaps">VIEW ALL · 27 ENTRIES →</span>';
    pastList.appendChild(viewAll);
  }

  // ---- Shade menu ----
  function buildShadeMenu() {
    shadeMenu.innerHTML = '';
    ENTRY.shades.forEach((sh, i) => {
      const b = document.createElement('button');
      b.className = 'kp-shade-item';
      b.innerHTML =
        '<span style="font-family:var(--display); font-style:italic; color:var(--gilt); min-width:24px">' + sh.n + '</span>' +
        '<span style="font-family:var(--body); color:var(--ink)">' + sh.head + '</span>';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        insertHTML('<p><span class="kp-ins-sense">' + sh.n + '</span> <strong>' + sh.head + '</strong> ' + sh.body + '</p>');
        shadeMenu.style.display = 'none';
      });
      shadeMenu.appendChild(b);
    });
  }

  // ---- Selection range capture/restore ----
  function captureRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreRange() {
    editor.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    } else {
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  // ---- Editor commands ----
  function exec(cmd, arg) {
    restoreRange();
    document.execCommand(cmd, false, arg);
    captureRange();
    onInput();
  }
  function applyDropCap() {
    restoreRange();
    // remove existing dropcap first
    editor.querySelectorAll('.kp-dropcap').forEach(s => {
      const t = document.createTextNode(s.textContent);
      s.parentNode.replaceChild(t, s);
    });
    editor.normalize();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.trim()) break;
    }
    if (!n) return;
    const v = n.nodeValue;
    const lead = v.match(/^\s*/)[0];
    const first = v[lead.length];
    const rest = v.slice(lead.length + 1);
    const span = document.createElement('span');
    span.className = 'kp-dropcap';
    span.textContent = first;
    const before = document.createTextNode(lead);
    const after  = document.createTextNode(rest);
    const p = n.parentNode;
    p.insertBefore(before, n);
    p.insertBefore(span, n);
    p.insertBefore(after, n);
    p.removeChild(n);
    captureRange();
    onInput();
  }
  function insertHTML(html) {
    restoreRange();
    document.execCommand('insertHTML', false, html);
    captureRange();
    onInput();
  }
  function insertHeadword() {
    insertHTML('<span class="kp-ins-word"><em>' + ENTRY.headword.gl + '</em> <span class="kp-ins-tr">(' + ENTRY.headword.tr + ')</span></span> ');
  }
  function insertCitation() {
    const c = ENTRY.citation;
    insertHTML(
      '<blockquote class="kp-ins-quote">' +
        '<div class="kp-ins-greek">' + c.greek.replace(/\n/g, '<br/>') + '</div>' +
        '<div class="kp-ins-eng">' + c.english.replace(/\n/g, '<br/>') + '</div>' +
        '<div class="kp-ins-src">' + c.source + '</div>' +
      '</blockquote><p><br/></p>'
    );
  }
  function insertUse() {
    const u = ENTRY.use;
    insertHTML(
      '<blockquote class="kp-ins-quote">' +
        '<div class="kp-ins-greek">' + u.greek + '</div>' +
        '<div class="kp-ins-eng">“' + u.english + '”</div>' +
        '<div class="kp-ins-src">' + u.source + '</div>' +
      '</blockquote><p><br/></p>'
    );
  }

  // ---- Save / autosave ----
  function updateCounts() {
    const text = (editor.innerText || '').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    const chars = (editor.innerText || '').length;
    countsEl.textContent = words === 0
      ? 'begin where you are'
      : words + ' word' + (words === 1 ? '' : 's') + ' · ' + chars + ' char' + (chars === 1 ? '' : 's');
  }
  function saveNow() {
    const html = sanitize(editor.innerHTML || '');
    const ts = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY_DYNAMIC, JSON.stringify({ html: html, tags: tags, savedAt: ts }));
    } catch (e) {}
    savedAt = ts;
    savedot.classList.add('saved');
    savedtxt.textContent = timeAgo(ts);
    return ts;
  }
  function onInput() {
    updateCounts();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveNow, 700);
  }
  function flashToast() {
    toast.style.display = 'inline-flex';
    setTimeout(() => { toast.style.display = 'none'; }, 1600);
  }

  // ---- Open / close ----
  function openJournal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Load draft
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DYNAMIC);
      if (raw) {
        const o = JSON.parse(raw);
        editor.innerHTML = sanitize(o.html || '');
        savedAt = o.savedAt || null;
        tags = o.tags || { mood:[], place:[], source:[], custom:[] };
        if (savedAt) {
          savedot.classList.add('saved');
          savedtxt.textContent = timeAgo(savedAt);
        }
      } else {
        editor.innerHTML = '';
        tags = { mood:[], place:[], source:[], custom:[] };
      }
    } catch (e) {}
    renderTags();
    updateCounts();
    // Focus editor + cursor to end
    setTimeout(() => {
      editor.focus();
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      captureRange();
    }, 260);
    // tick relative time
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { if (savedAt) savedtxt.textContent = timeAgo(savedAt); }, 10000);
  }
  function closeJournal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    clearInterval(tickTimer);
    shadeMenu.style.display = 'none';
  }

  // ---- Wire everything ----
  // Per app.js: the live site has many .open-journal-btn / [data-open-journal]
  // elements (one per language section), and app.js delegates the click
  // handler globally to lazy-load this modal. We just need openJournal()
  // to exist on a global so app.js can call it. The original prototype
  // hard-coded a single #open-journal trigger.
  if (trigger) trigger.addEventListener('click', (e) => { e.preventDefault(); openJournal(); });

  // Exposed for app.js: open the journal for a specific language. app.js
  // passes the langKey + the full entry data; we rebuild ENTRY, refresh
  // the shade menu, update the modal header strings, then open.
  window.__paideiaOpenJournal = function(opts) {
    if (opts && typeof opts === 'object') {
      window.__paideiaSetJournalEntry(opts);
    }
    openJournal();
  };

  // Called from app.js. opts = {
  //   langName,        // e.g. "Greek", "Latin"
  //   word,            // headword in original script
  //   transliteration, // optional
  //   meaning,         // short gloss (used in shade menu fallback)
  //   definition_shades, // [{head, body}, ...]  (v2 schema; optional)
  //   citation,        // {source, original, english} (v2 schema; optional)
  //   usage_original,  // "original sentence" of usage_example
  //   usage_english,   // English half of usage_example
  //   issueDate,       // ISO date or pretty-string for header
  //   issueNumber,     // current issue number for header
  //   storageKey,      // unique local-storage key per (date, lang)
  //   dailyPractice,   // override prompt copy
  // }
  window.__paideiaSetJournalEntry = function(opts) {
    opts = opts || {};
    ENTRY = {
      headword: { gl: opts.word || '', tr: opts.transliteration || '' },
      shades: Array.isArray(opts.definition_shades) && opts.definition_shades.length
        ? opts.definition_shades.slice(0, 4).map((s, i) => ({
            n: ['i.', 'ii.', 'iii.', 'iv.'][i] || ((i + 1) + '.'),
            head: (s.head || '').trim(),
            body: (s.body || '').trim(),
          }))
        : (opts.meaning ? [{ n: 'i.', head: opts.meaning, body: '' }] : []),
      citation: opts.citation && opts.citation.original
        ? {
            source: opts.citation.source || '',
            greek: opts.citation.original || '',
            english: opts.citation.english || '',
          }
        : (opts.usage_original
            ? { source: '', greek: opts.usage_original || '', english: opts.usage_english || '' }
            : { source: '', greek: '', english: '' }),
      use: {
        greek: opts.usage_original || '',
        english: opts.usage_english || '',
        source: opts.langName || '',
      },
    };
    // Per-(date, lang) draft storage so switching languages doesn't clobber
    if (opts.storageKey) STORAGE_KEY_DYNAMIC = opts.storageKey;

    // Re-render the shade menu (it pulls from ENTRY.shades each open)
    try { buildShadeMenu(); } catch (e) { console.warn('[journal] buildShadeMenu', e); }

    // Update the modal header: issue number, date, prompt copy
    try {
      const headerEntry = overlay.querySelector('.kp-journal-header .lining');
      if (headerEntry && opts.issueNumber) headerEntry.textContent = String(opts.issueNumber);
      // The date is the SECOND .lining span inside the header
      const linings = overlay.querySelectorAll('.kp-journal-header .lining');
      if (linings && linings.length >= 2 && opts.issueDate) linings[1].textContent = opts.issueDate;
      // Update the prompt copy and the language label inside the prompt
      const promptEl = overlay.querySelector('.kp-journal-write p');
      if (promptEl && opts.dailyPractice) promptEl.textContent = opts.dailyPractice;
      // Sub-header next to entry number: change "Tuesday" to the right weekday
      // (best effort; non-critical if format differs)
    } catch (e) { console.warn('[journal] header update', e); }
  };
  backdrop.addEventListener('click', closeJournal);
  closeBtn.addEventListener('click', closeJournal);
  cancelBtn.addEventListener('click', closeJournal);
  saveBtn.addEventListener('click', () => { saveNow(); flashToast(); });

  editor.addEventListener('input', onInput);
  editor.addEventListener('blur', captureRange);
  editor.addEventListener('keyup', captureRange);
  editor.addEventListener('mouseup', captureRange);

  // Toolbar buttons
  document.querySelectorAll('.kp-tbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'italic')     exec('italic');
      else if (cmd === 'blockquote') exec('formatBlock', '<blockquote>');
      else if (cmd === 'dropcap')    applyDropCap();
    });
  });

  // Insert chips
  document.querySelectorAll('.kp-chip[data-ins]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.ins;
      if (k === 'headword')      insertHeadword();
      else if (k === 'use')      insertUse();
      else if (k === 'citation') insertCitation();
    });
  });

  // Definition popover
  shadeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    shadeMenu.style.display = shadeMenu.style.display === 'none' ? 'flex' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!shadeMenu.contains(e.target) && e.target !== shadeToggle) {
      shadeMenu.style.display = 'none';
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { closeJournal(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); saveNow(); flashToast();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault(); exec('italic');
    }
  });

  // Initial UI build
  buildShadeMenu();
  renderPast();
  renderTags();
})();
