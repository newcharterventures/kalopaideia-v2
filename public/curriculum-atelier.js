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

function getLangFromPath() {
  // /paideia/<lang>/curriculum
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[1] || "greek";
}

function applyPalette(lang) {
  const p = LANG_PALETTE[lang] || LANG_PALETTE.greek;
  const root = document.documentElement;
  // Hero
  const heroP = PAINTING[p.hero.key];
  root.style.setProperty("--hero-img", `url("${COMMONS(heroP.file, p.hero.w || 2000)}")`);
  document.getElementById("hero").style.backgroundPosition = p.hero.pos || "center 32%";
  document.getElementById("hero-credit").innerHTML = heroP.cred;
  document.getElementById("hero-lang").textContent = p.eyebrow;
  document.getElementById("hero-greek").textContent = p.greek;
  document.body.dataset.lang = lang;
  document.title = `${p.title} — Kalopaideia`;
  // Stage vignettes
  for (let i = 1; i <= 4; i++) {
    root.style.setProperty(`--vig-${i}`, img(p.vignettes[i]));
  }
  // Capstone portraits
  for (let i = 1; i <= 3; i++) {
    const t = p.tracks[i];
    root.style.setProperty(`--tk-${i}`, img(t.key));
    root.style.setProperty(`--tk-${i}-pos`, t.pos || "center");
  }
  // The cb-right link to the language's reading page
  const cbLink = document.getElementById("cb-langlink");
  if (cbLink) {
    cbLink.href = `/paideia/${lang}`;
    cbLink.textContent = `The ${p.eyebrow.split(" ").slice(-1)[0]} Library`;
  }
  return p;
}

// ============================================================
// Renderers
// ============================================================

function renderMetadata(manifest) {
  const stages = manifest.stages || [];
  const totalLessons = stages.reduce((n, s) => n + (s.lessons?.length || 0), 0);
  const checkpoints = stages.filter((s) => s.checkpoint).length;
  const tracksStage = stages.find((s) => s.tracks);
  const tracksCount = tracksStage?.tracks?.length || 0;
  document.getElementById("metadata-strip").innerHTML = `
    <div class="meta-cell"><div class="meta-label">Duration</div><div class="meta-value">${esc(manifest.duration_estimate || "—")}</div></div>
    <div class="meta-cell"><div class="meta-label">Effort</div><div class="meta-value">1 hour / day</div></div>
    <div class="meta-cell"><div class="meta-label">Lessons</div><div class="meta-value">${totalLessons} · ${checkpoints} checkpoint${checkpoints === 1 ? "" : "s"}</div></div>
    <div class="meta-cell"><div class="meta-label">Capstone</div><div class="meta-value">${tracksCount > 0 ? `<em>${tracksCount} tracks</em>` : "<em>1 reading</em>"}</div></div>
  `;
}

function renderPreface(manifest, palette) {
  const phil = manifest.philosophy || "";
  const sideKey = palette.vignettes[2] || "reading_homer";
  const sideCred = PAINTING[sideKey]?.cred || "";
  // Set the preface-plate background via a CSS custom property on :root,
  // matching how the other plates work. Inline `style="background-image: url(\"...\")"`
  // breaks the attribute when the URL contains commas/parens (Wikimedia URLs do),
  // because the inner double quotes terminate the style attribute. Custom
  // properties are set via CSSOM API and avoid this entirely.
  document.documentElement.style.setProperty("--preface-plate-img", img(sideKey));
  document.getElementById("preface-block").innerHTML = `
    <p class="preface">${esc(phil)}</p>
    <figure class="framed-plate">
      <div class="plate-img preface-plate-img"></div>
      <figcaption class="plate-caption">${esc(sideCred)}</figcaption>
    </figure>
  `;
}

