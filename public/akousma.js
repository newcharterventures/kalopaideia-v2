// Akousma audio-library promo cards — shared module used by app.js
// (homepage) and language.js (per-language pages). Single source of
// truth for AKOUSMA_BOOKS data and the renderAkousmaCard/fetchAkousmaCount
// helpers.
//
// Per Jae 2026-05-09: AKOUSMA_BOOKS is keyed by language and each value
// is an ARRAY of books, so language pages can rotate through different
// titles between word entries instead of repeating the same canonical
// book. The homepage's per-section card uses the FIRST entry (the
// canonical work). Translations and images are public-domain only.

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
      cover_src:    "/paideia/img/akousma/greek-iliad.jpg",
      cover_alt:    "Achilles and Ajax playing dice — Exekias, c. 540 BC",
      cover_title:  "The Iliad",
      cover_author: "Homer",
      lang_label:   "Greek",
      meta:         "611 lines · Pope, 1715–1720 · Public domain",
      title_html:   "<em>The Iliad</em>, Book I",
      author:       "Homer · with parallel English translation by Alexander Pope",
      blurb:        "Listen to the opening of Western literature in its original Greek — line by line, with Pope's heroic-couplet translation alongside. Fifteen hours of audio, the full Book I, every line read by a voice tuned for the Homeric line.",
      credits:      "Cover: Achilles and Ajax playing dice, Attic black-figure amphora signed by Exekias, c. 540 BC. Vatican Museums (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/John_William_Waterhouse_-_Ulysses_and_the_Sirens_-_Google_Art_Project.jpg/1280px-John_William_Waterhouse_-_Ulysses_and_the_Sirens_-_Google_Art_Project.jpg",
      cover_alt:    "Ulysses and the Sirens — Waterhouse, 1891",
      cover_title:  "The Odyssey",
      cover_author: "Homer",
      lang_label:   "Greek",
      meta:         "444 lines · Butler, 1900 · Public domain",
      title_html:   "<em>The Odyssey</em>, Book 1",
      author:       "Homer · with parallel English prose translation by Samuel Butler",
      blurb:        "The opening of the Odyssey — Athena begs the gods to send Odysseus home; Telemachus comes of age in Ithaca. Hear the Homeric Greek with Samuel Butler's celebrated 1900 prose translation.",
      credits:      "Cover: Ulysses and the Sirens by John William Waterhouse, 1891. National Gallery of Victoria, Melbourne (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Plato%27s_Academy_mosaic_from_Pompeii.jpg/1280px-Plato%27s_Academy_mosaic_from_Pompeii.jpg",
      cover_alt:    "Plato's Academy mosaic from Pompeii, 1st century",
      cover_title:  "The Republic",
      cover_author: "Plato",
      lang_label:   "Greek",
      meta:         "755 lines · Jowett, 1871 · Public domain",
      title_html:   "<em>The Republic</em>, Book 1",
      author:       "Plato · with parallel English translation by Benjamin Jowett",
      blurb:        "Socrates walks down to the Piraeus and falls into a conversation that becomes the foundational dialogue of Western philosophy. Justice, the just life, the city as the soul writ large. Stephanus pagination 327a–354c.",
      credits:      "Cover: Plato's Academy mosaic from Pompeii, c. 1st century BCE. National Archaeological Museum, Naples (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/The_so-called_Sappho_portrait%2C_Pompeii_%28AD_45-79%29.jpg/1280px-The_so-called_Sappho_portrait%2C_Pompeii_%28AD_45-79%29.jpg",
      cover_alt:    "The so-called Sappho portrait, Pompeii fresco, AD 45–79",
      cover_title:  "Hymn to Aphrodite",
      cover_author: "Sappho of Lesbos",
      lang_label:   "Greek",
      meta:         "4 lines · Wharton, 1885 · Public domain",
      title_html:   "<em>Fragment 1</em> — Hymn to Aphrodite",
      author:       "Sappho · with parallel English translation by Henry T. Wharton",
      blurb:        "The only complete Sapphic poem to survive antiquity. Hear the opening four lines in their Aeolic Greek — the goddess invoked, the metre that bears her name, the voice of the lyric tradition's headwaters.",
      credits:      "Cover: The so-called Sappho portrait, Pompeii fresco c. AD 45–79. Naples Museum (PD).",
    },
  ],
  latin: [
    {
      cover_src:    "/paideia/img/akousma/latin-aeneid.jpg",
      cover_alt:    "Vergilius Romanus, folio 234v",
      cover_title:  "Aeneid",
      cover_author: "Virgil",
      lang_label:   "Latin",
      meta:         "756 lines · Dryden, 1697 · Public domain",
      title_html:   "<em>The Aeneid</em>, Book I",
      author:       "Publius Vergilius Maro · with parallel English translation by John Dryden",
      blurb:        "Hear the opening of the Roman epic spoken in its native dactylic hexameter, with Dryden's 1697 verse translation read alongside. Each line carries a brief grammatical note for the student.",
      credits:      "Cover: Vergilius Romanus, folio 234v — a fifth-century Latin manuscript of the Aeneid. Vatican Library (PD).",
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
      credits:      "Cover: Catullus Reading His Poems At Lesbia's House, Sir Lawrence Alma-Tadema, 1870 (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Cicero_Denounces_Catiline_in_the_Roman_Senate_by_Cesare_Maccari.png/1280px-Cicero_Denounces_Catiline_in_the_Roman_Senate_by_Cesare_Maccari.png",
      cover_alt:    "Cicero Denounces Catiline — Cesare Maccari, 1888",
      cover_title:  "In Catilinam I",
      cover_author: "Cicero",
      lang_label:   "Latin",
      meta:         "10 lines · Yonge, 1856 · Public domain",
      title_html:   "<em>In Catilinam</em> I — Opening (§1–2)",
      author:       "Marcus Tullius Cicero · with parallel English translation by C. D. Yonge",
      blurb:        "\"Quousque tandem abutere, Catilina, patientia nostra?\" The most famous opening in Roman oratory — Cicero rising in the Senate, November 8, 63 BCE, exposing the conspiracy that would have toppled the Republic.",
      credits:      "Cover: Cicero Denounces Catiline in the Roman Senate, Cesare Maccari, 1888. Palazzo Madama, Rome (PD).",
    },
  ],
  french: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/b/bf/Danse_macabre_by_Michael_Wolgemut.png",
      cover_alt:    "Danse Macabre, Wolgemut, 1493",
      cover_title:  "Ballade des pendus",
      cover_author: "François Villon",
      lang_label:   "French",
      meta:         "20 lines · Payne, 1878 · Public domain",
      title_html:   "<em>Ballade des pendus</em>",
      author:       "François Villon · with parallel English translation by John Payne",
      blurb:        "The hanged poet's letter to the living — late-medieval French at its most ferocious. Hear each tercet read in the rhythm Villon set down in 1462, with Payne's 1878 translation alongside.",
      credits:      "Cover: Danse Macabre, woodcut by Michael Wolgemut from the Nuremberg Chronicle, 1493 (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/2/2e/Pierre_de_Ronsard_%28Blois%29.jpg",
      cover_alt:    "Pierre de Ronsard portrait, Château de Blois",
      cover_title:  "Mignonne, allons voir",
      cover_author: "Pierre de Ronsard",
      lang_label:   "French",
      meta:         "6 lines · public-domain crib · Public domain",
      title_html:   "<em>Mignonne, allons voir si la rose</em>",
      author:       "Pierre de Ronsard · 1553 · with a public-domain English crib",
      blurb:        "The most famous carpe-diem stanza in the French language. Ronsard at his most musical, the ode \"À Cassandre\" that every French schoolchild has memorized for four centuries.",
      credits:      "Cover: Portrait of Pierre de Ronsard, anonymous, Château de Blois (PD).",
    },
  ],
  german: [
    {
      cover_src:    "/paideia/img/akousma/german-erlkonig.jpg",
      cover_alt:    "Erlkönig — Schwind, c. 1830",
      cover_title:  "Erlkönig",
      cover_author: "Goethe",
      lang_label:   "German",
      meta:         "32 lines · Bowring, 1853 · Public domain",
      title_html:   "<em>Erlkönig</em>",
      author:       "Johann Wolfgang von Goethe · with parallel English translation by Edgar Alfred Bowring",
      blurb:        "Goethe's 1782 ballad of the alder-king who claims a child on a midnight ride — the most famous lyric in German Romanticism. Each voice in the dialogue read by a separate reader.",
      credits:      "Cover: Erlkönig, oil on canvas by Moritz von Schwind, c. 1830 — Belvedere, Vienna (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/f/f6/Loreley.jpg",
      cover_alt:    "The Lorelei rock on the Rhine",
      cover_title:  "Die Lorelei",
      cover_author: "Heinrich Heine",
      lang_label:   "German",
      meta:         "8 lines · Bowring, 1859 · Public domain",
      title_html:   "<em>Die Lorelei</em>",
      author:       "Heinrich Heine · with parallel English translation by Edgar Alfred Bowring",
      blurb:        "\"Ich weiß nicht, was soll es bedeuten…\" Heine's 1824 ballad of the siren on the Rhine — the most beloved poem in German Romanticism, set to music by Friedrich Silcher and sung as a folksong for two centuries.",
      credits:      "Cover: The Lorelei rock on the middle Rhine (Loreley) — photograph by Georg Dahlhoff (CC BY-SA 2.0 DE).",
    },
  ],
  italian: [
    {
      cover_src:    "/paideia/img/akousma/italian-inferno.jpg",
      cover_alt:    "La Carte de l'Enfer — Botticelli, c. 1485",
      cover_title:  "Inferno, Canto I",
      cover_author: "Dante Alighieri",
      lang_label:   "Italian",
      meta:         "36 lines · Longfellow, 1867 · Public domain",
      title_html:   "<em>Inferno</em>, Canto I",
      author:       "Dante Alighieri · with parallel English translation by Henry Wadsworth Longfellow",
      blurb:        "\"Nel mezzo del cammin di nostra vita…\" — the dark wood, the sunlit hill, the leopard. Hear the opening of the Commedia in Tuscan terza rima with Longfellow's terza-rima translation read alongside.",
      credits:      "Cover: La Carte de l'Enfer (Map of Hell), silverpoint and ink by Sandro Botticelli, c. 1485. Vatican Library (PD).",
    },
  ],
  oldenglish: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Sutton_Hoo_helmet_2016.png/800px-Sutton_Hoo_helmet_2016.png",
      cover_alt:    "Sutton Hoo helmet",
      cover_title:  "Beowulf, Prologue",
      cover_author: "Anonymous",
      lang_label:   "Olde English",
      meta:         "21 lines · Gummere, 1910 · Public domain",
      title_html:   "<em>Beowulf</em>, Prologue",
      author:       "Anonymous · with parallel English translation by Francis B. Gummere",
      blurb:        "\"Hwæt!\" — the alliterative opening of the great Anglo-Saxon epic, as it would have sounded in the mead-hall: stressed half-lines, caesuras, and a kenning every other phrase. Gummere's 1910 alliterative verse translation alongside.",
      credits:      "Cover: Sutton Hoo helmet, early seventh-century Anglo-Saxon — British Museum, London (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Beowulf_Cotton_MS_Vitellius_A_XV_f._132r.jpg/1280px-Beowulf_Cotton_MS_Vitellius_A_XV_f._132r.jpg",
      cover_alt:    "Beowulf manuscript folio — Cotton Vitellius A.xv",
      cover_title:  "The Wanderer",
      cover_author: "Anonymous",
      lang_label:   "Olde English",
      meta:         "34 lines · Earle, 1892 · Public domain",
      title_html:   "<em>The Wanderer</em>",
      author:       "Anonymous · Exeter Book · with parallel English translation by John Earle",
      blurb:        "The exile's lament — the most studied elegy in Olde English. \"Where is the horse gone? Where the rider? Where the giver of treasure?\" Earle's 1892 prose translation alongside the alliterative original.",
      credits:      "Cover: Beowulf manuscript folio, Cotton MS Vitellius A.xv, c. 1000 CE. British Library (PD).",
    },
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Whitby_Abbey_image.jpg/1280px-Whitby_Abbey_image.jpg",
      cover_alt:    "Whitby Abbey ruins — Caedmon's monastery",
      cover_title:  "Cædmon's Hymn",
      cover_author: "Cædmon",
      lang_label:   "Olde English",
      meta:         "9 lines · Earle, 1892 · Public domain",
      title_html:   "<em>Cædmon's Hymn</em>",
      author:       "Cædmon (as preserved by Bede) · with parallel English translation by John Earle",
      blurb:        "The earliest Olde English poem we possess — composed at Whitby Abbey by an illiterate cowherd around 658–680 CE. Bede tells the story of the angel who taught him to sing of Creation in his own tongue.",
      credits:      "Cover: Whitby Abbey ruins — the seventh-century monastery where Cædmon composed his Hymn. North Yorkshire (PD).",
    },
  ],
  middleenglish: [
    {
      cover_src:    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/The_Knight_-_Ellesmere_Chaucer.jpg/800px-The_Knight_-_Ellesmere_Chaucer.jpg",
      cover_alt:    "The Knight, Ellesmere Manuscript",
      cover_title:  "Canterbury Tales",
      cover_author: "Geoffrey Chaucer",
      lang_label:   "Middle English",
      meta:         "42 lines · after Skeat, 1894 · Public domain",
      title_html:   "<em>The Canterbury Tales</em>, General Prologue",
      author:       "Geoffrey Chaucer · with parallel English crib after Skeat's edition",
      blurb:        "\"Whan that Aprille with his shoures soote…\" — the most famous opening in English literature, read with the final-e schwa, the rolled rhotic r, the sounded gh: the language as Chaucer's audience heard it, c. 1387.",
      credits:      "Cover: The Knight, Ellesmere Manuscript of the Canterbury Tales, c. 1410 — Huntington Library, San Marino (PD).",
    },
  ],
};

// Render the Akousma promo card. Per Jae 2026-05-09: pages can pass an
// `index` to rotate through the language's book list; languages with one
// book just always show that one. The homepage's per-section card uses
// index 0 (the canonical book per language). Language pages pass an
// incrementing index per word entry so each promo slot shows a different
// title from the same language's Akousma library.
function renderAkousmaCard(langKey, index) {
  const list = AKOUSMA_BOOKS[langKey];
  if (!list || !list.length) return "";
  const i = (typeof index === "number" && index >= 0)
    ? (index % list.length)
    : 0;
  const b = list[i];
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
