// Akousma audio-library promo cards — shared module used by app.js
// (homepage) and language.js (per-language pages).
//
// Per Jae 2026-05-12: cover/blurb data now comes from the LIVE library
// via /api/akousma/cards, NOT from the hardcoded AKOUSMA_BOOKS constant
// below. AKOUSMA_BOOKS is kept as a fallback if the fetch fails, but in
// normal operation the akousma cards render from the same source of
// truth as the language Library tab: data/library/library-meta.json.
//
// Render call order at page load:
//   1. fetchAkousmaCards() runs early and populates window.__AKOUSMA_LIVE.
//   2. renderAkousmaCard(lang, idx) reads __AKOUSMA_LIVE when available,
//      otherwise falls back to AKOUSMA_BOOKS.
//   3. fetchAkousmaCount() updates the per-card '[count] works' span.
//
// Per Jae 2026-05-09: AKOUSMA_BOOKS is keyed by language and each value
// is an ARRAY of books so language pages can rotate through different
// titles. The live API currently returns the first work per language
// (the canonical book) — if Jae wants per-entry rotation later, the
// /api/akousma/cards response can carry the full list.
// Translations and images are public-domain only.

if (typeof esc === 'undefined') {
  window.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
}

const AKOUSMA_BOOKS = {
  greek: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Jean_Auguste_Dominique_Ingres%2C_Apotheosis_of_Homer%2C_1827.jpg/1280px-Jean_Auguste_Dominique_Ingres%2C_Apotheosis_of_Homer%2C_1827.jpg",
      cover_alt:    "The Apotheosis of Homer — Ingres, 1827",
      cover_title:  "The Iliad",
      cover_author: "Homer",
      lang_label:   "Greek",
      meta:         "611 lines · Pope, 1715–1720 · Public domain",
      title_html:   "<em>The Iliad</em>, Book I",
      author:       "Homer · with parallel English translation by Alexander Pope",
      blurb:        "Listen to the opening of Western literature in its original Greek — line by line, with Pope's heroic-couplet translation alongside. Fifteen hours of audio, the full Book I, every line read by a voice tuned for the Homeric line.",
      credits:      "Cover: The Apotheosis of Homer by Jean-Auguste-Dominique Ingres, 1827. Louvre, Paris (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/1/1b/Pinturicchio%2C_Return_of_Odysseus.jpg",
      cover_alt:    "The Return of Odysseus — Pinturicchio, 1509",
      cover_title:  "The Odyssey",
      cover_author: "Homer",
      lang_label:   "Greek",
      meta:         "444 lines · Butler, 1900 · Public domain",
      title_html:   "<em>The Odyssey</em>, Book 1",
      author:       "Homer · with parallel English prose translation by Samuel Butler",
      blurb:        "The opening of the Odyssey — Athena begs the gods to send Odysseus home; Telemachus comes of age in Ithaca. Hear the Homeric Greek with Samuel Butler's celebrated 1900 prose translation.",
      credits:      "Cover: The Return of Odysseus by Pinturicchio (Bernardino di Betto), 1509. National Gallery, London (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/1280px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg",
      cover_alt:    "The School of Athens — Raphael, 1509–1511",
      cover_title:  "The Republic",
      cover_author: "Plato",
      lang_label:   "Greek",
      meta:         "755 lines · Jowett, 1871 · Public domain",
      title_html:   "<em>The Republic</em>, Book 1",
      author:       "Plato · with parallel English translation by Benjamin Jowett",
      blurb:        "Socrates walks down to the Piraeus and falls into a conversation that becomes the foundational dialogue of Western philosophy. Justice, the just life, the city as the soul writ large. Stephanus pagination 327a–354c.",
      credits:      "Cover: The School of Athens by Raphael, 1509–1511. Stanza della Segnatura, Vatican (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Godward-In_the_Days_of_Sappho-1904.jpg/1280px-Godward-In_the_Days_of_Sappho-1904.jpg",
      cover_alt:    "In the Days of Sappho — John William Godward, 1904",
      cover_title:  "Hymn to Aphrodite",
      cover_author: "Sappho of Lesbos",
      lang_label:   "Greek",
      meta:         "4 lines · Wharton, 1885 · Public domain",
      title_html:   "<em>Fragment 1</em> — Hymn to Aphrodite",
      author:       "Sappho · with parallel English translation by Henry T. Wharton",
      blurb:        "The only complete Sapphic poem to survive antiquity. Hear the opening four lines in their Aeolic Greek — the goddess invoked, the metre that bears her name, the voice of the lyric tradition's headwaters.",
      credits:      "Cover: In the Days of Sappho by John William Godward, 1904. J. Paul Getty Museum, Los Angeles (PD).",
    },
  ],
  latin: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/The_Roses_of_Heliogabalus.jpg/1280px-The_Roses_of_Heliogabalus.jpg",
      cover_alt:    "The Roses of Heliogabalus — Lawrence Alma-Tadema, 1888",
      cover_title:  "Aeneid",
      cover_author: "Virgil",
      lang_label:   "Latin",
      meta:         "756 lines · Dryden, 1697 · Public domain",
      title_html:   "<em>The Aeneid</em>, Book I",
      author:       "Publius Vergilius Maro · with parallel English translation by John Dryden",
      blurb:        "Hear the opening of the Roman epic spoken in its native dactylic hexameter, with Dryden's 1697 verse translation read alongside. Each line carries a brief grammatical note for the student.",
      credits:      "Cover: The Roses of Heliogabalus by Sir Lawrence Alma-Tadema, 1888. Private collection / Pérez Simón Collection, Mexico City (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/3/3f/Catullus_Reading_His_Poems_At_Lesbia%27s_House%2C_1870.jpg",
      cover_alt:    "Catullus Reading His Poems At Lesbia's House — Alma-Tadema, 1870",
      cover_title:  "Carmen 85",
      cover_author: "Catullus",
      lang_label:   "Latin",
      meta:         "2 lines · Burton, 1894 · Public domain",
      title_html:   "<em>Carmen 85</em> — Odi et amo",
      author:       "Gaius Valerius Catullus · with parallel English translation by Sir Richard F. Burton",
      blurb:        "Two lines. Fourteen words. The most concentrated lyric in Latin literature: \"I hate and I love. Why do I do it, perhaps you ask? I do not know, but I feel it being done, and I am tortured.\"",
      credits:      "Cover: Catullus Reading His Poems At Lesbia's House by Sir Lawrence Alma-Tadema, 1870 (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Lawrence_Alma-Tadema_A_Roman_Art_Lover_1.jpg/1280px-Lawrence_Alma-Tadema_A_Roman_Art_Lover_1.jpg",
      cover_alt:    "An Audience at Agrippa's — Lawrence Alma-Tadema, 1875",
      cover_title:  "In Catilinam I",
      cover_author: "Cicero",
      lang_label:   "Latin",
      meta:         "10 lines · Yonge, 1856 · Public domain",
      title_html:   "<em>In Catilinam</em> I — Opening (§1–2)",
      author:       "Marcus Tullius Cicero · with parallel English translation by C. D. Yonge",
      blurb:        "\"Quousque tandem abutere, Catilina, patientia nostra?\" The most famous opening in Roman oratory — Cicero rising in the Senate, November 8, 63 BCE, exposing the conspiracy that would have toppled the Republic.",
      credits:      "Cover: An Audience at Agrippa's by Sir Lawrence Alma-Tadema, 1875. Dick Institute, Kilmarnock (PD).",
    },
  ],
  french: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/e/eb/Pierre_Auguste_Renoir_-_Roses_and_Jasmine_in_a_Delft_Vase_%2815740534374%29.jpg",
      cover_alt:    "Roses and Jasmine in a Delft Vase — Pierre-Auguste Renoir",
      cover_title:  "Ballade des pendus",
      cover_author: "François Villon",
      lang_label:   "French",
      meta:         "20 lines · Payne, 1878 · Public domain",
      title_html:   "<em>Ballade des pendus</em>",
      author:       "François Villon · with parallel English translation by John Payne",
      blurb:        "The hanged poet's letter to the living — late-medieval French at its most ferocious. Hear each tercet read in the rhythm Villon set down in 1462, with Payne's 1878 translation alongside.",
      credits:      "Cover: Roses and Jasmine in a Delft Vase by Pierre-Auguste Renoir (1841–1919) (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Eugene_Henri_Cauchois_Stillleben_mit_Rosen_in_einer_Schale.jpg/1280px-Eugene_Henri_Cauchois_Stillleben_mit_Rosen_in_einer_Schale.jpg",
      cover_alt:    "Still Life with Roses in a Bowl — Eugène Henri Cauchois",
      cover_title:  "Mignonne, allons voir",
      cover_author: "Pierre de Ronsard",
      lang_label:   "French",
      meta:         "6 lines · public-domain crib · Public domain",
      title_html:   "<em>Mignonne, allons voir si la rose</em>",
      author:       "Pierre de Ronsard · 1553 · with a public-domain English crib",
      blurb:        "The most famous carpe-diem stanza in the French language. Ronsard at his most musical, the ode \"À Cassandre\" that every French schoolchild has memorized for four centuries.",
      credits:      "Cover: Still Life with Roses in a Bowl by Eugène Henri Cauchois (1850–1911) (PD).",
    },
  ],
  german: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Flaming_June%2C_by_Frederic_Lord_Leighton_%281830-1896%29.jpg/1280px-Flaming_June%2C_by_Frederic_Lord_Leighton_%281830-1896%29.jpg",
      cover_alt:    "Flaming June — Frederic, Lord Leighton, 1895",
      cover_title:  "Erlkönig",
      cover_author: "Goethe",
      lang_label:   "German",
      meta:         "32 lines · Bowring, 1853 · Public domain",
      title_html:   "<em>Erlkönig</em>",
      author:       "Johann Wolfgang von Goethe · with parallel English translation by Edgar Alfred Bowring",
      blurb:        "Goethe's 1782 ballad of the alder-king who claims a child on a midnight ride — the most famous lyric in German Romanticism. Each voice in the dialogue read by a separate reader.",
      credits:      "Cover: Flaming June by Frederic, Lord Leighton, 1895. Museo de Arte de Ponce, Puerto Rico (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Hans_Thoma_-_Sommer_-_Google_Art_Project.jpg/1280px-Hans_Thoma_-_Sommer_-_Google_Art_Project.jpg",
      cover_alt:    "Sommer (Summer) — Hans Thoma, 1872",
      cover_title:  "Die Lorelei",
      cover_author: "Heinrich Heine",
      lang_label:   "German",
      meta:         "8 lines · Bowring, 1859 · Public domain",
      title_html:   "<em>Die Lorelei</em>",
      author:       "Heinrich Heine · with parallel English translation by Edgar Alfred Bowring",
      blurb:        "\"Ich weiß nicht, was soll es bedeuten…\" Heine's 1824 ballad of the siren on the Rhine — the most beloved poem in German Romanticism, set to music by Friedrich Silcher and sung as a folksong for two centuries.",
      credits:      "Cover: Sommer (Summer) by Hans Thoma, 1872. Alte Nationalgalerie, Berlin (PD).",
    },
  ],
  italian: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/6/6a/Henry_Holiday_-_Dante_meets_Beatrice.jpg",
      cover_alt:    "Dante and Beatrice — Henry Holiday, 1883",
      cover_title:  "Inferno, Canto I",
      cover_author: "Dante Alighieri",
      lang_label:   "Italian",
      meta:         "36 lines · Longfellow, 1867 · Public domain",
      title_html:   "<em>Inferno</em>, Canto I",
      author:       "Dante Alighieri · with parallel English translation by Henry Wadsworth Longfellow",
      blurb:        "\"Nel mezzo del cammin di nostra vita…\" — the dark wood, the sunlit hill, the leopard. Hear the opening of the Commedia in Tuscan terza rima with Longfellow's terza-rima translation read alongside.",
      credits:      "Cover: Dante and Beatrice by Henry Holiday, 1883. Walker Art Gallery, Liverpool (PD).",
    },
  ],
  oldenglish: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Edmund_blair_leighton_accolade.jpg/1280px-Edmund_blair_leighton_accolade.jpg",
      cover_alt:    "The Accolade — Edmund Blair Leighton, 1901",
      cover_title:  "Beowulf, Prologue",
      cover_author: "Anonymous",
      lang_label:   "Olde English",
      meta:         "21 lines · Gummere, 1910 · Public domain",
      title_html:   "<em>Beowulf</em>, Prologue",
      author:       "Anonymous · with parallel English translation by Francis B. Gummere",
      blurb:        "\"Hwæt!\" — the alliterative opening of the great Anglo-Saxon epic, as it would have sounded in the mead-hall: stressed half-lines, caesuras, and a kenning every other phrase. Gummere's 1910 alliterative verse translation alongside.",
      credits:      "Cover: The Accolade by Edmund Blair Leighton, 1901 (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/f/ff/Music_Lesson_by_Lord_Frederic_Leighton.jpg",
      cover_alt:    "The Music Lesson — Frederic, Lord Leighton, 1877",
      cover_title:  "The Wanderer",
      cover_author: "Anonymous",
      lang_label:   "Olde English",
      meta:         "34 lines · Earle, 1892 · Public domain",
      title_html:   "<em>The Wanderer</em>",
      author:       "Anonymous · Exeter Book · with parallel English translation by John Earle",
      blurb:        "The exile's lament — the most studied elegy in Olde English. \"Where is the horse gone? Where the rider? Where the giver of treasure?\" Earle's 1892 prose translation alongside the alliterative original.",
      credits:      "Cover: The Music Lesson by Frederic, Lord Leighton, 1877. Guildhall Art Gallery, London (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Alma_Tadema_Spring.jpg/1280px-Alma_Tadema_Spring.jpg",
      cover_alt:    "Spring — Lawrence Alma-Tadema, 1894",
      cover_title:  "Cædmon's Hymn",
      cover_author: "Cædmon",
      lang_label:   "Olde English",
      meta:         "9 lines · Earle, 1892 · Public domain",
      title_html:   "<em>Cædmon's Hymn</em>",
      author:       "Cædmon (as preserved by Bede) · with parallel English translation by John Earle",
      blurb:        "The earliest Olde English poem we possess — composed at Whitby Abbey by an illiterate cowherd around 658–680 CE. Bede tells the story of the angel who taught him to sing of Creation in his own tongue.",
      credits:      "Cover: Spring by Sir Lawrence Alma-Tadema, 1894. J. Paul Getty Museum, Los Angeles (PD).",
    },
  ],
  middleenglish: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Ford_Madox_Brown_-_Chaucer_at_the_court_of_Edward_III_-_Google_Art_Project.jpg/1280px-Ford_Madox_Brown_-_Chaucer_at_the_court_of_Edward_III_-_Google_Art_Project.jpg",
      cover_alt:    "Chaucer at the Court of Edward III — Ford Madox Brown, 1847–1851",
      cover_title:  "Canterbury Tales",
      cover_author: "Geoffrey Chaucer",
      lang_label:   "Middle English",
      meta:         "42 lines · after Skeat, 1894 · Public domain",
      title_html:   "<em>The Canterbury Tales</em>, General Prologue",
      author:       "Geoffrey Chaucer · with parallel English crib after Skeat's edition",
      blurb:        "\"Whan that Aprille with his shoures soote…\" — the most famous opening in English literature, read with the final-e schwa, the rolled rhotic r, the sounded gh: the language as Chaucer's audience heard it, c. 1387.",
      credits:      "Cover: Chaucer at the Court of Edward III by Ford Madox Brown, 1847–1851. Art Gallery of New South Wales (PD).",
    },
  ],
};

