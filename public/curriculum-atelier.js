// curriculum-atelier.js — Production curriculum page renderer.
//
// Pulls /api/curriculum/<lang> + /api/curriculum/<lang>/progress, then
// renders the Atelier design with the per-language painting palette
// defined in PAINTINGS below. Falls open for anonymous users; shows
// a sign-in prompt where progress would go.

const BASE = "/paideia";

// ============================================================
// Per-language painting palette
// Each entry: hero, hero_credit, hero_position, vignettes[1..4], tracks[1..3]
// All paintings are PD, all audited against the paideia-covers safelist.
// ============================================================

const COMMONS = (file, w = 1400) => {
  // Wikimedia Special:FilePath resolver — stable, no hash-guessing.
  const enc = encodeURIComponent(file).replace(/%2F/g, "/").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${enc}?width=${w}`;
};

const PAINTING = {
  school_athens: { file: '"The_School_of_Athens"_by_Raffaello_Sanzio_da_Urbino.jpg', cred: "Raphael, School of Athens (1509–11), Vatican · PD" },
  reading_homer: { file: "Sir_Lawrence_Alma-Tadema,_English_(born_Netherlands)_-_A_Reading_from_Homer_-_Google_Art_Project.jpg", cred: "Alma-Tadema, A Reading from Homer (1885), Philadelphia · PD" },
  greek_girls:   { file: "Greek_Girls_Picking_up_Pebbles_by_the_Sea.jpg", cred: "Leighton, Greek Girls Picking up Pebbles (1871) · PD" },
  odysseus:      { file: "Pinturicchio_-_The_Return_of_Odysseus_-_WGA17830.jpg", cred: "Pinturicchio, The Return of Odysseus (1509), Nat'l Gallery London · PD" },
  cicero:        { file: "Cicerón_denuncia_a_Catilina,_por_Cesare_Maccari.jpg", cred: "Maccari, Cicero Denounces Catiline (1888), Palazzo Madama · PD" },
  sappho_godward:{ file: "Godward-In_the_Days_of_Sappho-1904.jpg", cred: "Godward, In the Days of Sappho (1904), Getty · PD" },
  spring:        { file: "Lawrence_Alma-Tadema_-_Spring_-_Google_Art_Project.jpg", cred: "Alma-Tadema, Spring (1894), Getty · PD" },
  flaming_june:  { file: "Flaming_June,_by_Frederic_Lord_Leighton_(1830-1896).jpg", cred: "Leighton, Flaming June (1895), Ponce · PD" },
  sappho_at:     { file: "Sappho_and_Alcaeus,_by_Lawrence_Alma-Tadema.jpg", cred: "Alma-Tadema, Sappho and Alcaeus (1881), Walters · PD" },
  penelope:      { file: "JohnWilliamWaterhouse-PenelopeandtheSuitors(1912).jpg", cred: "Waterhouse, Penelope and the Suitors (1912), Aberdeen · PD" },
  thoma_sommer:  { file: "Hans_Thoma_-_Sommer_-_Google_Art_Project.jpg", cred: "Thoma, Sommer (1872), Berlin · PD" },
  accolade:      { file: "Edmund_blair_leighton_accolade.jpg", cred: "E. B. Leighton, The Accolade (1901) · PD" },
  dante_beatrice:{ file: "Henry_Holiday_-_Dante_and_Beatrice_-_Google_Art_Project.jpg", cred: "Holiday, Dante and Beatrice (1883), Walker · PD" },
  echo_narcissus:{ file: "John_William_Waterhouse_-_Echo_and_Narcissus_-_Google_Art_Project.jpg", cred: "Waterhouse, Echo and Narcissus (1903), Walker · PD" },
  primavera:     { file: "Sandro_Botticelli_-_La_Primavera_-_Google_Art_Project.jpg", cred: "Botticelli, La Primavera (c.1480), Uffizi · PD" },
  coronation:    { file: "Jacques-Louis_David_-_The_Coronation_of_Napoleon_(1805-1807).jpg", cred: "David, The Coronation of Napoleon (1807), Louvre · PD" },
  cot_spring:    { file: "1873_Pierre_Auguste_Cot_-_Spring.jpg", cred: "Cot, Le Printemps (1873), Metropolitan Museum of Art · PD" },
  renoir_luncheon:{ file: "Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg", cred: "Renoir, Luncheon of the Boating Party (1881), Phillips Collection · PD" },
  tres_riches_may:{ file: "Frères_Limbourg_-_Très_Riches_Heures_du_duc_de_Berry_-_mois_de_mai_-_Google_Art_Project.jpg", cred: "Limbourg Brothers, Très Riches Heures du Duc de Berry, May (c.1412), Musée Condé · PD" },
  norwegian_fjord:{ file: "Hans_Andreas_Dahl_-_Norwegian_Fjord_-_1916.26.1_-_Reading_Public_Museum.jpg", cred: "H. A. Dahl, Norwegian Fjord (1916), Reading Public Museum · PD" },
};

function img(key, w = 1400) {
  const p = PAINTING[key];
  if (!p) return "";
  return `url("${COMMONS(p.file, w)}")`;
}

const LANG_PALETTE = {
  greek: {
    title: "The Greek Course",
    eyebrow: "Classical Greek",
    greek: "ἑλληνικὴ παιδεία",
    hero: { key: "school_athens", w: 2400, pos: "center 32%" },
    vignettes: { 1: "greek_girls", 2: "reading_homer", 3: "odysseus", 4: "cicero" },
    tracks: { 1: { key: "school_athens", pos: "28% 40%" }, 2: { key: "odysseus", pos: "center" }, 3: { key: "cicero", pos: "center" } },
  },
  latin: {
    title: "The Latin Course",
    eyebrow: "Classical Latin",
    greek: "lingua Latina",
    hero: { key: "cicero", w: 2000, pos: "center 30%" },
    vignettes: { 1: "spring", 2: "reading_homer", 3: "school_athens", 4: "cicero" },
    tracks: { 1: { key: "cicero", pos: "center" }, 2: { key: "school_athens", pos: "60% 40%" }, 3: { key: "spring", pos: "center" } },
  },
  french: {
    title: "The French Course",
    eyebrow: "Classical Literary French",
    greek: "lettres classiques françaises",
    // Hero: Limbourg Brothers, Très Riches Heures du Duc de Berry, the May
    // folio (c.1412, Musée Condé). The supreme Pre-Renaissance French
    // painting — lapis-blue sky, gold leaf, jewel-tone courtly procession,
    // castle skyline. Anchor the crop low (center 70%) to drop the
    // zodiac arch off the top and keep the riders, castle, and lawn.
    // Vision-audited PASS on all seven standing rules.
    hero: { key: "tres_riches_may", w: 2000, pos: "center 70%" },
    vignettes: { 1: "tres_riches_may", 2: "dante_beatrice", 3: "cot_spring", 4: "primavera" },
    tracks: { 1: { key: "dante_beatrice", pos: "center" }, 2: { key: "tres_riches_may", pos: "center 70%" }, 3: { key: "flaming_june", pos: "center" } },
  },
  german: {
    title: "The German Course",
    eyebrow: "Classical Literary German",
    greek: "klassische deutsche Literatur",
    hero: { key: "thoma_sommer", w: 1800, pos: "center 35%" },
    vignettes: { 1: "thoma_sommer", 2: "primavera", 3: "norwegian_fjord", 4: "accolade" },
    tracks: { 1: { key: "thoma_sommer", pos: "center" }, 2: { key: "school_athens", pos: "28% 40%" }, 3: { key: "norwegian_fjord", pos: "center" } },
  },
  italian: {
    title: "The Italian Course",
    eyebrow: "Classical Literary Italian",
    greek: "letteratura classica italiana",
    hero: { key: "primavera", w: 2000, pos: "center 40%" },
    vignettes: { 1: "primavera", 2: "dante_beatrice", 3: "odysseus", 4: "cicero" },
    tracks: { 1: { key: "dante_beatrice", pos: "center" }, 2: { key: "primavera", pos: "center" }, 3: { key: "cicero", pos: "center" } },
  },
  oldenglish: {
    title: "The Old English Course",
    eyebrow: "Anglo-Saxon",
    greek: "Englisc ealdgesegen",
    hero: { key: "accolade", w: 1800, pos: "center 25%" },
    vignettes: { 1: "accolade", 2: "flaming_june", 3: "norwegian_fjord", 4: "echo_narcissus" },
    tracks: { 1: { key: "accolade", pos: "center" }, 2: { key: "accolade", pos: "center" }, 3: { key: "accolade", pos: "center" } },
  },
  middleenglish: {
    title: "The Middle English Course",
    eyebrow: "Middle English",
    greek: "the speche of Chaucer",
    hero: { key: "penelope", w: 1800, pos: "center 30%" },
    vignettes: { 1: "penelope", 2: "accolade", 3: "dante_beatrice", 4: "flaming_june" },
    tracks: { 1: { key: "penelope", pos: "center" }, 2: { key: "accolade", pos: "center" }, 3: { key: "dante_beatrice", pos: "center" } },
  },
  oldnorse: {
    title: "The Old Norse Course",
    eyebrow: "Old Icelandic",
    greek: "norrœnt mál",
    hero: { key: "norwegian_fjord", w: 1800, pos: "center 50%" },
    vignettes: { 1: "norwegian_fjord", 2: "accolade", 3: "echo_narcissus", 4: "flaming_june" },
    tracks: { 1: { key: "norwegian_fjord", pos: "center" }, 2: { key: "norwegian_fjord", pos: "center" }, 3: { key: "accolade", pos: "center" } },
  },
  welsh: {
    title: "The Welsh Course",
    eyebrow: "Middle Welsh",
    greek: "Cymraeg Canol",
    hero: { key: "echo_narcissus", w: 1800, pos: "center 30%" },
    vignettes: { 1: "echo_narcissus", 2: "flaming_june", 3: "accolade", 4: "dante_beatrice" },
    tracks: { 1: { key: "echo_narcissus", pos: "center" }, 2: { key: "echo_narcissus", pos: "center" }, 3: { key: "echo_narcissus", pos: "center" } },
  },
  gaulish: {
    title: "The Gaulish Course",
    eyebrow: "Reading Gaulish Epigraphy",
    greek: "lingua Gallica",
    hero: { key: "spring", w: 1800, pos: "center 28%" },
    vignettes: { 1: "spring", 2: "cicero", 3: "school_athens", 4: "school_athens" },
    tracks: { 1: { key: "spring", pos: "center" }, 2: { key: "cicero", pos: "center" }, 3: { key: "school_athens", pos: "28% 40%" } },
  },
};

// ============================================================
// Utilities
// ============================================================

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}


// ============================================================
// Path helper
// ============================================================
function getLangFromPath() {
  // Check for ?lang= query parameter first
  const params = new URLSearchParams(location.search);
  const langParam = params.get('lang');
  if (langParam) return langParam;
  
  // Fall back to path-based detection
  const parts = location.pathname.split("/").filter(Boolean);
  const candidate = parts[1];
  
  // If parts[1] is a file (like "curriculum.html"), not a language, default to greek
  if (!candidate || candidate.includes('.')) return "greek";
  
  return candidate;
}

// ============================================================
// Palette — drives hero painting, stage vignettes, capstone tracks
// ============================================================
function applyPalette(lang) {
  const p = LANG_PALETTE[lang] || LANG_PALETTE.greek;
  const root = document.documentElement;
  const heroP = PAINTING[p.hero.key];
  if (heroP) {
    root.style.setProperty("--hero-img", `url("${COMMONS(heroP.file, p.hero.w || 2000)}")`);
    const heroEl = document.getElementById("hero");
    if (heroEl) heroEl.style.setProperty("--hero-pos", p.hero.pos || "center 32%");
    const cred = document.getElementById("hero-credit");
    if (cred) cred.innerHTML = heroP.cred;
  }
  document.getElementById("hero-lang").textContent = p.eyebrow;
  document.getElementById("hero-greek").textContent = p.greek;
  document.getElementById("hero-title").textContent = p.title;
  const dg = document.getElementById("diploma-greek");
  if (dg) dg.textContent = p.greek;
  document.body.dataset.lang = lang;
  document.title = `${p.title} — Kalopaideia`;
  // Stage vignettes — backgrounds for each stage card
  for (let i = 1; i <= 4; i++) {
    if (p.vignettes && p.vignettes[i]) {
      root.style.setProperty(`--vig-${i}`, img(p.vignettes[i]));
    }
  }
  // Capstone portraits
  for (let i = 1; i <= 3; i++) {
    if (p.tracks && p.tracks[i]) {
      const t = p.tracks[i];
      root.style.setProperty(`--tk-${i}`, img(t.key));
      root.style.setProperty(`--tk-${i}-pos`, t.pos || "center");
    }
  }
  return p;
}

// ============================================================
// Renderers (v2 — matches paideia-prototype-v2/curriculum.html structure)
// ============================================================

function renderMetaStrip(manifest) {
  const stages = manifest.stages || [];
  const totalLessons = stages.reduce((n, s) => n + (s.lessons?.length || 0), 0);
  const checkpoints = stages.filter((s) => s.checkpoint).length;
  const duration = manifest.duration_estimate || "12–18 months";
  document.getElementById("meta-strip").innerHTML = `
    <div class="meta-cell">
      <div class="sc">DURATION</div>
      <div class="val">${esc(duration)}</div>
    </div>
    <div class="meta-cell">
      <div class="sc">EFFORT</div>
      <div class="val">1 hour / day</div>
    </div>
    <div class="meta-cell">
      <div class="sc">LESSONS</div>
      <div class="val">${totalLessons} · ${checkpoints || 4} checkpoints</div>
    </div>
    <div class="meta-cell">
      <div class="sc">CAPSTONE</div>
      <div class="val">${manifest.capstone_tracks?.length || 3} tracks</div>
    </div>
  `;
}

function renderPinned(manifest, progress) {
  if (!progress || !progress.next_lesson) {
    // Anonymous user — show "Begin the course" pinned card pointing at lesson 1.1
    const stage1 = (manifest.stages || [])[0];
    if (!stage1) return;
    const lesson1 = (stage1.lessons || [])[0];
    if (!lesson1) return;
    const block = document.getElementById("pinned-block");
    block.style.display = "";
    block.innerHTML = `
      <div>
        <div class="label-row">
          <span class="pulse"></span>
          <span class="sc" style="color:var(--wine); letter-spacing:.32em">BEGIN THE COURSE</span>
        </div>
        <div class="lesson-row">
          <span class="lesson-id">Lesson ${esc(lesson1.id || "I.1")}</span>
          <span class="lesson-title">— ${esc(lesson1.title || "Open the first lesson")}</span>
        </div>
        <div class="meta">
          Stage I · ${esc(stage1.name || "")}
          <span class="sep">·</span>
          ${esc(lesson1.duration_minutes || lesson1.min || 12)} min
          <span class="sep">·</span>
          new student
        </div>
        <div class="mini-bar"><div class="fill" style="width:0%"></div></div>
      </div>
      <div class="actions">
        <a class="btn-primary" href="/paideia/account">SIGN IN TO BEGIN →</a>
      </div>`;
    return;
  }
  const next = progress.next_lesson;
  const stage = (manifest.stages || []).find((s) => (s.lessons || []).some((l) => l.id === next.id));
  const completed = progress.completed_lesson_count || 0;
  const total = (manifest.stages || []).reduce((n, s) => n + (s.lessons?.length || 0), 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const block = document.getElementById("pinned-block");
  block.style.display = "";
  block.innerHTML = `
    <div>
      <div class="label-row">
        <span class="pulse"></span>
        <span class="sc" style="color:var(--wine); letter-spacing:.32em">PICK UP WHERE YOU LEFT OFF</span>
      </div>
      <div class="lesson-row">
        <span class="lesson-id">Lesson ${esc(next.id || "")}</span>
        <span class="lesson-title">— ${esc(next.title || "")}</span>
      </div>
      <div class="meta">
        ${stage ? `Stage ${esc(stage.number || "")} · ${esc(stage.name || "")}` : ""}
        <span class="sep">·</span>
        ${esc(next.duration_minutes || next.min || 12)} min
        <span class="sep">·</span>
        <span class="lining">${completed}</span> of <span class="lining">${total}</span> lessons complete
      </div>
      <div class="mini-bar"><div class="fill" style="width:${pct}%"></div></div>
    </div>
    <div class="actions">
      <a class="btn-primary" href="/paideia/${esc(getLangFromPath())}/curriculum/${esc(next.id || "")}">RESUME LESSON →</a>
    </div>`;
}

function renderArc(manifest, progress) {
  // Matches prototype's .arc structure: connector line + 5 stage nodes + capstone.
  const stages = manifest.stages || [];
  const completed = (progress && progress.completed_lesson_count) || 0;
  const totalLessons = stages.reduce((n, s) => n + (s.lessons?.length || 0), 0);
  // Determine which stage is active
  let activeIdx = -1, cum = 0;
  for (let i = 0; i < stages.length; i++) {
    const sLen = (stages[i].lessons || []).length;
    if (completed >= cum && completed < cum + sLen) { activeIdx = i; break; }
    cum += sLen;
  }
  if (activeIdx === -1 && completed >= totalLessons) activeIdx = stages.length;
  const fillPct = activeIdx <= 0 ? 0 : Math.min(80, (activeIdx / 5) * 80);
  const nodes = stages.slice(0, 5).map((s, i) => {
    const isDone = i < activeIdx;
    const isActive = i === activeIdx;
    const roman = ['i', 'ii', 'iii', 'iv', 'v'][i] || (i + 1);
    return `
      <div class="node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}">
        <div class="circle">${esc(roman)}</div>
        <div class="label">${esc(s.name || `Stage ${i+1}`)}</div>
        <div class="weeks">${esc(s.duration || '')}</div>
      </div>`;
  }).join('');
  // Capstone node (final, gilt)
  const capstoneDone = activeIdx > 5;
  const capstoneNode = `
    <div class="node ${capstoneDone ? 'done' : ''}">
      <div class="circle" style="background:var(--gilt);border-color:var(--gilt);color:var(--bg)">K</div>
      <div class="label"><span class="capstone">Capstone</span></div>
      <div class="weeks">diploma</div>
    </div>`;
  document.getElementById("arc").innerHTML = `
    <div class="connector"></div>
    <div class="connector-fill" style="width:${fillPct}%"></div>
    <div class="row">${nodes}${capstoneNode}</div>`;
}

function renderIntro(manifest, palette) {
  if (!manifest.philosophy) {
    document.getElementById("intro-section").innerHTML = "";
    return;
  }
  const phil = manifest.philosophy.trim();
  const first = phil.charAt(0);
  const rest = phil.slice(1);
  const coverP = PAINTING[(palette.vignettes && palette.vignettes[2]) || palette.hero.key];
  document.getElementById("intro-section").innerHTML = `
    <div class="intro-body">
      <div class="intro-dropcap">${esc(first)}</div>
      <p class="intro-text">${esc(rest)}</p>
    </div>
    ${coverP ? `<figure class="cover-fig">
      <img class="cover-img" src="${COMMONS(coverP.file, 800)}" alt="${esc(coverP.cred)}" loading="lazy" />
      <figcaption class="cover-cap">${coverP.cred}</figcaption>
    </figure>` : ""}
  `;
}

function renderStages(manifest, lang, progress) {
  // Matches the prototype's stage structure: stage-head (roman | title | right meta),
  // stage-summary, stage-progress, stage-grid (lessons table + companion card +
  // cover figure). The lessons table uses .lesson-row with id-cell / title-cell /
  // min-cell that the existing CSS already styles.
  const stages = manifest.stages || [];
  const completedSet = new Set((progress && progress.completed_lessons) || []);
  const totalLessons = stages.reduce((n, s) => n + (s.lessons?.length || 0), 0);
  const completedTotal = (progress && progress.completed_lesson_count) || 0;
  const palette = LANG_PALETTE[lang] || LANG_PALETTE.greek;
  // Find the current stage (first stage with an incomplete lesson)
  let currentStageIdx = stages.length - 1;
  let cumDone = 0;
  for (let i = 0; i < stages.length; i++) {
    const sLen = (stages[i].lessons || []).length;
    if (completedTotal < cumDone + sLen) { currentStageIdx = i; break; }
    cumDone += sLen;
  }

  const romanize = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'];
  const out = stages.map((s, si) => {
    const stageLessons = s.lessons || [];
    const stageLessonCount = stageLessons.length;
    // Lessons completed in this stage
    const stageOffset = stages.slice(0, si).reduce((n, ss) => n + (ss.lessons?.length || 0), 0);
    const completedInStage = stageLessons.filter(l => completedSet.has(l.id)).length;
    const pct = stageLessonCount ? Math.round((completedInStage / stageLessonCount) * 100) : 0;
    const isCurrent = si === currentStageIdx;
    const fillColor = isCurrent ? 'var(--wine)' : (si < currentStageIdx ? 'var(--gilt)' : 'var(--rule)');

    // Lessons table (matches prototype: id-cell, title-cell, min-cell)
    // Now uses <button> for inline toggle preview (ported from prototype v2).
    const lessonsHtml = stageLessons.map((lesson, li) => {
      const isLessonDone = completedSet.has(lesson.id);
      const isLessonCurrent = isCurrent && (li === completedInStage);
      const minutes = lesson.duration_minutes || lesson.min || 12;
      const idIcon = isLessonCurrent
        ? '<span style="color:var(--wine)">▸</span>'
        : isLessonDone
          ? '<span class="marker" style="color:var(--gilt)">✓</span>'
          : '<span style="color:var(--rule)">·</span>';
      const badge = lesson.is_reading || lesson.isReading
        ? ' <span class="badge">READING</span>' : '';
      return `
        <button class="lesson-row ${li === 0 ? 'first' : ''} ${isLessonCurrent ? 'current' : ''}" type="button" data-lesson-toggle="${si}-${li}" data-lesson-id="${esc(lesson.id || '')}" data-lang="${esc(lang)}">
          <span class="id-cell">${idIcon} ${esc(lesson.id || '')}</span>
          <span class="title-cell">${esc(lesson.title || '')}${badge}</span>
          <span class="min-cell">${minutes}</span>
          <span class="toggle">+</span>
        </button>`;
    }).join('');

    // Cover painting for this stage (rotate through the palette vignettes)
    const vigKey = palette.vignettes && palette.vignettes[(si % 4) + 1];
    const vigP = vigKey ? PAINTING[vigKey] : null;
    const coverFig = vigP
      ? `<figure class="cover-fig">
           <img class="cover-img" src="${COMMONS(vigP.file, 800)}" alt="${esc(vigP.cred)}" loading="lazy" />
           <figcaption class="cover-cap">${vigP.cred}</figcaption>
         </figure>`
      : '';

    const weeks = s.duration || `Stage ${s.number || si + 1}`;
    const roman = romanize[si] || `${si + 1}.`;

    return `
      <section class="stage">
        <header class="stage-head">
          <div class="left">
            <span class="roman">§ ${esc(roman)}</span>
            <h2>${esc(s.name || '')}</h2>
          </div>
          <div class="right">
            ${stageLessonCount} lessons <span class="sep">·</span> ${esc(weeks)}
          </div>
        </header>
        <p class="stage-summary">${esc(s.subtitle || '')}</p>
        <div class="stage-progress">
          <span class="label">STAGE PROGRESS</span>
          <div class="bar"><div class="fill" style="width:${pct}%; background:${fillColor}"></div></div>
          <span class="count"><span class="lining">${completedInStage}</span> of <span class="lining">${stageLessonCount}</span></span>
        </div>
        <div class="stage-grid">
          <div>
            <div class="lessons">
              <div class="lessons-head">
                <span class="sc">LESSON</span>
                <span class="sc">TOPIC</span>
                <span class="sc min-col">MIN.</span>
                <span></span>
              </div>
              ${lessonsHtml}
              ${s.checkpoint ? `
                <div class="checkpoint-row">
                  <span class="checkpoint-pill">CHECKPOINT ${esc(s.number || si + 1)}</span>
                  <span class="checkpoint-note">opens upon completion</span>
                  <button class="checkpoint-toggle" type="button" data-cp-toggle="${si}">auto-graded · see sample questions ↗</button>
                </div>
                <div data-checkpoint-preview="${si}"></div>` : ''}
            </div>
          </div>
          ${coverFig}
        </div>
      </section>`;
  }).join('');
  document.getElementById("stages-root").innerHTML = out;
}

function renderCapstone(manifest, lang, palette) {
  const tracks = manifest.capstone_tracks || [];
  const grid = document.getElementById("capstone-grid");
  if (!tracks.length) {
    grid.innerHTML = `
      <div class="capstone-card">
        <div class="capstone-art" style="background-image: var(--tk-1); background-position: var(--tk-1-pos)"></div>
        <div class="capstone-body">
          <h3>The Capstone</h3>
          <p>Final examination on a major author of your choosing. The capstone is set after you pass the four checkpoints.</p>
        </div>
      </div>`;
    return;
  }
  grid.innerHTML = tracks.slice(0, 3).map((t, i) => `
    <div class="capstone-card">
      <div class="capstone-art" style="background-image: var(--tk-${i+1}); background-position: var(--tk-${i+1}-pos)"></div>
      <div class="capstone-body">
        <h3>${esc(t.title || t.name || "Track")}</h3>
        <p>${esc(t.summary || t.description || "")}</p>
        ${t.author ? `<div class="capstone-author">— ${esc(t.author)}</div>` : ""}
      </div>
    </div>`).join('');
}

function renderHorizon(manifest) {
  const grid = document.getElementById("horizon-grid");
  const stages = manifest.stages || [];
  // Pull a sample passage from each stage that has one
  const items = stages.map((s) => {
    const sample = s.horizon_sample || s.reading_sample || "";
    const eng = s.horizon_english || s.reading_english || "";
    if (!sample) return null;
    return { stage: s.number || "?", name: s.name || "", sample, eng };
  }).filter(Boolean);
  if (!items.length) {
    grid.innerHTML = `
      <div class="horizon-card">
        <div class="horizon-stage sc">END OF STAGE I</div>
        <p class="horizon-orig" style="font-style:italic;color:var(--ink-2)">Sample readings appear here as you advance.</p>
      </div>`;
    return;
  }
  grid.innerHTML = items.map((it) => `
    <div class="horizon-card">
      <div class="horizon-stage sc">END OF STAGE ${esc(it.stage)} · ${esc(it.name)}</div>
      <p class="horizon-orig">${esc(it.sample)}</p>
      ${it.eng ? `<p class="horizon-eng">${esc(it.eng)}</p>` : ""}
    </div>`).join('');
}

function fillDiploma(manifest, palette) {
  const cap = (manifest.capstone_tracks && manifest.capstone_tracks[0]) || null;
  const dCap = document.getElementById("diploma-capstone");
  if (dCap && cap) {
    dCap.textContent = cap.title || cap.name || "—";
  } else if (dCap) {
    dCap.textContent = "—";
  }
}

// ============================================================
// Main
// ============================================================
(async function init() {
  const lang = getLangFromPath();
  const palette = applyPalette(lang);

  document.getElementById("hero-sub").textContent = "Loading…";

  let manifest = null;
  let progress = null;
  try {
    const r = await fetch(`${BASE}/api/curriculum/${lang}`);
    if (r.ok) manifest = await r.json();
  } catch {}
  try {
    const r = await fetch(`${BASE}/api/curriculum/${lang}/progress`);
    if (r.ok) progress = await r.json();
  } catch {}

  if (!manifest) {
    document.getElementById("page-main").innerHTML = `
      <div style="text-align:center;padding:80px 24px;font-family:var(--display);font-style:italic;color:var(--ink-2);font-size:20px;">
        <p>The curriculum for this language is in preparation.</p>
        <p style="margin-top:24px"><a href="${BASE}/" style="color:var(--wine);text-decoration:underline">← Back to Kalopaideia</a></p>
      </div>`;
    document.getElementById("hero-sub").textContent = "In preparation.";
    return;
  }

  document.getElementById("hero-sub").textContent = manifest.tagline || "From the beginning to the masters, in five guided stages.";

  renderMetaStrip(manifest);
  renderPinned(manifest, progress);
  renderArc(manifest, progress);
  renderIntro(manifest, palette);
  renderStages(manifest, lang, progress);
  renderCapstone(manifest, lang, palette);
  renderHorizon(manifest);
  fillDiploma(manifest, palette);
  renderAudioTeaser(lang);
  wirePlayPills(document);
  wireLessonToggles(lang, manifest);
  wireCheckpointToggles(lang);
})();

// ===================================================================
// AUDIO TEASER ("Hear the course opening")
// ===================================================================
// Per-language opening passage shown in the hero, ported from
// paideia-prototype-v2/curriculum.html. The play-pill is a visual
// affordance only — a 2.2s animation — until real audio is wired.
//
// COURSE_OPENINGS — the line played by the 'HEAR THE COURSE OPENING'
// teaser pill on each language's curriculum landing page. Each line is
// drawn from a canonical opening of that tradition. The TTS endpoint is
// /api/word-audio/<lang>/<encoded line>.mp3 (Azure Speech, disk-cached).
//
const COURSE_OPENINGS = {
  greek: {
    line: "ἄνδρα μοι ἔννεπε, μοῦσα…",
    caption: "Hear the opening of the Odyssey — read aloud in restored classical pronunciation.",
  },
  latin: {
    line: "Arma virumque canō, Trōiae quī prīmus ab ōrīs…",
    caption: "Hear the opening of the Aeneid — read aloud with restored classical Latin vowels.",
  },
  french: {
    line: "Longtemps, je me suis couché de bonne heure.",
    caption: "Hear the opening line of Proust's À la recherche du temps perdu.",
  },
  german: {
    line: "Wer reitet so spät durch Nacht und Wind?",
    caption: "Hear the opening line of Goethe's Erlkönig.",
  },
  italian: {
    line: "Nel mezzo del cammin di nostra vita…",
    caption: "Hear the opening tercet of Dante's Inferno.",
  },
  oldenglish: {
    line: "Hwæt! Wē Gārdena in geārdagum…",
    caption: "Hear the opening line of Beowulf — read in reconstructed West Saxon.",
  },
  middleenglish: {
    line: "Whan that Aprille with his shoures soote…",
    caption: "Hear the opening of Chaucer's General Prologue — in the pronunciation of the 1390s.",
  },
  oldnorse: {
    line: "Vreiðr vas þá Vingþórr, es vaknaði…",
    caption: "Hear the opening of Þryms-kviða — Thor wakes to find his hammer gone.",
  },
  welsh: {
    line: "Pwyll Pendeuic Dyuet a oed yn arglwyd ar seith cantref Dyuet.",
    caption: "Hear the opening of the First Branch of the Mabinogi.",
  },
  gaulish: {
    line: "Segomāros Uillonēos toutious Namausatis eiōrū Bēlēsami sosin nemēton.",
    caption: "Hear the Vaison-la-Romaine inscription — a Gaulish votive from the second century BCE.",
  },
};

function renderAudioTeaser(lang) {
  const wrap = document.getElementById("audio-teaser");
  if (!wrap) return;
  const data = COURSE_OPENINGS[lang];
  if (!data) return; // leave hidden for languages without a vetted opening
  document.getElementById("teaser-line").textContent = data.line;
  document.getElementById("teaser-caption").textContent = data.caption;
  // Stash audio text on the hero play-pill so wirePlayPills can fetch real TTS.
  const pill = wrap.querySelector('[data-pill="hero"]');
  if (pill) {
    pill.dataset.audioText = data.line;
    pill.dataset.audioLang = lang;
  }
  wrap.style.display = "";
}

// ===================================================================
// LESSON PREVIEW (inline expansion on click)
// Ported from paideia-prototype-v2/curriculum.html (toggleLesson +
// lessonDetailHTML). Shows description, sample line, key vocabulary,
// and HEAR IT / BEGIN LESSON buttons inline below the row.
// ===================================================================

// Per-lesson preview data, keyed by [lang][lesson.id]. For lessons
// without an entry, falls back to the manifest's lesson.content as the
// description. Greek samples ported from prototype v2.
//
// LESSON_PREVIEWS — the panel shown when a lesson row is expanded on the
// curriculum landing page. Keyed by [lang][lesson.id]. Seeded for stage 1
// of each language (the high-value zone — where a new visitor is most
// likely to click). For lessons not banked here, the page falls back to
// the manifest's `content` field with no sample / no vocab.
//
const LESSON_PREVIEWS = {
  greek: {
    "1.1":  { desc: "We meet the first half of the alphabet — α β γ δ ε ζ η θ ι κ λ μ — reading each letter aloud, with its name, before any words.",
              sample: "Α α &nbsp;&nbsp; Β β &nbsp;&nbsp; Γ γ &nbsp;&nbsp; Δ δ &nbsp;&nbsp; Ε ε",
              vocab: [["α","alpha"],["β","beta"],["γ","gamma"],["δ","delta"],["ε","epsilon"]] },
    "1.2":  { desc: "The second half of the alphabet — ν ξ ο π ρ σ/ς τ υ φ χ ψ ω — with the two forms of sigma and the long vowel ω.",
              sample: "Ν ν &nbsp;&nbsp; Ξ ξ &nbsp;&nbsp; Ο ο &nbsp;&nbsp; Π π &nbsp;&nbsp; Ω ω",
              vocab: [["ν","nu"],["ξ","xi"],["ο","omicron"],["π","pi"],["ω","omega"]] },
    "1.3":  { desc: "The seven diphthongs that fuse two vowels into one sound. The ear learns them long before the eye stops noticing both letters.",
              sample: "αι · ει · οι · αυ · ευ · ου",
              vocab: [["αι","like 'eye'"],["ει","like 'eight'"],["οι","like 'boy'"],["αυ","like 'cow'"],["ου","like 'who'"]] },
    "1.4":  { desc: "Breathings: the smooth ᾿ and the rough ῾. A small mark above a vowel that decides whether the word begins with h.",
              sample: "ἄλφα &nbsp;·&nbsp; ἁρμονία",
              vocab: [["ἄνθρωπος","human"],["ἁρμονία","harmony"]] },
    "1.5":  { desc: "Accent: acute, grave, circumflex. The pitch of the spoken language, frozen into three marks above the syllable.",
              sample: "λόγος &nbsp;·&nbsp; ποιητής &nbsp;·&nbsp; γῆ",
              vocab: [["λόγος","word, reason"],["ποιητής","poet"],["γῆ","earth, land"]] },
    "1.6":  { desc: "Reading whole words for the first time. Names from history and myth — the alphabet doing its first piece of real work.",
              sample: "Σωκράτης &nbsp;·&nbsp; Πλάτων &nbsp;·&nbsp; Ἀχιλλεύς &nbsp;·&nbsp; Ἀθῆναι",
              vocab: [["Σωκράτης","Socrates"],["Πλάτων","Plato"],["Ἀθῆναι","Athens"]] },
    "1.7":  { desc: "A first complete sentence — read with attention to breathings and accent, then said aloud from memory.",
              sample: "ὁ Σωκράτης φιλόσοφός ἐστιν.",
              vocab: [["ὁ / ἡ / τό","the (m/f/n)"],["φιλόσοφος","philosopher"],["ἐστιν","is"]] },
  },

  // ---------- LATIN ----------
  latin: {
    "1.1": { desc: "The Latin alphabet — twenty-three letters — and the five vowels A, E, I, O, U with their long and short values.",
             sample: "A E I O V &nbsp;·&nbsp; ā ē ī ō ū",
             vocab: [["rōsa","rose"],["vīta","life"],["dōnum","gift"]] },
    "1.2": { desc: "The diphthongs ae, oe, au, ei, eu — two vowels written together, one sound. The poets fuse them; the prose writers keep them.",
             sample: "Caesar &nbsp;·&nbsp; Pompeiī &nbsp;·&nbsp; aurum",
             vocab: [["Caesar","Caesar"],["aurum","gold"],["laetus","glad"]] },
    "1.3": { desc: "The consonants — with the great traps: C is always hard (kappa, never s), V is always w, J does not exist (use I).",
             sample: "Cicerō &nbsp;·&nbsp; vīnum &nbsp;·&nbsp; Iuppiter",
             vocab: [["Cicerō","Cicero"],["vīnum","wine"],["Iuppiter","Jupiter"]] },
    "1.4": { desc: "Stress and quantity — the heart of Latin verse. Where the long vowels fall decides where the stress falls.",
             sample: "aˈmīcus &nbsp;·&nbsp; ˈrōma &nbsp;·&nbsp; patiˈentia",
             vocab: [["amīcus","friend"],["Rōma","Rome"],["patientia","patience"]] },
    "1.5": { desc: "Macrons — the horizontal stroke that marks a long vowel. Modern editions print them; Romans did not. We use them to learn.",
             sample: "Rōma &nbsp;·&nbsp; rosa &nbsp;·&nbsp; rōsam",
             vocab: [["Rōma","Rome (subj.)"],["Rōmam","Rome (obj.)"],["Rōmae","of Rome"]] },
    "1.6": { desc: "A first complete sentence — read aloud with attention to vowel length and stress.",
             sample: "Rōma in Italiā est.",
             vocab: [["Rōma","Rome"],["in Italiā","in Italy"],["est","is"]] },
  },

  // ---------- FRENCH ----------
  french: {
    "1.1": { desc: "The French vowels — the short orchestra that distinguishes é (closed e) from è (open e), and i from u (the famous front-rounded u).",
             sample: "été &nbsp;·&nbsp; près &nbsp;·&nbsp; rue",
             vocab: [["été","summer"],["près","near"],["rue","street"]] },
    "1.2": { desc: "The consonants — r in the throat, soft c before e/i, j like the s in pleasure, and the silent h.",
             sample: "Paris &nbsp;·&nbsp; génération &nbsp;·&nbsp; heure",
             vocab: [["Paris","Paris"],["chose","thing"],["jour","day"]] },
    "1.3": { desc: "Silent letters — the French page lies about pronunciation. Final consonants vanish; -ent on verbs vanishes. Learn what to ignore.",
             sample: "vou\u0331s ave\u0331z &nbsp;·&nbsp; ils parlen\u0331t\u0331",
             vocab: [["vous","you (pl.)"],["avez","have"],["parlent","(they) speak"]] },
    "1.4": { desc: "Liaison — a silent final consonant wakes up and links to the following vowel. The single most distinctive sound of spoken French.",
             sample: "les_amis &nbsp;·&nbsp; vous_avez &nbsp;·&nbsp; un_homme",
             vocab: [["les amis","the friends"],["un homme","a man"],["vous êtes","you are"]] },
    "1.5": { desc: "Élision — the dropping of a final vowel before another vowel: le ami becomes l'ami, ne est becomes n'est.",
             sample: "l'ami &nbsp;·&nbsp; n'est &nbsp;·&nbsp; j'aime",
             vocab: [["l'ami","the friend"],["j'aime","I love"],["c'est","it is"]] },
    "1.6": { desc: "Stress and intonation — French is famously flat. The stress falls on the last syllable of the phrase, not the word.",
             sample: "l'ami|de mon père|est|venu",
             vocab: [["venir","to come"],["père","father"],["ami","friend"]] },
  },

  // ---------- GERMAN ----------
  german: {
    "1.1": { desc: "The first half of the German alphabet — the consonants and vowels that English readers will recognise.",
             sample: "A B C D E F G H I J K L M",
             vocab: [["Haus","house"],["Buch","book"],["Mann","man"]] },
    "1.2": { desc: "The second half — N through Z — with the famous traps: V is f, W is v, Z is ts.",
             sample: "V W X Y Z &nbsp;·&nbsp; Vater &nbsp;·&nbsp; Welt",
             vocab: [["Vater","father"],["Welt","world"],["Zeit","time"]] },
    "1.3": { desc: "The umlauts ä, ö, ü — three sounds without English equivalents — and the ß, which is double-s.",
             sample: "Mädchen &nbsp;·&nbsp; schön &nbsp;·&nbsp; Tür &nbsp;·&nbsp; groß",
             vocab: [["schön","beautiful"],["Tür","door"],["groß","big"]] },
    "1.4": { desc: "The two ch-sounds — the hard ach-Laut (Bach) and the soft ich-Laut (ich). Get them right and you sound German.",
             sample: "Bach &nbsp;·&nbsp; ich &nbsp;·&nbsp; Kuchen",
             vocab: [["Bach","brook"],["ich","I"],["Kuchen","cake"]] },
    "1.5": { desc: "Final devoicing — the rule that turns Tag into 'tahk' at the end of a syllable. Spelt with d, b, g; spoken with t, p, k.",
             sample: "Tag &nbsp;·&nbsp; gelb &nbsp;·&nbsp; weg",
             vocab: [["Tag","day"],["gelb","yellow"],["weg","away"]] },
    "1.6": { desc: "Vowel length — a vowel before one consonant is long, before two is short. The rule has exceptions; this lesson teaches the rule.",
             sample: "Bahn &nbsp;·&nbsp; mein &nbsp;·&nbsp; Straße",
             vocab: [["Straße","street"],["Sohn","son"],["Bett","bed"]] },
  },

  // ---------- ITALIAN ----------
  italian: {
    "1.1": { desc: "The Italian alphabet — just twenty-one letters — and the five pure vowels: a e i o u. The clearest vowel system in Europe.",
             sample: "A E I O U &nbsp;·&nbsp; casa &nbsp;·&nbsp; vita",
             vocab: [["casa","house"],["vita","life"],["amore","love"]] },
    "1.2": { desc: "The consonant clusters that mark Italian out: gn (as in lasagne), gl (as in famiglia), sc (as in pesce).",
             sample: "gnocchi &nbsp;·&nbsp; famiglia &nbsp;·&nbsp; pesce",
             vocab: [["gnocchi","dumplings"],["famiglia","family"],["pesce","fish"]] },
    "1.3": { desc: "Double consonants — written twice, held twice as long. The difference between papa (pope) and pappa (porridge).",
             sample: "papa &nbsp;·&nbsp; pappa &nbsp;·&nbsp; nonna",
             vocab: [["papa","pope"],["pappa","porridge"],["nonna","grandmother"]] },
    "1.4": { desc: "Stress — usually on the penultimate syllable, with a grave accent marking the exceptions: città, virtù, perché.",
             sample: "città &nbsp;·&nbsp; perché &nbsp;·&nbsp; virtù",
             vocab: [["città","city"],["perché","because/why"],["virtù","virtue"]] },
    "1.5": { desc: "The diphthongs and triphthongs — vowel clusters that act as one syllable: uomo, uovo, miei, tuoi.",
             sample: "uomo &nbsp;·&nbsp; uovo &nbsp;·&nbsp; miei",
             vocab: [["uomo","man"],["uovo","egg"],["miei","my (m.pl.)"]] },
    "1.6": { desc: "Reading the names — Dante, Beatrice, Firenze, Venezia — the music of Italian proper nouns.",
             sample: "Dante &nbsp;·&nbsp; Beatrice &nbsp;·&nbsp; Firenze",
             vocab: [["Dante","Dante"],["Firenze","Florence"],["Venezia","Venice"]] },
    "1.7": { desc: "A first complete sentence — read aloud, then said from memory.",
             sample: "Io sono italiano.",
             vocab: [["io","I"],["sono","am"],["italiano","Italian"]] },
  },

  // ---------- OLD ENGLISH ----------
  oldenglish: {
    "1.1": { desc: "The Old English alphabet — mostly the Roman letters — read in the values they had in eighth-century Northumbria.",
             sample: "A B C D E F G H I L M N O P R S T U W Y",
             vocab: [["cyning","king"],["hlāford","lord"],["dæg","day"]] },
    "1.2": { desc: "The four letters English has lost: Æ/æ (ash), Þ/þ (thorn), Ð/ð (eth), and Ʒ/ƿ (wynn). Each replaced by something blander.",
             sample: "æ &nbsp;·&nbsp; þ &nbsp;·&nbsp; ð &nbsp;·&nbsp; ƿ",
             vocab: [["æsc","ash-tree"],["þing","thing"],["ðes","this (m.)"]] },
    "1.3": { desc: "The vowels — short and long. Macrons mark the long ones in modern editions; the manuscripts did not.",
             sample: "gōd &nbsp;·&nbsp; god &nbsp;·&nbsp; mōna",
             vocab: [["gōd","good"],["god","god"],["mōna","moon"]] },
    "1.4": { desc: "The consonants — with the c that is sometimes k, sometimes ch; and the g that is sometimes g, sometimes y.",
             sample: "cīdan &nbsp;·&nbsp; cynn &nbsp;·&nbsp; gearu",
             vocab: [["cīdan","to chide"],["cynn","kin"],["gearu","ready"]] },
    "1.5": { desc: "Stress — always on the first syllable of the root. The Germanic pattern that English still keeps.",
             sample: "ˈgewrit &nbsp;·&nbsp; ˈwīsdōm &nbsp;·&nbsp; ˈwuldorfæder",
             vocab: [["wīsdōm","wisdom"],["wuldor","glory"],["fæder","father"]] },
    "1.6": { desc: "First words — the bedrock vocabulary that survives directly into modern English.",
             sample: "dæg &nbsp;·&nbsp; niht &nbsp;·&nbsp; hlāf &nbsp;·&nbsp; wæter",
             vocab: [["hlāf","loaf, bread"],["wæter","water"],["niht","night"]] },
    "1.7": { desc: "A first complete sentence — read aloud with Germanic stress.",
             sample: "Fæder ūre, þū þe eart on heofonum…",
             vocab: [["fæder","father"],["ūre","our"],["heofon","heaven"]] },
  },

  // ---------- MIDDLE ENGLISH ----------
  middleenglish: {
    "1.1": { desc: "The alphabet — same letters as modern English but spelt with cheerful inconsistency. One word, five spellings.",
             sample: "knight &nbsp;·&nbsp; knyʒt &nbsp;·&nbsp; knyght",
             vocab: [["knight","knight"],["yong","young"],["swich","such"]] },
    "1.2": { desc: "The vowels before the Great Vowel Shift — i is ee, e is ay, a is ah. Read Chaucer like an Italian, not like an Englishman.",
             sample: "ryde &nbsp;·&nbsp; he &nbsp;·&nbsp; wal",
             vocab: [["ryde","to ride (sounds reeda)"],["he","he (sounds hay)"],["name","name (sounds nahmuh)"]] },
    "1.3": { desc: "The final -e — sounded as a half-syllable in verse, silent in prose. Chaucer's metre depends on it.",
             sample: "And smale fowles maken melodye̱e",
             vocab: [["smal","small"],["fowl","bird"],["melodye","melody"]] },
    "1.4": { desc: "The consonants — and the famous yogh ȝ — a letter that did the work of y, gh, and w all at once.",
             sample: "yȝt &nbsp;·&nbsp; nauȝt &nbsp;·&nbsp; riȝt",
             vocab: [["yet","yet"],["naught","nothing"],["right","right"]] },
    "1.5": { desc: "Stress and meter — Chaucer writes in iambic pentameter before the term existed. Five beats per line; the e at the end of a word does work.",
             sample: "Whan that A-pril-le with his shou-res soo-te",
             vocab: [["shoure","shower"],["soote","sweet"],["Aprille","April"]] },
    "1.6": { desc: "First lines — from the General Prologue of the Canterbury Tales.",
             sample: "Whan that Aprille with his shoures soote",
             vocab: [["whan","when"],["shoure","shower"],["soote","sweet"]] },
  },

  // ---------- OLD NORSE ----------
  oldnorse: {
    "1.1": { desc: "The Old Norse alphabet — mostly Roman, plus four characters: þ, ð, æ, ǫ (the hooked o).",
             sample: "A B D E F G H I J K L M N O P R S T U V Y",
             vocab: [["konungr","king"],["maðr","man"],["dagr","day"]] },
    "1.2": { desc: "Þ, Ð, Æ, Ǫ — the four letters English has lost. Þ is voiceless th, ð is voiced th, æ is the ash, ǫ is a rounded a.",
             sample: "þú &nbsp;·&nbsp; eða &nbsp;·&nbsp; mæla &nbsp;·&nbsp; ǫnd",
             vocab: [["þú","you (sg.)"],["mæla","to speak"],["ǫnd","breath, soul"]] },
    "1.3": { desc: "Vowels long and short — marked with acute accents in modern editions. The acute is length, not stress.",
             sample: "rá &nbsp;·&nbsp; ra &nbsp;·&nbsp; róðr &nbsp;·&nbsp; roði",
             vocab: [["rá","corner"],["róðr","rowing"],["í","in"]] },
    "1.4": { desc: "The diphthongs — ei, ey, au — read each vowel in sequence, sliding fast.",
             sample: "heim &nbsp;·&nbsp; eyja &nbsp;·&nbsp; aust",
             vocab: [["heim","home"],["eyja","island"],["austr","east"]] },
    "1.5": { desc: "The consonant clusters — hl-, hn-, hr-, kn-, gn- — every letter sounded at the start of a word.",
             sample: "hlæ\u0303ja &nbsp;·&nbsp; kná &nbsp;·&nbsp; gnýr",
             vocab: [["hlæja","to laugh"],["kná","deft"],["gnýr","din, noise"]] },
    "1.6": { desc: "Stress — always on the first syllable. The Germanic anchor that the Norse poets exploit for their alliterative verse.",
             sample: "ˈhávar ˈvaði &nbsp;·&nbsp; ˈsvávar ˈgunnr",
             vocab: [["hávar","high"],["gunnr","battle"],["svinnr","wise"]] },
    "1.7": { desc: "First words — the kennings and the names of the gods.",
             sample: "Óðinn &nbsp;·&nbsp; Þórr &nbsp;·&nbsp; Freyja &nbsp;·&nbsp; Loki",
             vocab: [["Óðinn","Odin"],["Þórr","Thor"],["Freyja","Freyja"]] },
  },

  // ---------- WELSH ----------
  welsh: {
    "1.1": { desc: "The Welsh alphabet — 28 letters, including digraphs that count as single letters: ch, dd, ff, ng, ll, ph, rh, th.",
             sample: "A B C Ch D Dd E F Ff G Ng H",
             vocab: [["ci","dog"],["merch","girl"],["tŷ","house"]] },
    "1.2": { desc: "The vowels — simple (a e i o u y w) plus the long form with circumflex (â ê î ô û ŷ ŵ).",
             sample: "tân &nbsp;·&nbsp; tan &nbsp;·&nbsp; tŷ &nbsp;·&nbsp; ty",
             vocab: [["tân","fire"],["tan","under"],["tŷ","house"]] },
    "1.3": { desc: "The familiar consonants — mostly the same as English, but with rolled r and the famous double-d (dd) that is voiced th.",
             sample: "dydd &nbsp;·&nbsp; rhad &nbsp;·&nbsp; bara",
             vocab: [["dydd","day"],["rhad","cheap"],["bara","bread"]] },
    "1.4": { desc: "The unfamiliar ones — ll (a lateral fricative, sssh-th), ch (as in Bach), rh (voiceless rolled r).",
             sample: "llaw &nbsp;·&nbsp; chwaer &nbsp;·&nbsp; Rhys",
             vocab: [["llaw","hand"],["chwaer","sister"],["Rhys","Rhys (name)"]] },
    "1.5": { desc: "Stress and rhythm — stress on the penultimate syllable, with a falling intonation that Welsh shares with no near neighbour.",
             sample: "ˈcy-noeth &nbsp;·&nbsp; ar-ˈgly-wydd",
             vocab: [["cynoeth","earlier"],["arglwydd","lord"],["deuparth","two-thirds"]] },
    "1.6": { desc: "Mutation — an introduction to the Celtic feature where the first letter of a word changes by context. Welsh has three mutations.",
             sample: "cath → ei gath &nbsp;·&nbsp; merch → fy merch",
             vocab: [["cath","cat"],["merch","daughter"],["pen","head"]] },
    "1.7": { desc: "The Soft Mutation (Treiglad Meddal) — c→g, p→b, t→d, g→Ø, b→f, d→dd, m→f, ll→l, rh→r. The most common change.",
             sample: "cath → dy gath &nbsp;·&nbsp; pen → dy ben",
             vocab: [["cath","cat"],["pen","head"],["tad","father"]] },
  },

  // ---------- GAULISH ----------
  gaulish: {
    "1.1": { desc: "The scripts of Gaul — the same language was written in three different alphabets: Greek (south), Lepontic (Alpine), and Latin (after Caesar).",
             sample: "ΚΑΣΙΛΟΣ &nbsp;·&nbsp; CASILŌS &nbsp;·&nbsp; kasilōs",
             vocab: [["toutous","people, tribe"],["rīx","king"],["epos","horse"]] },
    "1.2": { desc: "The Greek-script inscriptions of Provence — the earliest written Gaulish, on stone, from the Marseille region.",
             sample: "ΣΕΓΟΜΑΡΟΣ ΟΥΙΛΛΟΝΕΟΣ",
             vocab: [["Segomāros","a name (‘victorious’)"],["toutious","of-the-people"]] },
    "1.3": { desc: "The Latin-script inscriptions — from the imperial period, on lead curse tablets, on dedicatory altars, on graffiti.",
             sample: "DUGIIONTIIO &nbsp;·&nbsp; UCUETIN",
             vocab: [["dugīionti","they do, perform"],["Ucuetis","a god (Alise)"]] },
    "1.4": { desc: "The Lepontic alphabet — an Etruscan-derived script used in the western Alps before the Greek-script tradition spread inland.",
             sample: "𓌡𓌫𓌪𓌨𓌠𓌦 (Lepontic)",
             vocab: [["pelkui","to Pelku (dat.)"],["karite","set up, made"]] },
    "1.5": { desc: "Gaulish phonology — the Celtic stops (p t k b d g), the resonants (m n r l), the diphthongs (ei, ou, au).",
             sample: "rīx &nbsp;·&nbsp; epos &nbsp;·&nbsp; toutous",
             vocab: [["rīx","king"],["epos","horse"],["matu","good"]] },
    "1.6": { desc: "Names and theonyms — the first words a reader of Gaulish must know are the names of people and the names of the gods.",
             sample: "Cernunnos &nbsp;·&nbsp; Bēlēnos &nbsp;·&nbsp; Epona",
             vocab: [["Cernunnos","the horned god"],["Bēlēnos","the bright one"],["Epona","horse goddess"]] },
    "1.7": { desc: "Formulae — the standard phrases that appear on votive offerings: 'X dedicated this to Y'.",
             sample: "sosin nemēton — 'this sacred enclosure'",
             vocab: [["sosin","this"],["nemēton","sacred grove, sanctuary"],["eiōrū","(I have) made"]] },
  },
};

function getLessonPreview(lang, lesson) {
  const bank = LESSON_PREVIEWS[lang] || {};
  const banked = bank[lesson.id];
  if (banked) return banked;
  // Fallback: use manifest content as description; no sample, no vocab.
  return { desc: lesson.content || lesson.subtitle || lesson.title || "", sample: "", vocab: null };
}

function lessonDetailHTML(lang, lesson) {
  const p = getLessonPreview(lang, lesson);
  const minutes = lesson.duration_minutes || lesson.min || 12;
  let sample = "";
  if (p.sample) {
    sample = `<div class="sample-block">
                <div class="label">SAMPLE</div>
                <div class="greek">${p.sample}</div>
              </div>`;
  }
  let vocab = "";
  if (p.vocab && p.vocab.length) {
    vocab = `<div class="vocab-row">
               <div class="label">KEY VOCABULARY</div>
               <div class="vocab-chips">${
                 p.vocab.map((v) => `<span class="vocab-chip"><span class="gl">${esc(v[0])}</span><span class="en">${esc(v[1])}</span></span>`).join("")
               }</div>
             </div>`;
  }
  // Audio text for the HEAR IT pill: strip HTML entities and markup from the
  // sample so the TTS gets clean Greek. Fall back to the description if no sample.
  const audioText = p.sample
    ? p.sample.replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : (p.desc || "").slice(0, 200);
  return `<div class="lesson-detail">
            <p>${esc(p.desc)}</p>
            ${sample}
            ${vocab}
            <div class="lesson-actions">
              <button class="play-pill" data-pill="lesson" data-audio-text="${esc(audioText)}" data-audio-lang="${esc(lang)}" type="button">
                <span class="glyph"><svg viewBox="0 0 16 16" width="9" height="9"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg></span>
                HEAR IT
              </button>
              <a class="btn-ink" href="/paideia/${esc(lang)}/curriculum/${esc(lesson.id || '')}">BEGIN LESSON →</a>
              <span class="meta">${minutes} min · audio + recitation</span>
            </div>
          </div>`;
}

const _openLessons = new Set();

function wireLessonToggles(lang, manifest) {
  // Build a quick lookup: { '<si>-<li>': lessonObj }
  const lookup = {};
  (manifest.stages || []).forEach((s, si) => {
    (s.lessons || []).forEach((l, li) => {
      lookup[`${si}-${li}`] = l;
    });
  });

  document.querySelectorAll("[data-lesson-toggle]").forEach((btn) => {
    if (btn.dataset.lessonWired) return;
    btn.dataset.lessonWired = "1";
    btn.addEventListener("click", (e) => {
      // Allow Ctrl/Cmd-click to skip preview and jump straight to the lesson.
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        const id = btn.dataset.lessonId;
        if (id) window.location.href = `/paideia/${lang}/curriculum/${id}`;
        return;
      }
      e.preventDefault();
      const k = btn.dataset.lessonToggle;
      const lesson = lookup[k];
      if (!lesson) return;
      const toggleSpan = btn.querySelector(".toggle");
      if (_openLessons.has(k)) {
        _openLessons.delete(k);
        btn.classList.remove("open");
        if (toggleSpan) toggleSpan.textContent = "+";
        const next = btn.nextElementSibling;
        if (next && next.classList.contains("lesson-detail")) next.remove();
      } else {
        _openLessons.add(k);
        btn.classList.add("open");
        if (toggleSpan) toggleSpan.textContent = "−";
        const tpl = document.createElement("template");
        tpl.innerHTML = lessonDetailHTML(lang, lesson).trim();
        const detail = tpl.content.firstElementChild;
        btn.after(detail);
        wirePlayPills(detail);
      }
    });
  });
}

// ===================================================================
// CHECKPOINT SAMPLE QUESTIONS (inline expansion on toggle)
// Ported from paideia-prototype-v2/curriculum.html (CHECKPOINT_BANK
// + renderCheckpoint). Shows 4-5 sample questions per checkpoint with
// full grading interactivity: MCQ buttons, text input, score, and reset.
// ===================================================================

//
// CHECKPOINT_BANK — the sample questions shown when 'see sample questions'
// is toggled on a stage's CHECKPOINT row. Keyed by [lang][stageIndex].
// Each stage's bank has 5–6 questions of two kinds: 'mcq' (multiple choice)
// or 'type' (text input). Pass threshold is ceil(70% of question count).
//
// IMPORTANT: there is no Greek fallback for missing languages. If a
// language has no bank entry, the 'see sample questions' toggle is hidden
// at render time (see renderStages in this file).
//
const CHECKPOINT_BANK = {
  greek: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test recognition of the alphabet, breathings, and pitch accent. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "Which letter is theta?", opts: ["α","θ","ψ","σ"], answer: 1, hint: "The aspirated dental — from Phoenician ṭēth." },
           { kind: "mcq",  prompt: "Which word carries a circumflex?", opts: ["λόγος","ποιητής","γῆ","ἀρχή"], answer: 2, hint: "Look for the wave-shaped accent ῀ over a long vowel." },
           { kind: "type", prompt: "Transliterate λόγος into the Roman alphabet.", answer: "logos", hint: "Long o in the antepenult; final s is sigma at word's end (ς)." },
           { kind: "mcq",  prompt: "ἁρμονία takes which breathing?", opts: ["smooth (no h-)","rough (h-)","neither","both"], answer: 1, hint: "The dot opens to the right — h- before the vowel." },
           { kind: "type", prompt: "Write the Greek for 'human' (nominative sg.).", answer: "ἄνθρωπος", hint: "Smooth breathing + acute on the antepenult; ω in the second syllable.", accept: ["άνθρωπος","ανθρωπος"] },
         ] },
    1: { title: "Checkpoint II — The Sentence",
         blurb: "Six questions test the article, the first two declensions, and the present indicative.",
         qs: [
           { kind: "mcq",  prompt: "Dative singular neuter of the article?", opts: ["τοῦ","τῷ","τό","τόν"], answer: 1, hint: "Same form as masculine dative — context disambiguates." },
           { kind: "type", prompt: "Decline λόγος in the genitive singular.", answer: "λόγου", hint: "Second declension masc. -ος → -ου.", accept: ["λογου"] },
           { kind: "mcq",  prompt: "ἡ μήτηρ is what gender?", opts: ["masculine","feminine","neuter","common"], answer: 1 },
           { kind: "type", prompt: "Conjugate γράφω in the 3rd person plural.", answer: "γράφουσι(ν)", hint: "Present indicative active ending: -ουσι(ν).", accept: ["γράφουσι","γράφουσιν","γραφουσι","γραφουσιν"] },
           { kind: "mcq",  prompt: "Which adjective agrees with τὸν ἄνθρωπον?", opts: ["ἀγαθή","ἀγαθόν","ἀγαθόν (neut.)","ἀγαθούς"], answer: 1, hint: "Masculine accusative singular." },
           { kind: "mcq",  prompt: "εἰμί, 2nd singular?", opts: ["εἰμί","εἶ","ἐστί","ἐσμέν"], answer: 1 },
         ] },
    2: { title: "Checkpoint III — The Verbs and the Reading",
         blurb: "Six questions on voices, the past tenses, the third declension, and the participle.",
         qs: [
           { kind: "type", prompt: "Imperfect of λύω, 1st singular?", answer: "ἔλυον", hint: "Augment ἐ-; imperfect ending -ον.", accept: ["ελυον"] },
           { kind: "mcq",  prompt: "λυόμενος is which form?", opts: ["aorist active participle","present mid/pass participle","perfect active participle","aorist mid participle"], answer: 1 },
           { kind: "type", prompt: "First aorist of λύω, 1st singular?", answer: "ἔλυσα", hint: "-σα is the aorist marker.", accept: ["ελυσα"] },
           { kind: "mcq",  prompt: "ὁ φύλαξ — third declension stem ends in?", opts: ["a vowel","-σ","a consonant (κ/γ/χ)","a labial"], answer: 2 },
           { kind: "mcq",  prompt: "Genitive absolute uses what case for the noun and the participle?", opts: ["nominative","genitive","dative","accusative"], answer: 1 },
           { kind: "type", prompt: "Translate 'I was being freed' into Greek (1 sg.).", answer: "ἐλυόμην", hint: "Imperfect middle/passive 1st sg.: ἐ- + λυ- + -όμην.", accept: ["ελυομην"] },
         ] },
    3: { title: "Checkpoint IV — The Mood and the Mind",
         blurb: "Six questions on the moods, conditions, indirect statement, and the perfect system.",
         qs: [
           { kind: "mcq",  prompt: "Subjunctive of εἰμί, 1st singular?", opts: ["ὦ","ἦν","εἴην","ἔσομαι"], answer: 0 },
           { kind: "mcq",  prompt: "Present unreal condition ('if I were freeing, …') — protasis uses?", opts: ["εἰ + indicative","ἐάν + subjunctive","εἰ + optative","εἰ + imperfect indicative"], answer: 3, hint: "Past-form indicative for unreal time." },
           { kind: "type", prompt: "Perfect active 1st singular of λύω?", answer: "λέλυκα", hint: "Reduplication λε-; -κα suffix.", accept: ["λελυκα"] },
           { kind: "mcq",  prompt: "Indirect statement after a verb of saying — most common construction?", opts: ["ὅτι + indicative","accusative + infinitive","ἵνα + subjunctive","participle + accusative"], answer: 0 },
           { kind: "type", prompt: "Aorist imperative active 2 sg. of λύω?", answer: "λῦσον", hint: "Distinctive -σον ending.", accept: ["λυσον"] },
           { kind: "mcq",  prompt: "Optative is most often the mood of?", opts: ["fact","command","wish or remote possibility","direct question"], answer: 2 },
         ] },
  },

  // ---------- LATIN ----------
  latin: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test the alphabet, the vowels, the diphthongs, and stress placement. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "In classical Latin, the letter C is always pronounced like:", opts: ["the c in cell","the c in cat (always k)","the c in church","the s in see"], answer: 1, hint: "Cicero called himself 'Kikero'." },
           { kind: "mcq",  prompt: "How is V pronounced in classical Latin?", opts: ["like English v","like English f","like English w","like English b"], answer: 2, hint: "Vīnum is 'wīnum'." },
           { kind: "type", prompt: "Write Caesar's name in classical pronunciation, using English letters.", answer: "kaisar", hint: "Hard c, the ae diphthong as 'ai', V as W (but no V here).", accept: ["kaisarr","kāisar"] },
           { kind: "mcq",  prompt: "The macron over a vowel indicates:", opts: ["stress","length (long vowel)","a different vowel","breath"], answer: 1, hint: "Rōma has a long o." },
           { kind: "mcq",  prompt: "Stress in Latin generally falls on:", opts: ["the first syllable, always","the last syllable","the penult if heavy, else the antepenult","wherever feels right"], answer: 2, hint: "A heavy penult holds the stress; otherwise it slides back." },
         ] },
  },

  // ---------- FRENCH ----------
  french: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test French vowels, silent letters, liaison, and élision. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "The accent on é marks:", opts: ["a closed e (as in café)","an open e (as in mère)","a circumflex e","nothing, decorative"], answer: 0, hint: "Été has it. Mère does not." },
           { kind: "mcq",  prompt: "In 'les amis', the final s of les is:", opts: ["silent","pronounced as s","pronounced as z (liaison)","pronounced as sh"], answer: 2, hint: "Liaison voices the s before a vowel." },
           { kind: "type", prompt: "Write 'le ami' with the correct élision.", answer: "l'ami", hint: "E vanishes before a vowel.", accept: ["l\u2019ami"] },
           { kind: "mcq",  prompt: "The final consonant of 'parlent' (they speak) is:", opts: ["pronounced as t","pronounced as d","silent (the -ent is mute)","pronounced as nt-ee"], answer: 2, hint: "-ent on a third-person plural verb is mute." },
           { kind: "mcq",  prompt: "In French, stress falls on:", opts: ["the first syllable of every word","the last syllable of the word","the last syllable of the phrase","there is no stress"], answer: 2, hint: "French is famously flat — the stress is phrasal, not lexical." },
         ] },
  },

  // ---------- GERMAN ----------
  german: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test the German alphabet, umlauts, final devoicing, and the two ch-sounds. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "German W is pronounced like:", opts: ["English w","English v","English f","silent"], answer: 1, hint: "Wasser sounds like 'vasser'." },
           { kind: "mcq",  prompt: "The letter ß represents:", opts: ["a Greek beta","a double s","a long vowel marker","a silent letter"], answer: 1, hint: "Used after long vowels and diphthongs." },
           { kind: "type", prompt: "How is 'Tag' pronounced at the end of a sentence?", answer: "tahk", hint: "Final devoicing turns g into k.", accept: ["tak","ta:k","taak"] },
           { kind: "mcq",  prompt: "The ch in 'ich' is:", opts: ["like English ch in church","like English k","a soft palatal fricative","silent"], answer: 2, hint: "Front vowels take the soft ich-Laut." },
           { kind: "mcq",  prompt: "The ch in 'Bach' is:", opts: ["like English ch in church","a hard back fricative (ach-Laut)","like English k","silent"], answer: 1, hint: "Back vowels take the hard ach-Laut." },
         ] },
  },

  // ---------- ITALIAN ----------
  italian: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test Italian vowels, double consonants, the special clusters, and stress. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "How many vowel sounds does Italian have?", opts: ["three","five (pure a e i o u)","seven","twelve"], answer: 1, hint: "The clearest vowel system in Europe." },
           { kind: "mcq",  prompt: "The difference between 'papa' and 'pappa' is:", opts: ["the stress","the length of the consonant (single vs double)","the vowel quality","nothing — they are the same"], answer: 1, hint: "Held twice as long when written twice." },
           { kind: "type", prompt: "Write 'family' in Italian.", answer: "famiglia", hint: "The gli cluster.", accept: ["Famiglia"] },
           { kind: "mcq",  prompt: "In 'città', the grave accent marks:", opts: ["a different vowel","a long vowel","the stressed syllable (an exception to the rule)","a vocative"], answer: 2, hint: "Stress normally falls on the penult; the accent marks where it doesn't." },
           { kind: "mcq",  prompt: "Where does Italian stress usually fall?", opts: ["first syllable","penultimate (next-to-last) syllable","final syllable","there is no stress"], answer: 1, hint: "Vita, mano, casa — all penultimate." },
         ] },
  },

  // ---------- OLD ENGLISH ----------
  oldenglish: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test the Old English alphabet, the lost letters, vowel length, and stress. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "The Old English letter þ (thorn) represents:", opts: ["a long e","th (both voiced and voiceless)","a w-sound","silent"], answer: 1, hint: "Þing means 'thing'." },
           { kind: "mcq",  prompt: "The letter æ (ash) sounds like:", opts: ["the a in father","the a in cat","a long o","a schwa"], answer: 1, hint: "Æsc, 'ash-tree'." },
           { kind: "type", prompt: "Write 'good' (the adjective) in Old English, with macron.", answer: "gōd", hint: "Long o. Note: 'god' (no macron) means 'God' the deity.", accept: ["gōd","god"] },
           { kind: "mcq",  prompt: "Old English stress falls on:", opts: ["the last syllable","the penult","the first syllable of the root","wherever feels right"], answer: 2, hint: "The Germanic anchor English still keeps." },
           { kind: "mcq",  prompt: "The Old English letter wynn (ƿ) was later replaced by:", opts: ["v","y","double-u (w)","th"], answer: 2, hint: "Two u's, written together." },
         ] },
  },

  // ---------- MIDDLE ENGLISH ----------
  middleenglish: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test Middle English spelling, pre-shift vowels, the yogh, and Chaucer's metre. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "In Chaucer's pronunciation, the i in 'ryde' sounds like:", opts: ["modern English i (long i)","modern English ee","modern English ay","a schwa"], answer: 1, hint: "Read Chaucer like an Italian, not like an Englishman — i is ee." },
           { kind: "mcq",  prompt: "The final -e in 'soote' (sweet) is:", opts: ["always silent","a half-syllable in verse, silent in prose","a stressed syllable","a vowel mark"], answer: 1, hint: "Chaucer's metre depends on it." },
           { kind: "type", prompt: "How many beats per line does Chaucer's Canterbury Tales use?", answer: "5", hint: "Iambic pentameter, before the term existed.", accept: ["five","pentameter","iambic pentameter"] },
           { kind: "mcq",  prompt: "The Middle English letter yogh (ȝ) was eventually replaced by:", opts: ["y, gh, or w depending on context","a single letter z","the digraph th","the letter g only"], answer: 0, hint: "It did the work of three modern letters." },
           { kind: "type", prompt: "Which Middle English word means 'when'?", answer: "whan", hint: "Opening of the Canterbury Tales.", accept: ["whanne","Whan"] },
         ] },
  },

  // ---------- OLD NORSE ----------
  oldnorse: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test the Old Norse alphabet, the special letters, vowel length, and stress. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "The acute accent in 'rá' marks:", opts: ["stress","a long vowel","a different vowel quality","a syllable break"], answer: 1, hint: "Length, not stress — Old Norse stress is always initial." },
           { kind: "mcq",  prompt: "The Old Norse letter ð (eth) represents:", opts: ["voiced th (as in 'this')","voiceless th (as in 'thin')","a d-sound","a y-sound"], answer: 0, hint: "Voiced; thorn is voiceless." },
           { kind: "type", prompt: "Write the name of the Norse god of thunder.", answer: "Þórr", hint: "Thorn for the th-, acute for the long vowel.", accept: ["þórr","Thorr","thorr"] },
           { kind: "mcq",  prompt: "In 'hlæja' (to laugh), the h before l is:", opts: ["silent","pronounced as an aspirated voiceless l","like English h","a vowel"], answer: 1, hint: "Hl-, hn-, hr- clusters voice the resonant." },
           { kind: "mcq",  prompt: "Old Norse stress falls on:", opts: ["the last syllable","the penult","the first syllable, always","the heavy syllable"], answer: 2, hint: "Germanic initial stress, used by the alliterative metre." },
         ] },
  },

  // ---------- WELSH ----------
  welsh: {
    0: { title: "Checkpoint I — The Sound and the Shape",
         blurb: "Five questions test Welsh digraphs, the special consonants, mutation, and stress. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "How many letters does the Welsh alphabet have?", opts: ["twenty-six","twenty-eight (with digraphs as single letters)","twenty-four","thirty-two"], answer: 1, hint: "Ch, dd, ff, ng, ll, ph, rh, th each count as one letter." },
           { kind: "mcq",  prompt: "The Welsh ll is:", opts: ["a doubled l, twice as long","a voiceless lateral fricative","silent","like English y"], answer: 1, hint: "A hiss out the side of the tongue." },
           { kind: "type", prompt: "Under the Soft Mutation, what does C become?", answer: "g", hint: "c→g, p→b, t→d.", accept: ["G"] },
           { kind: "mcq",  prompt: "Welsh stress generally falls on:", opts: ["the last syllable","the penultimate syllable","the first syllable","the heaviest syllable"], answer: 1, hint: "Penultimate — with falling intonation." },
           { kind: "mcq",  prompt: "The Welsh letter dd represents:", opts: ["a doubled d, held twice as long","the voiced th of 'this'","the voiceless th of 'thin'","a y-sound"], answer: 1, hint: "Cf. eth in Old English." },
         ] },
  },

  // ---------- GAULISH ----------
  gaulish: {
    0: { title: "Checkpoint I — The Sound and the Sign",
         blurb: "Five questions test the three scripts used to write Gaulish, the basic phonology, and the standard inscription formulae. Pass with 4 of 5.",
         qs: [
           { kind: "mcq",  prompt: "In what three scripts was Gaulish written?", opts: ["Latin, Cyrillic, Greek","Greek, Latin, Lepontic","Phoenician, Etruscan, Roman","Ogham, Runic, Greek"], answer: 1, hint: "South in Greek, Alps in Lepontic, Empire in Latin." },
           { kind: "mcq",  prompt: "Gaulish rīx ('king') is cognate with which Latin word?", opts: ["rōma","rēx","rēs","rota"], answer: 1, hint: "Both descend from Indo-European *h₃rēǵ-." },
           { kind: "type", prompt: "What does 'nemēton' mean?", answer: "sacred grove", hint: "Cognate with Latin nemus, Greek nemos.", accept: ["sanctuary","sacred place","holy grove","sacred enclosure"] },
           { kind: "mcq",  prompt: "The Vaison-la-Romaine inscription is dedicated to:", opts: ["Mercury","Jupiter","Bēlēsami","Cernunnos"], answer: 2, hint: "A Celtic goddess of brightness." },
           { kind: "mcq",  prompt: "Most surviving Gaulish texts are:", opts: ["epic poetry","legal codes","votive inscriptions and curse tablets","private letters"], answer: 2, hint: "What a culture writes on stone is what we can still read." },
         ] },
  },
};

const _openCheckpoints = new Set();

function wireCheckpointToggles(lang) {
  document.querySelectorAll("[data-cp-toggle]").forEach((btn) => {
    if (btn.dataset.cpWired) return;
    btn.dataset.cpWired = "1";
    btn.addEventListener("click", () => {
      const si = +btn.dataset.cpToggle;
      const wrap = document.querySelector(`[data-checkpoint-preview="${si}"]`);
      if (!wrap) return;
      if (_openCheckpoints.has(si)) {
        _openCheckpoints.delete(si);
        wrap.innerHTML = "";
        btn.classList.remove("open");
        btn.textContent = "auto-graded · see sample questions ↗";
      } else {
        _openCheckpoints.add(si);
        btn.classList.add("open");
        btn.textContent = "auto-graded · hide sample questions ↑";
        renderCheckpoint(lang, si, wrap);
      }
    });
  });
}

function renderCheckpoint(lang, si, wrap) {
  // No Greek fallback (Jae 2026-05-27 — a Latin checkpoint showing Greek
  // questions would mislead). If the language has no bank entry for this
  // stage, surface a polite stub so the user knows something's coming.
  const bank = CHECKPOINT_BANK[lang] || {};
  const data = bank[si];
  if (!data) {
    wrap.innerHTML = `<div class="checkpoint-preview" style="padding:24px 28px;">
      <div class="cp-header">
        <div>
          <div class="lbl">SAMPLE CHECKPOINT</div>
          <div class="title">Sample questions in preparation</div>
        </div>
        <div class="blurb">A representative set will appear here before this checkpoint goes live.</div>
      </div>
    </div>`;
    return;
  }
  const passing = Math.ceil(data.qs.length * 0.7);
  const cpState = { answers: {}, graded: false };

  function grade(qi) {
    const q = data.qs[qi];
    const a = cpState.answers[qi];
    if (a === undefined || a === "") return null;
    if (q.kind === "mcq") return a === q.answer;
    const norm = (s) => String(s).trim().toLowerCase().replace(/[()·]/g, "").replace(/\s+/g, "");
    if (norm(a) === norm(q.answer)) return true;
    if (q.accept) return q.accept.some((x) => norm(a) === norm(x));
    return false;
  }

  function renderQ(q, qi, result) {
    const cls = result === true ? "right" : result === false ? "wrong" : "";
    let body;
    if (q.kind === "mcq") {
      body = '<div class="cp-opts">' +
        q.opts.map((o, oi) => {
          const selected = cpState.answers[qi] === oi;
          const isAnswer = cpState.graded && oi === q.answer;
          const isWrong = cpState.graded && selected && oi !== q.answer;
          let optClass = "cp-opt" + (cpState.graded ? " locked" : "");
          if (isAnswer) optClass += " correct";
          else if (isWrong) optClass += " incorrect";
          else if (selected) optClass += " selected";
          return `<button type="button" class="${optClass}">${esc(o)}</button>`;
        }).join("") +
      "</div>";
    } else {
      const val = cpState.answers[qi] || "";
      body = '<div class="cp-text-row">' +
               `<input class="cp-input" type="text" placeholder="your answer in Greek" value="${esc(val)}"${cpState.graded ? " readonly" : ""}/>` +
               (cpState.graded
                 ? `<span class="cp-text-feedback ${result === true ? "right" : "wrong"}">${result === true ? "✓ " : "✗ "}correct: <span class="answer">${esc(q.answer)}</span></span>`
                 : "") +
             "</div>";
    }
    const hint = cpState.graded && q.hint
      ? `<div class="hint"><span class="note">note · </span>${esc(q.hint)}</div>`
      : "";
    return `<div class="cp-q ${cls}" data-q="${qi}">
              <div class="prompt"><span class="num">${qi + 1}.</span><span class="ptext">${esc(q.prompt)}</span></div>
              ${body}${hint}
            </div>`;
  }

  function paint() {
    const score = data.qs.reduce((s, _, i) => s + (grade(i) === true ? 1 : 0), 0);
    wrap.innerHTML =
      '<div class="checkpoint-preview">' +
        '<div class="cp-header">' +
          '<div>' +
            '<div class="lbl">SAMPLE CHECKPOINT · AUTO-GRADED</div>' +
            `<div class="title">${esc(data.title)}</div>` +
          '</div>' +
          `<div class="blurb">${esc(data.blurb)}</div>` +
        '</div>' +
        '<div class="cp-questions">' +
          data.qs.map((q, qi) => renderQ(q, qi, cpState.graded ? grade(qi) : null)).join("") +
        '</div>' +
        '<div class="cp-grade-row">' +
          (cpState.graded
            ? `<span class="cp-result ${score >= passing ? "pass" : "retake"}">${score >= passing ? "✓ PASSED" : "RETAKE NEEDED"} &nbsp;·&nbsp; <span class="lining">${score}</span> / <span class="lining">${data.qs.length}</span></span>` +
              '<button type="button" class="cp-reset">RESET</button>'
            : `<button type="button" class="cp-grade"${Object.keys(cpState.answers).length < data.qs.length ? ' disabled style="opacity:.45; cursor:not-allowed"' : ""}>GRADE MY ANSWERS</button>`) +
          `<span class="cp-threshold">${cpState.graded
            ? (score >= passing ? `Pass threshold: ${passing} of ${data.qs.length}.` : `Need ${passing} of ${data.qs.length} to pass.`)
            : `In the actual checkpoint, all ${data.qs.length} are graded together. Pass with ${passing} of ${data.qs.length}.`}</span>` +
        '</div>' +
      '</div>';

    // Wire question controls
    data.qs.forEach((q, qi) => {
      if (q.kind === "mcq") {
        wrap.querySelectorAll(`[data-q="${qi}"] .cp-opt`).forEach((b, oi) => {
          b.addEventListener("click", () => { if (!cpState.graded) { cpState.answers[qi] = oi; paint(); } });
        });
      } else {
        const inp = wrap.querySelector(`[data-q="${qi}"] .cp-input`);
        if (inp) inp.addEventListener("input", () => { cpState.answers[qi] = inp.value; });
      }
    });
    const gradeBtn = wrap.querySelector(".cp-grade");
    if (gradeBtn) gradeBtn.addEventListener("click", () => {
      data.qs.forEach((q, qi) => {
        if (q.kind === "type") {
          const inp = wrap.querySelector(`[data-q="${qi}"] .cp-input`);
          if (inp) cpState.answers[qi] = inp.value;
        }
      });
      if (Object.keys(cpState.answers).length < data.qs.length) return;
      cpState.graded = true;
      paint();
    });
    const resetBtn = wrap.querySelector(".cp-reset");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      cpState.answers = {}; cpState.graded = false; paint();
    });
  }

  paint();
}

// Play SVG = triangle; Pause SVG = double bars
const _PLAY_SVG  = '<svg viewBox="0 0 16 16" width="9" height="9"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>';
const _PAUSE_SVG = '<svg viewBox="0 0 16 16" width="9" height="9"><rect x="4" y="3" width="2.5" height="10" fill="currentColor"/><rect x="9.5" y="3" width="2.5" height="10" fill="currentColor"/></svg>';

// Single shared audio element so play-pills can stop each other.
let _currentAudio = null;
let _currentPill = null;

function resetPill(btn) {
  if (!btn) return;
  btn.classList.remove("playing");
  const glyph = btn.querySelector(".glyph");
  if (glyph) glyph.innerHTML = _PLAY_SVG;
  btn.querySelectorAll(".ring").forEach((r) => r.remove());
  clearTimeout(btn._timer);
}

function stopCurrentAudio() {
  if (_currentAudio) {
    try { _currentAudio.pause(); } catch {}
    _currentAudio = null;
  }
  if (_currentPill) {
    resetPill(_currentPill);
    _currentPill = null;
  }
}

function wirePlayPills(root) {
  (root || document).querySelectorAll(".play-pill").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      // If THIS pill is already playing, stop it.
      if (_currentPill === btn) {
        stopCurrentAudio();
        return;
      }
      // If a different pill is playing, stop it first.
      stopCurrentAudio();

      const text = btn.dataset.audioText || "";
      const lang = btn.dataset.audioLang || getLangFromPath();
      const glyph = btn.querySelector(".glyph");

      // Visual: switch to pause icon, add ring animation.
      btn.classList.add("playing");
      if (glyph) glyph.innerHTML = _PAUSE_SVG;
      const ring = document.createElement("span");
      ring.className = "ring";
      btn.appendChild(ring);

      // No text → short visual flourish only (graceful fallback).
      if (!text) {
        _currentPill = btn;
        btn._timer = setTimeout(() => {
          if (_currentPill === btn) stopCurrentAudio();
        }, 1200);
        return;
      }

      // Real audio via /api/word-audio/<lang>/<text>.mp3 (server-side TTS,
      // disk-cached, rate-limited). The endpoint synthesizes on miss and
      // streams on hit; an <audio> element is the simplest consumer.
      const url = `${BASE}/api/word-audio/${encodeURIComponent(lang)}/${encodeURIComponent(text)}.mp3`;
      const audio = new Audio(url);
      audio.preload = "auto";
      _currentAudio = audio;
      _currentPill = btn;

      // Hard timeout so a hung synth doesn't leave the pill stuck.
      btn._timer = setTimeout(() => {
        if (_currentPill === btn) stopCurrentAudio();
      }, 30000);

      audio.addEventListener("ended", () => {
        if (_currentPill === btn) stopCurrentAudio();
      });
      audio.addEventListener("error", () => {
        console.warn("[play-pill] audio error for", lang, text);
        if (_currentPill === btn) stopCurrentAudio();
      });

      audio.play().catch((err) => {
        console.warn("[play-pill] play() rejected:", err && err.message);
        if (_currentPill === btn) stopCurrentAudio();
      });
    });
  });
}