function renderStages(manifest, lang, progress) {
  const stages = manifest.stages || [];
  const out = [];
  let activeStageNum = null;
  let nextLessonId = null;
  // Compute active stage = first incomplete stage
  for (const stage of stages) {
    const lessons = stage.lessons || [];
    const done = lessons.filter((l) => progress?.lessons?.[l.id]).length;
    if (done < lessons.length && lessons.length > 0) {
      activeStageNum = stage.number;
      const nextLesson = lessons.find((l) => !progress?.lessons?.[l.id]);
      if (nextLesson) nextLessonId = nextLesson.id;
      break;
    }
  }

  for (const stage of stages) {
    const isCapstone = !!stage.tracks;
    if (isCapstone) continue; // capstone block rendered separately
    const lessons = stage.lessons || [];
    const stageDone = lessons.filter((l) => progress?.lessons?.[l.id]).length;
    const allDone = stageDone === lessons.length && lessons.length > 0;
    const cpDone = progress?.checkpoints?.[stage.checkpoint?.id]?.passed;

    const stageNum = stage.number;
    out.push(`
      <div class="section-head" ${stageNum === 1 ? "" : 'style="margin-top:54px;"'}>
        <span class="section-num">§ ${roman(stageNum)}.</span>
        <h2 class="section-name">${esc(stage.name)}</h2>
        <span class="section-meta">${lessons.length} lessons · ${esc(stage.duration || "")}</span>
      </div>
      <p class="section-sub">${esc(stage.subtitle || "")}</p>
      <div class="stage-with-vignette">
        <table class="syllabus-table">
          <thead><tr><th></th><th>Lesson</th><th>Topic</th><th style="text-align:right;">Min.</th></tr></thead>
          <tbody>
            ${lessons.map((l) => {
              const done = !!progress?.lessons?.[l.id];
              const isNext = l.id === nextLessonId;
              const cls = done ? "done" : (isNext ? "next" : "");
              const check = done ? "✓" : (isNext ? "»" : "·");
              const titleHTML = done || isNext
                ? `<a href="${BASE}/${lang}/curriculum/${esc(l.id)}">${esc(l.title)}</a>`
                : esc(l.title);
              return `<tr class="${cls}"><td class="col-check">${check}</td><td class="col-num">${esc(stageRoman(stageNum))}.${esc(l.id.split('.')[1] || "")}</td><td class="col-title">${titleHTML}</td><td class="col-duration">${esc(l.duration || "—")}</td></tr>`;
            }).join("")}
            ${stage.checkpoint ? `
              <tr class="checkpoint-row ${cpDone ? "passed" : ""}">
                <td colspan="4">
                  <span class="cp-tag">Checkpoint ${roman(stageNum)}</span>
                  ${cpDone ? `passed on ${formatProgressDate(progress?.checkpoints?.[stage.checkpoint?.id])}` : (allDone ? `<a href="${BASE}/${lang}/curriculum/${esc(stage.checkpoint.id)}" style="color:var(--accent);text-decoration:underline;">take the checkpoint →</a>` : "opens upon completion")}
                </td>
              </tr>` : ""}
          </tbody>
        </table>
        <figure class="vignette v-stage${stageNum}">
          <div class="v-img"></div>
          <figcaption class="v-caption">${esc(stageCaption(stageNum, lang))}</figcaption>
        </figure>
      </div>
    `);
  }

  document.getElementById("stages-block").innerHTML = out.join("");

  // Continue strip — find the active lesson, show below the active stage's table
  if (nextLessonId) {
    const continueHtml = `
      <div class="continue">
        <div>
          <div class="continue-text"><em>Lesson ${esc(nextLessonId)}</em> — ${esc(findLessonTitle(manifest, nextLessonId))}</div>
          <div class="continue-meta">Pick up where you left off.</div>
        </div>
        <a href="${BASE}/${lang}/curriculum/${esc(nextLessonId)}" class="continue-link">Open</a>
      </div>`;
    // Insert after the active stage's table
    const tables = document.querySelectorAll("#stages-block .stage-with-vignette");
    if (tables[activeStageNum - 1]) {
      tables[activeStageNum - 1].insertAdjacentHTML("afterend", continueHtml);
    }
  } else if (!progress) {
    // Anonymous user — show a generic CTA in place of "continue"
    const tables = document.querySelectorAll("#stages-block .stage-with-vignette");
    if (tables[0]) {
      tables[0].insertAdjacentHTML("afterend", `
        <div class="continue signin-state">
          <div>
            <div class="continue-text">Sign in to track your progress.</div>
            <div class="continue-meta">$15.99 / month for everything — Library and Curriculum.</div>
          </div>
          <a href="${BASE}/account?next=${encodeURIComponent(location.pathname)}" class="continue-link">Sign in</a>
        </div>`);
    }
  }
}