// Render the Akousma promo card. Per Jae 2026-05-09: pages can pass an
// `index` to rotate through the language's book list; languages with one
// book just always show that one. The homepage's per-section card uses
// index 0 (the canonical book per language). Language pages pass an
// incrementing index per word entry so each promo slot shows a different
// title from the same language's Akousma library.
// Per Jae 2026-05-12: pull live library data from /api/akousma/cards so
// the akousma promo card always shows the same cover the Library tab
// shows. Cached on window.__AKOUSMA_LIVE so the fetch runs once.
async function fetchAkousmaCards() {
  if (window.__AKOUSMA_LIVE && window.__AKOUSMA_LIVE.__loaded) return window.__AKOUSMA_LIVE;
  try {
    const r = await fetch("/paideia/api/akousma/cards", { credentials: "same-origin" });
    if (!r.ok) return null;
    const j = await r.json();
    const live = j.by_language || {};
    live.__loaded = true;
    window.__AKOUSMA_LIVE = live;
    return live;
  } catch (_) {
    return null;
  }
}
window.fetchAkousmaCards = fetchAkousmaCards;

// Convert a /api/akousma/cards entry to the shape renderAkousmaCard expects.
// Live entries don't have lang_label / cover_title / cover_author / title_html
// / author / blurb / credits / meta as separate fields — we synthesize them.
function __liveToBook(card) {
  if (!card) return null;
  const langLabels = {
    greek: "Greek", latin: "Latin", french: "French", german: "German",
    italian: "Italian", oldenglish: "Old English", middleenglish: "Middle English",
    welsh: "Welsh", oldnorse: "Old Norse", gaulish: "Gaulish",
  };
  const translatorStr = card.translator
    ? `${card.translator}${card.translator_date ? ", " + card.translator_date : ""}`
    : "public domain";
  return {
    cover_src:    card.cover_src || "",
    cover_alt:    card.cover_alt || card.title || "",
    cover_title:  card.title || "",
    cover_author: card.author || "",
    lang_label:   langLabels[card.language] || card.language || "",
    meta:         `${card.lines_count} lines · ${translatorStr} · Public domain`,
    title_html:   card.title ? `<em>${esc(card.title).replace(/&amp;mdash;|&mdash;/g,'—')}</em>` : "",
    author:       card.author ? `${card.author}${card.translator ? " · parallel English translation by " + card.translator : ""}` : "",
    blurb:        card.blurb || "",
    credits:      card.cover_credits ? `Cover: ${card.cover_credits}` : "",
  };
}

