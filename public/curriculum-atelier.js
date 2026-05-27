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
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[1] || "greek";
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
        <a class="lesson-row ${li === 0 ? 'first' : ''} ${isLessonCurrent ? 'current' : ''}" href="/paideia/${esc(lang)}/curriculum/${esc(lesson.id || '')}">
          <span class="id-cell">${idIcon} ${esc(lesson.id || '')}</span>
          <span class="title-cell">${esc(lesson.title || '')}${badge}</span>
          <span class="min-cell">${minutes}</span>
          <span class="toggle">›</span>
        </a>`;
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
                </div>` : ''}
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
})();

// ===================================================================
// AUDIO TEASER ("Hear the course opening")
// ===================================================================
// Per-language opening passage shown in the hero, ported from
// paideia-prototype-v2/curriculum.html. The play-pill is a visual
// affordance only — a 2.2s animation — until real audio is wired.
const COURSE_OPENINGS = {
  greek: {
    line: "ἄνδρα μοι ἔννεπε, μοῦσα…",
    caption: "Hear the opening of the Odyssey — read aloud in restored classical pronunciation.",
  },
};

function renderAudioTeaser(lang) {
  const wrap = document.getElementById("audio-teaser");
  if (!wrap) return;
  const data = COURSE_OPENINGS[lang];
  if (!data) return; // leave hidden for languages without a vetted opening
  document.getElementById("teaser-line").textContent = data.line;
  document.getElementById("teaser-caption").textContent = data.caption;
  wrap.style.display = "";
}

function wirePlayPills(root) {
  (root || document).querySelectorAll(".play-pill").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const playing = btn.classList.toggle("playing");
      const glyph = btn.querySelector(".glyph");
      if (!glyph) return;
      glyph.innerHTML = playing
        ? '<svg viewBox="0 0 16 16" width="9" height="9"><rect x="4" y="3" width="2.5" height="10" fill="currentColor"/><rect x="9.5" y="3" width="2.5" height="10" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 16 16" width="9" height="9"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>';
      btn.querySelectorAll(".ring").forEach((r) => r.remove());
      if (playing) {
        const ring = document.createElement("span");
        ring.className = "ring";
        btn.appendChild(ring);
        clearTimeout(btn._timer);
        btn._timer = setTimeout(() => {
          btn.classList.remove("playing");
          ring.remove();
          glyph.innerHTML =
            '<svg viewBox="0 0 16 16" width="9" height="9"><path d="M4.5 2.6v10.8L13 8z" fill="currentColor"/></svg>';
        }, 2200);
      }
    });
  });
}