function renderCapstone(manifest, lang) {
  const capstoneStage = manifest.stages?.find((s) => s.tracks);
  if (!capstoneStage) {
    // 3-stage diploma-in-reading languages — show single capstone CTA
    document.getElementById("capstone-banner-block").innerHTML = `
      <div class="capstone-eyebrow">The Capstone</div>
      <h2 class="capstone-name">The Reading</h2>
      <p class="capstone-sub">A sustained reading examination. Pass it and earn the Kalopaideia Diploma in Reading.</p>
    `;
    const trackKey = "1";
    document.getElementById("portraits-block").innerHTML = `
      <article class="portrait-card t1" style="max-width:380px;margin:0 auto;">
        <div class="portrait-frame"></div>
        <div class="portrait-info">
          <div class="portrait-roman">The Capstone</div>
          <h3 class="portrait-name">The Reading Examination</h3>
          <p class="portrait-text">Selected passages</p>
          <p class="portrait-rationale">Sight reading, parsing, and short comprehension questions, drawn from the texts you have studied in the course.</p>
        </div>
      </article>
    `;
    return;
  }

  document.getElementById("capstone-banner-block").innerHTML = `
    <div class="capstone-eyebrow">Stage V · The Capstone</div>
    <h2 class="capstone-name">${esc(capstoneStage.name || "The Author")}</h2>
    <p class="capstone-sub">${esc(capstoneStage.subtitle || "Sustained reading of a major author. Choose your track. Sit the examination. Earn the diploma.")}</p>
  `;
  const tracks = capstoneStage.tracks || [];
  const trackNames = ["philosopher", "historian", "evangelist"];
  document.getElementById("portraits-block").innerHTML = tracks.map((t, i) => `
    <article class="portrait-card t${i + 1} ${trackNames[i] || ""}">
      <div class="portrait-frame"></div>
      <div class="portrait-info">
        <div class="portrait-roman">Track ${roman(i + 1)}</div>
        <h3 class="portrait-name">${esc(t.name)}</h3>
        <p class="portrait-text">${esc(t.text)}</p>
        <p class="portrait-rationale">${esc(t.rationale || "")}</p>
      </div>
    </article>
  `).join("");
}

function renderTiers() {
  document.getElementById("tiers-block").innerHTML = `
    <h2>Membership</h2>
    <p class="t-sub">One price for everything — the Library, the Curriculum, the diploma.</p>
    <div class="tier-pair" style="grid-template-columns: 1fr; max-width: 540px; margin: 0 auto;">
      <div class="tier-col premium">
        <div class="tier-eyebrow">Kalopaideia · All Access</div>
        <div class="tier-price">$15.99 <span class="tier-per">/ month</span></div>
        <ul class="tier-features">
          <li class="feature-key">The Library — every book in every language</li>
          <li>The Akousma — line-by-line classical audio</li>
          <li>The daily word, in ten tongues</li>
          <li class="feature-key">The Curriculum — five-stage course in every language</li>
          <li>Auto-graded checkpoints and capstone</li>
          <li class="feature-key">On-chain diploma upon passage</li>
        </ul>
        <a href="${BASE}/akousma" class="tier-cta">Subscribe</a>
        <p style="font-family:var(--font-display);font-style:italic;color:var(--ink-muted);font-size:13px;text-align:center;margin-top:14px;">Cancel any time. Month to month. No annual lock-in.</p>
      </div>
    </div>
  `;
}

// ============================================================
// Helpers
// ============================================================

function findLessonTitle(manifest, id) {
  for (const stage of manifest.stages || []) {
    for (const l of stage.lessons || []) {
      if (l.id === id) return l.title;
    }
  }
  return id;
}

function roman(n) { return ["", "I", "II", "III", "IV", "V", "VI"][n] || String(n); }

function stageRoman(n) { return roman(n); }

function stageCaption(n, lang) {
  const p = LANG_PALETTE[lang] || LANG_PALETTE.greek;
  const key = p.vignettes[n];
  const cred = PAINTING[key]?.cred || "";
  // Trim the cred to fit caption length
  return cred.split(" · ")[0] || cred;
}

function formatProgressDate(checkpoint) {
  if (!checkpoint || !checkpoint.attempt_no) return "—";
  return `attempt ${checkpoint.attempt_no}`;
}

// ============================================================
// Main
// ============================================================

(async function init() {
  const lang = getLangFromPath();
  const palette = applyPalette(lang);
  document.getElementById("hero-title").textContent = palette.title;
  document.getElementById("hero-sub").innerHTML = `From the beginning to the masters, in five guided stages.`;

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
      <div style="text-align:center;padding:60px 24px;font-family:var(--font-display);font-style:italic;color:var(--ink-soft);">
        <p>The curriculum for this language is in preparation.</p>
        <p><a href="${BASE}/" style="color:var(--accent);">← Back to Kalopaideia</a></p>
      </div>`;
    return;
  }

  document.getElementById("hero-sub").innerHTML = esc(manifest.tagline || "From the beginning to the masters, in five guided stages.").replace(/—/g, "—");

  renderMetadata(manifest);
  renderPreface(manifest, palette);
  renderStages(manifest, lang, progress);
  renderCapstone(manifest, lang);
  renderTiers();
})();