function renderAkousmaCard(langKey, index) {
  // Prefer LIVE library data when available (window.__AKOUSMA_LIVE was
  // populated by fetchAkousmaCards()). Fall back to AKOUSMA_BOOKS only
  // if the fetch hasn't completed yet or returned no entry for this lang.
  let b = null;
  const live = window.__AKOUSMA_LIVE;
  if (live && live[langKey] && live[langKey].length) {
    const list = live[langKey];
    const i = (typeof index === "number" && index >= 0) ? (index % list.length) : 0;
    b = __liveToBook(list[i]);
  }
  if (!b) {
    const list = AKOUSMA_BOOKS[langKey];
    if (!list || !list.length) return "";
    const i = (typeof index === "number" && index >= 0) ? (index % list.length) : 0;
    b = list[i];
  }
  return `
    <aside class="akousma-ad">
      <div class="akousma-inner">
        <div class="akousma-eyebrow">
          <span class="alpha">Α</span>
          Akousma <span class="pipe">·</span> The Audio Library
        </div>
        <div class="akousma-row">
          <div class="akousma-cover">
            <article class="ako-cover">
              <div class="ako-cover-imprint">Akousma</div>
              <div class="ako-cover-vignette">
                <img src="${esc(b.cover_src)}" alt="${esc(b.cover_alt)}" loading="lazy" />
              </div>
              <div class="ako-cover-rule"></div>
              <h4 class="ako-cover-title">${esc(b.cover_title)}</h4>
              <div class="ako-cover-author">${esc(b.cover_author)}</div>
            </article>
          </div>
          <div class="akousma-copy">
            <div class="akousma-meta"><span class="lang">${esc(b.lang_label)}</span> · ${esc(b.meta)}</div>
            <h3 class="akousma-title">${b.title_html}</h3>
            <p class="akousma-author">${esc(b.author)}</p>
            <p class="akousma-blurb">${esc(b.blurb)}</p>
            <p class="akousma-credits">${esc(b.credits)}</p>
          </div>
          <div class="akousma-cta">
            <div class="akousma-cta-eyebrow">Full Library Access</div>
            <div class="akousma-cta-price"><span>$</span>11<span class="cents">.99</span></div>
            <div class="akousma-cta-period">per month · cancel anytime</div>
            <form method="POST" action="/paideia/checkout/all-access" style="margin:0;">
              <button class="akousma-cta-button" type="submit">Begin Listening →</button>
            </form>
            <p class="akousma-cta-fineprint"><span class="count" data-akousma-count>—</span> works in the library across all seven languages.</p>
          </div>
        </div>
      </div>
    </aside>
  `;
}

// Fetch the live total works count from /paideia/api/library/all and
// inject it into every [data-akousma-count] span across the page.
async function fetchAkousmaCount() {
  const els = document.querySelectorAll("[data-akousma-count]");
  if (!els.length) return;
  try {
    const r = await fetch("/paideia/api/library/all");
    if (!r.ok) return;
    const j = await r.json();
    if (typeof j.total !== "number") return;
    els.forEach((el) => { el.textContent = String(j.total); });
  } catch {}
}
