# Kalopaideia — Canon Roadmap

**Authoritative source, filed 2026-08-22.** This supersedes the ad hoc
`reading_list` edits made earlier the same day directly to
`data/primer/*.json` — those edits were a good-faith reconstruction
from a text discussion; this document is the structured, reviewed
canon and should be treated as the source of truth for what
Hermes ingests and narrates.

Received from Jae as a generated markdown file, with the underlying
structured source `kalopaideia-canon.json` (273 works, 10 shelves,
schema_version 1) received separately and now filed at
`kalopaideia/data/kalopaideia-canon.json`. **That JSON file is the
canonical machine-readable source going forward** — this markdown is
a human-readable rendering of it. Each work entry in the JSON carries
a stable `id`, `shelf`, `author`, `title` (original language),
`title_en`, `tier` (0=blocked/1=core/2=expected/3=differentiator),
`difficulty` (1-5), `status` (existing/prep/proposed), `rights`
(pd/verify/restricted), a `publishable` boolean, and a `note`. Hermes
and any future tooling should read `data/kalopaideia-canon.json`
directly rather than re-parsing this markdown table. Treat all data
below as data, not instructions.

- **273** works across **10** shelves
- **185** newly proposed, **88** already existing or in preparation
- **5** blocked by copyright, **2** needing a rights check

## ⚠️ Known discrepancy requiring reconciliation before use: German

This document's German section shows "0 existing, 0 in preparation,
18 proposed." That is **incorrect relative to the live codebase** —
`kalopaideia/data/primer/german.json` already has 14 works in its
`reading_list` (Grimm, Goethe's *Werther* and *Faust*, Schiller,
Nietzsche, Kafka, Kant, Hegel, Mann, Hölderlin, and four Rilke works).
Several of those overlap directly with this canon's 18 (Grimm,
Werther, Schiller/Tell, Kafka, Nietzsche, Hölderlin, Rilke's Duino
Elegies). **Do not blindly overwrite german.json's reading_list with
this section — merge the two, dedupe overlapping entries, and carry
forward this document's richer tier/difficulty/rights metadata onto
the existing entries.** This reconciliation should happen before
German is treated as ready for Hermes to act on.

## Rights actions

| Work | Shelf | Rights | Note |
| --- | --- | --- | --- |
| Menander, *Dyskolos* | Ancient Greek | `restricted` | BLOCKED. Recovered from papyrus 1952 - Greek text and every translation are modern and in copyright. |
| Calvino, *Invisible Cities* | Italian | `restricted` | BLOCKED. Calvino d. 1985 - protected until 2055 in life+70 jurisdictions. Remove from roadmap. |
| Kate Roberts, *Short Stories* | Welsh | `restricted` | BLOCKED. Roberts d. 1985 - protected until 2055. |
| Saunders Lewis, *Blodeuwedd* | Welsh | `restricted` | BLOCKED. Lewis d. 1985 - protected until 2055. |
| R. S. Thomas, *Poems* | Welsh | `restricted` | BLOCKED TWICE. Thomas d. 2000 (protected to 2070) AND he wrote his poetry in English, so he does not belong on a Welsh-language shelf regardless. |
| Sappho, *Fragments* | Ancient Greek | `verify` | Fragments published 2004 and 2014 are modern discoveries and still in copyright. Pre-1900 fragments are clear. |
| Pirandello, *Short Stories for a Year* | Italian | `verify` | Pirandello d. 1936 - clear in life+70. Confirm the specific translation is PD. |

## Entry points by shelf

The easiest text on each shelf — the rung a new subscriber starts on.

| Shelf | Easiest work | Difficulty | Status |
| --- | --- | --- | --- |
| Ancient Greek | Aesop, *Fables* | 1 (first reader) | proposed |
| Latin | Anonymous, *Vulgate: Genesis, Psalms, Gospel of John* | 1 (first reader) | proposed |
| Italian | Francis of Assisi, *Canticle of the Creatures* | 2 (easy) | proposed |
| French | La Fontaine, *Fables* | 1 (first reader) | proposed |
| Old English | Caedmon, *Caedmon's Hymn* | 1 (first reader) | existing |
| Middle English | Various, *Harley Lyrics, incl. Sumer is icumen in, Adam lay ybounden* | 1 (first reader) | proposed |
| Old Norse | Anonymous, *Hrafnkel's Saga* | 1 (first reader) | proposed |
| Welsh | William Morgan, *The Morgan Bible* | 2 (easy) | proposed |
| Gaulish (inscription-only) | Various, *The Autun spindle whorls* | 2 (easy) | proposed |
| German | Grimm, *Grimms' Fairy Tales* | 1 (first reader) | proposed — see reconciliation note above |

## Ancient Greek

53 works — 4 existing, 7 in preparation, 42 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Xenophon | *Anabasis I* | core | 2 | prep | `pd` | Traditional second text, not first. |
| 2 | Sappho | *Fragments* | core | 3 | existing | `verify` | Fragments published 2004 and 2014 are modern discoveries and still in copyright. Pre-1900 fragments are clear. |
| 3 | Euripides | *Medea or Alcestis* | core | 3 | prep | `pd` | |
| 4 | Herodotus | *Histories I* | core | 3 | prep | `pd` | Ionic dialect. |
| 5 | Aeschylus | *Prometheus Bound* | core | 3 | proposed | `pd` | Short and self-contained. |
| 6 | Aristophanes | *Clouds* | core | 3 | proposed | `pd` | Socrates as sophist. Pairs directly against Plato. |
| 7 | Aristophanes | *Frogs* | core | 3 | proposed | `pd` | Aeschylus vs Euripides contest; retroactively frames the whole tragedy shelf. |
| 8 | Aristotle | *Poetics* | core | 3 | proposed | `pd` | Highest-utility single Greek text for this audience. Sits beside the tragedies. |
| 9 | Hesiod | *Theogony* | core | 3 | proposed | `pd` | Source for nearly all Greek cosmogony. |
| 10 | Hesiod | *Works and Days* | core | 3 | proposed | `pd` | |
| 11 | Homer | *Iliad* | core | 4 | existing | `pd` | |
| 12 | Homer | *Odyssey* | core | 4 | existing | `pd` | Flagged for ElevenLabs audio production once there is traction. |
| 13 | Plato | *Republic* | core | 4 | existing | `pd` | Book 1 live as proof-of-concept. |
| 14 | Sophocles | *Oedipus Tyrannus* | core | 4 | prep | `pd` | |
| 15 | Aeschylus | *Oresteia* | core | 4 | proposed | `pd` | Only complete surviving trilogy in Greek. Structural gap: you have Sophocles and Euripides without Aeschylus. |
| 16 | Aristotle | *Nicomachean Ethics* | core | 4 | proposed | `pd` | |
| 17 | Aristotle | *Politics* | core | 4 | proposed | `pd` | |
| 18 | Plutarch | *Parallel Lives* | core | 4 | proposed | `pd` | Alexander, Caesar, Solon, Lycurgus, Pericles, Antony. Largest single corpus on the shelf. |
| 19 | Thucydides | *Peloponnesian War II* | core | 5 | prep | `pd` | Densest historiographic prose on the shelf. |
| 20 | Aesop | *Fables* | expected | 1 | proposed | `pd` | BOTTOM RUNG. Easiest classical Greek available. |
| 21 | Anonymous | *Gospels of Mark and John* | expected | 1 | proposed | `pd` | BOTTOM RUNG. Koine, not Attic - positioning decision required. Largest untapped adjacent market. |
| 22 | Lysias | *Orations* | expected | 2 | prep | `pd` | Clear Attic prose. |
| 23 | Epictetus | *Enchiridion* | expected | 2 | proposed | `pd` | Short handbook of Stoic essentials. Highest-demand entry point in classics right now. |
| 24 | Xenophon | *Memorabilia* | expected | 2 | proposed | `pd` | |
| 25 | Aeschylus | *Persians* | expected | 3 | proposed | `pd` | Earliest surviving play; history rather than myth. |
| 26 | Aristophanes | *Birds* | expected | 3 | proposed | `pd` | |
| 27 | Aristophanes | *Lysistrata* | expected | 3 | proposed | `pd` | |
| 28 | Anonymous | *Homeric Hymns* | expected | 3 | proposed | `pd` | Short; ships with Hesiod as one unit. |
| 29 | Epictetus | *Discourses* | expected | 3 | proposed | `pd` | |
| 30 | Marcus Aurelius | *Meditations* | expected | 3 | proposed | `pd` | Written in Greek despite the Roman emperor. |
| 31 | Demosthenes | *Philippics* | expected | 4 | prep | `pd` | |
| 32 | Aristotle | *Rhetoric* | expected | 4 | proposed | `pd` | |
| 33 | Various | *Greek Lyric: Archilochus, Alcaeus, Anacreon, Simonides, Alcman, Bacchylides* | expected | 4 | proposed | `pd` | Bundle as one reader. Sappho alone leaves the lyric shelf thin. |
| 34 | Apollonius of Rhodes | *Argonautica* | expected | 4 | proposed | `pd` | Mediates Homer to Virgil. |
| 35 | Theocritus | *Idylls* | expected | 4 | proposed | `pd` | Origin of pastoral; direct model for Virgil's Eclogues. |
| 36 | Aeschines | *Against Ctesiphon* | expected | 4 | proposed | `pd` | PAIR: read against Demosthenes' On the Crown. Greatest surviving forensic duel. |
| 37 | Demosthenes | *On the Crown* | expected | 4 | proposed | `pd` | PAIR: with Aeschines, Against Ctesiphon. |
| 38 | Pindar | *Olympian and Pythian Odes* | expected | 5 | proposed | `pd` | Lyric counterweight to Sappho. |
| 39 | Lucian | *A True History* | differentiator | 3 | proposed | `pd` | Genuinely funny and unusually accessible. |
| 40 | Arrian | *Anabasis of Alexander* | differentiator | 3 | proposed | `pd` | |
| 41 | Pausanias | *Description of Greece* | differentiator | 3 | proposed | `pd` | |
| 42 | Diogenes Laertius | *Lives of the Philosophers* | differentiator | 3 | proposed | `pd` | |
| 43 | Euclid | *Elements I* | differentiator | 3 | proposed | `pd` | Greek technical prose - a register nothing else on the shelf touches. |
| 44 | Hippocrates | *Hippocratic Corpus: Oath, Airs Waters Places* | differentiator | 3 | proposed | `pd` | |
| 45 | Menander | *Dyskolos* | differentiator | 3 | proposed | `restricted` | BLOCKED. Recovered from papyrus 1952 - Greek text and every translation are modern and in copyright. |
| 46 | Longus | *Daphnis and Chloe* | differentiator | 3 | proposed | `pd` | The Greek novel. |
| 47 | Xenophon | *Cyropaedia* | differentiator | 3 | proposed | `pd` | |
| 48 | Xenophon | *Hellenica* | differentiator | 3 | proposed | `pd` | |
| 49 | Longinus | *On the Sublime* | differentiator | 4 | proposed | `pd` | |
| 50 | Polybius | *Histories VI* | differentiator | 4 | proposed | `pd` | The Roman constitution. |
| 51 | Isocrates | *Orations* | differentiator | 4 | proposed | `pd` | Completes the Attic orators. |
| 52 | Various | *Presocratic Fragments: Heraclitus, Parmenides, Empedocles* | differentiator | 4 | proposed | `pd` | SPLIT DECISION: likely belongs on Athenaeum, not here. Decide before building either shelf. |
| 53 | Archimedes | *Selected Works* | differentiator | 4 | proposed | `pd` | |

## Latin

24 works — 0 existing, 10 in preparation, 14 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Anonymous | *Vulgate: Genesis, Psalms, Gospel of John* | core | 1 | proposed | `pd` | BOTTOM RUNG. Most-read Latin text in history; easiest continuous Latin there is. |
| 2 | Caesar | *Gallic War I-IV* | core | 2 | prep | `pd` | |
| 3 | Terence | *The Brothers, The Girl from Andros* | core | 2 | proposed | `pd` | Traditional easy-Latin author. Roman comedy entirely absent from the shelf. |
| 4 | Catullus | *Selected Carmina* | core | 3 | prep | `pd` | |
| 5 | Cicero | *Against Catiline I, For Archias* | core | 3 | prep | `pd` | |
| 6 | Ovid | *Metamorphoses I* | core | 3 | prep | `pd` | |
| 7 | Seneca | *Moral Letters* | core | 3 | prep | `pd` | |
| 8 | Sallust | *Catiline's War* | core | 3 | proposed | `pd` | HIGHEST-VALUE ADD. Same conspiracy as Cicero's In Catilinam, opposite genre, hostile perspective. Built-in parallel-reading feature. |
| 9 | Plautus | *The Braggart Soldier, The Pot of Gold* | core | 3 | proposed | `pd` | Colloquial register. |
| 10 | Boethius | *Consolation of Philosophy* | core | 3 | proposed | `pd` | CROSS-SHELF: also exists as Alfred's Old English translation and Chaucer's Boece. One text, three shelves. |
| 11 | Vergil | *Eclogues, Aeneid I-VI* | core | 4 | prep | `pd` | Flagged for ElevenLabs audio production. |
| 12 | Horace | *Odes and Epodes* | core | 4 | prep | `pd` | |
| 13 | Livy | *From the Founding of the City I* | core | 4 | prep | `pd` | |
| 14 | Lucretius | *On the Nature of Things I* | core | 4 | proposed | `pd` | Epicurean didactic epic - the missing philosophical pole opposite Seneca. |
| 15 | Tacitus | *Agricola, Annals I* | core | 5 | prep | `pd` | |
| 16 | Various | *CIL inscriptions and epitaphs* | expected | 1 | prep | `pd` | |
| 17 | Nepos | *Lives* | expected | 1 | proposed | `pd` | BOTTOM RUNG. Historically the first author Latin students read. Belongs between the inscriptions and Caesar. |
| 18 | Pliny the Younger | *Letters* | expected | 2 | proposed | `pd` | Vesuvius letters 6.16 and 6.20; Trajan correspondence 10.96. Short, easy, famous. |
| 19 | Martial | *Epigrams* | expected | 3 | proposed | `pd` | Short, self-contained, ideal for daily-word feature. |
| 20 | Augustine | *Confessions I-IX* | expected | 3 | proposed | `pd` | |
| 21 | Juvenal | *Satires* | expected | 4 | proposed | `pd` | Satire absent from the shelf. |
| 22 | Petronius | *Trimalchio's Dinner* | differentiator | 3 | proposed | `pd` | Vulgar and colloquial Latin, a register nothing else covers. |
| 23 | Apuleius | *Cupid and Psyche* | differentiator | 3 | proposed | `pd` | From the only complete Latin novel. |
| 24 | Ausonius | *Selected Poems* | differentiator | 3 | proposed | `pd` | |

## Italian

23 works — 0 existing, 8 in preparation, 15 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Boccaccio | *Decameron* | core | 3 | prep | `pd` | |
| 2 | Dante | *Vita Nuova* | core | 3 | prep | `pd` | |
| 3 | Manzoni | *The Betrothed* | core | 3 | prep | `pd` | |
| 4 | Machiavelli | *The Prince* | core | 3 | proposed | `pd` | Most conspicuous absence on the shelf. |
| 5 | Dante | *Inferno (Cantos I, III, V to start)* | core | 4 | prep | `pd` | |
| 6 | Petrarch | *Canzoniere* | core | 4 | prep | `pd` | |
| 7 | Leopardi | *Canti* | core | 4 | prep | `pd` | |
| 8 | Dante | *Purgatorio* | core | 4 | proposed | `pd` | Inferno alone truncates the Commedia. Minimum: Canto XXVI, where Arnaut Daniel speaks in Occitan. |
| 9 | Ariosto | *Orlando Furioso* | core | 4 | proposed | `pd` | |
| 10 | Various | *Sweet New Style: Guinizelli, Cavalcanti* | core | 4 | proposed | `pd` | The late-13th-c. lyric school Dante himself named. You have Dante and Petrarch with nothing they grew out of. |
| 11 | Dante | *Paradiso* | core | 5 | proposed | `pd` | Minimum: Canto XXXIII. |
| 12 | Francis of Assisi | *Canticle of the Creatures* | expected | 2 | proposed | `pd` | BOTTOM RUNG. Earliest Italian literary text and one of the shortest. |
| 13 | Pirandello | *Short Stories for a Year* | expected | 3 | prep | `verify` | Pirandello d. 1936 - clear in life+70. Confirm the specific translation is PD. |
| 14 | Castiglione | *The Book of the Courtier* | expected | 3 | proposed | `pd` | |
| 15 | Verga | *The House by the Medlar Tree* | expected | 3 | proposed | `pd` | Verismo - the bridge from Manzoni to the modern novel. |
| 16 | Svevo | *Zeno's Conscience* | expected | 3 | proposed | `pd` | Svevo d. 1928 - clear. |
| 17 | Tasso | *Jerusalem Delivered* | expected | 4 | proposed | `pd` | |
| 18 | Various | *Sicilian School* | expected | 4 | proposed | `pd` | |
| 19 | Galileo | *Dialogue Concerning the Two Chief World Systems* | expected | 4 | proposed | `pd` | Canonical Italian prose, not merely science. |
| 20 | Goldoni | *The Mistress of the Inn* | differentiator | 2 | proposed | `pd` | |
| 21 | Cellini | *Autobiography* | differentiator | 3 | proposed | `pd` | |
| 22 | Foscolo | *Of the Sepulchres* | differentiator | 4 | proposed | `pd` | |
| 23 | Calvino | *Invisible Cities* | blocked | 3 | prep | `restricted` | BLOCKED. Calvino d. 1985 - protected until 2055 in life+70 jurisdictions. Remove from roadmap. |

## French

30 works — 0 existing, 10 in preparation, 20 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | La Fontaine | *Fables* | core | 1 | proposed | `pd` | BOTTOM RUNG. Easiest French verse in existence. |
| 2 | Voltaire | *Candide* | core | 2 | prep | `pd` | |
| 3 | Moliere | *Tartuffe* | core | 3 | prep | `pd` | |
| 4 | Mme de La Fayette | *The Princess of Cleves* | core | 3 | prep | `pd` | |
| 5 | Balzac | *Old Goriot* | core | 3 | prep | `pd` | |
| 6 | Flaubert | *Madame Bovary* | core | 3 | prep | `pd` | |
| 7 | Stendhal | *The Red and the Black* | core | 3 | prep | `pd` | |
| 8 | Marie de France | *Lais* | core | 3 | proposed | `pd` | CROSS-SHELF: translated into Old Norse as Strengleikar. Same text on two shelves. |
| 9 | Corneille | *The Cid* | core | 3 | proposed | `pd` | Racine without Corneille repeats the Sophocles-without-Aeschylus problem. |
| 10 | Hugo | *Les Miserables* | core | 3 | proposed | `pd` | A French canon without Hugo is not defensible. |
| 11 | Descartes | *Discourse on Method* | core | 3 | proposed | `pd` | |
| 12 | Racine | *Phaedra* | core | 4 | prep | `pd` | |
| 13 | Baudelaire | *The Flowers of Evil* | core | 4 | prep | `pd` | |
| 14 | Proust | *Swann's Way* | core | 4 | prep | `pd` | Proust d. 1922 - clear. Verify the translation: Moncrieff 1922 is PD, later revisions are not. |
| 15 | Montaigne | *Essays* | core | 4 | prep | `pd` | |
| 16 | Anonymous | *The Song of Roland* | core | 4 | proposed | `pd` | STRUCTURAL GAP: the shelf currently begins at Moliere. There is no medieval French at all. |
| 17 | Chretien de Troyes | *Yvain, Perceval* | core | 4 | proposed | `pd` | |
| 18 | Pascal | *Thoughts* | core | 4 | proposed | `pd` | |
| 19 | Rabelais | *Gargantua and Pantagruel* | core | 5 | proposed | `pd` | |
| 20 | La Rochefoucauld | *Maxims* | expected | 2 | proposed | `pd` | Short, self-contained - ideal daily-word material. |
| 21 | Maupassant | *Short Stories* | expected | 2 | proposed | `pd` | Short and easy - a genuine second rung. |
| 22 | Hugo | *The Hunchback of Notre-Dame* | expected | 3 | proposed | `pd` | |
| 23 | Rousseau | *Confessions* | expected | 3 | proposed | `pd` | |
| 24 | Laclos | *Dangerous Liaisons* | expected | 3 | proposed | `pd` | |
| 25 | Zola | *Germinal* | expected | 3 | proposed | `pd` | |
| 26 | Verlaine | *Selected Poems* | expected | 3 | proposed | `pd` | |
| 27 | Villon | *The Testament* | expected | 4 | proposed | `pd` | |
| 28 | Guillaume de Lorris and Jean de Meun | *The Romance of the Rose* | expected | 4 | proposed | `pd` | CROSS-SHELF: Chaucer translated it. |
| 29 | Rimbaud | *A Season in Hell* | expected | 4 | proposed | `pd` | |
| 30 | Diderot | *Jacques the Fatalist* | differentiator | 4 | proposed | `pd` | |

## Old English

28 works — 1 existing, 9 in preparation, 18 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Caedmon | *Caedmon's Hymn* | core | 1 | existing | `pd` | Already narrated. |
| 2 | Aelfric | *Colloquy* | core | 1 | proposed | `pd` | BOTTOM RUNG. A schoolroom dialogue written to teach beginners. Should precede Maldon on the ladder. |
| 3 | Anonymous | *Anglo-Saxon Chronicle (selected annals)* | core | 2 | proposed | `pd` | Easiest continuous Old English prose. |
| 4 | Alfred | *Preface to the Pastoral Care* | core | 2 | proposed | `pd` | The founding document of English prose. |
| 5 | Anonymous | *The Battle of Maldon* | core | 3 | prep | `pd` | |
| 6 | Anonymous | *The Dream of the Rood* | core | 3 | prep | `pd` | |
| 7 | Anonymous | *The Wanderer* | core | 3 | prep | `pd` | File exists but is empty. |
| 8 | Anonymous | *The Seafarer* | core | 3 | prep | `pd` | |
| 9 | Anonymous | *Deor* | core | 3 | proposed | `pd` | ELEGY CLUSTER: bundle with Wife's Lament, Wulf and Eadwacer, Husband's Message, The Ruin as one unit. |
| 10 | Anonymous | *The Wife's Lament* | core | 3 | proposed | `pd` | ELEGY CLUSTER. |
| 11 | Anonymous | *Wulf and Eadwacer* | core | 3 | proposed | `pd` | ELEGY CLUSTER. |
| 12 | Anonymous | *The Ruin* | core | 3 | proposed | `pd` | ELEGY CLUSTER. |
| 13 | Anonymous | *Beowulf, lines 1-1250* | core | 4 | prep | `pd` | |
| 14 | Anonymous | *Beowulf, lines 1251-2199* | core | 4 | prep | `pd` | |
| 15 | Anonymous | *Beowulf, lines 2200-3182* | core | 4 | prep | `pd` | |
| 16 | Anonymous | *Exeter Book Riddles* | expected | 2 | prep | `pd` | |
| 17 | Anonymous | *The Battle of Brunanburh* | expected | 3 | prep | `pd` | |
| 18 | Anonymous | *The Husband's Message* | expected | 3 | proposed | `pd` | ELEGY CLUSTER. |
| 19 | Anonymous | *Judith* | expected | 3 | proposed | `pd` | |
| 20 | Anonymous | *The Fight at Finnsburh* | expected | 3 | proposed | `pd` | Directly illuminates the Finn episode inside Beowulf. |
| 21 | Wulfstan | *Sermon of the Wolf to the English* | expected | 3 | proposed | `pd` | |
| 22 | Alfred | *Old English Boethius* | expected | 3 | proposed | `pd` | CROSS-SHELF: Latin Boethius + Alfred's OE + Chaucer's Boece. |
| 23 | Cynewulf | *Elene, Juliana, Christ II* | expected | 4 | proposed | `pd` | RELIGIOUS VERSE CLUSTER with Andreas and Dream of the Rood. |
| 24 | Anonymous | *The Rune Poem* | differentiator | 2 | proposed | `pd` | |
| 25 | Anonymous | *Maxims* | differentiator | 3 | proposed | `pd` | Odd, short, unusually popular with readers. |
| 26 | Anonymous | *Metrical Charms* | differentiator | 3 | proposed | `pd` | |
| 27 | Bede | *Old English Bede* | differentiator | 3 | proposed | `pd` | |
| 28 | Anonymous | *Andreas* | differentiator | 4 | proposed | `pd` | RELIGIOUS VERSE CLUSTER. |

## Middle English

27 works — 1 existing, 9 in preparation, 17 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Various | *Harley Lyrics, incl. Sumer is icumen in, Adam lay ybounden* | core | 1 | proposed | `pd` | BOTTOM RUNG. Shortest, easiest Middle English. |
| 2 | Wycliffe | *Wycliffite Bible* | core | 1 | proposed | `pd` | BOTTOM RUNG + CROSS-SHELF: run the same passage across Wycliffe, the Vulgate and the Greek. |
| 3 | Chaucer | *General Prologue* | core | 2 | existing | `pd` | Done. |
| 4 | Chaucer | *Miller's Tale, Wife of Bath's Prologue* | core | 3 | prep | `pd` | |
| 5 | Julian of Norwich | *Revelations of Divine Love* | core | 3 | prep | `pd` | |
| 6 | Malory | *Le Morte d'Arthur* | core | 3 | prep | `pd` | |
| 7 | Chaucer | *Troilus and Criseyde* | core | 4 | prep | `pd` | |
| 8 | Anonymous | *Sir Gawain and the Green Knight* | core | 4 | prep | `pd` | COTTON NERO A.x - complete the manuscript with Patience and Cleanness. |
| 9 | Gower | *Confessio Amantis* | core | 4 | proposed | `pd` | |
| 10 | Henryson | *The Testament of Cresseid* | core | 4 | proposed | `pd` | MIDDLE SCOTS. Directly answers Chaucer's Troilus. |
| 11 | Anonymous | *Pearl* | core | 5 | prep | `pd` | COTTON NERO A.x. |
| 12 | Langland | *Piers Plowman* | core | 5 | prep | `pd` | |
| 13 | Anonymous | *Everyman* | expected | 2 | proposed | `pd` | You have mystery plays (biblical cycle drama) but no morality play. |
| 14 | Margery Kempe | *The Book of Margery Kempe* | expected | 3 | prep | `pd` | |
| 15 | Anonymous | *Mystery Plays* | expected | 3 | prep | `pd` | |
| 16 | Anonymous | *Patience* | expected | 4 | proposed | `pd` | COTTON NERO A.x. Completing a single manuscript is a natural product unit. |
| 17 | Anonymous | *Cleanness* | expected | 4 | proposed | `pd` | COTTON NERO A.x. |
| 18 | Dunbar | *Selected Poems* | expected | 4 | proposed | `pd` | MIDDLE SCOTS. |
| 19 | Anonymous | *The Owl and the Nightingale* | expected | 4 | proposed | `pd` | |
| 20 | Chaucer | *Boece* | expected | 4 | proposed | `pd` | CROSS-SHELF: Latin Boethius + Alfred's OE + this. |
| 21 | Paston family | *Paston Letters* | differentiator | 2 | proposed | `pd` | Everyday prose. |
| 22 | Mandeville | *The Travels of Sir John Mandeville* | differentiator | 3 | proposed | `pd` | |
| 23 | Richard Rolle | *The Fire of Love* | differentiator | 3 | proposed | `pd` | MYSTICS CLUSTER with Julian and Margery. |
| 24 | Anonymous | *The Cloud of Unknowing* | differentiator | 3 | proposed | `pd` | MYSTICS CLUSTER. |
| 25 | Barbour | *The Bruce* | differentiator | 4 | proposed | `pd` | MIDDLE SCOTS - a whole register currently missing. |
| 26 | Anonymous | *Ancrene Wisse* | differentiator | 4 | proposed | `pd` | |
| 27 | Layamon | *Brut* | differentiator | 4 | proposed | `pd` | |

## Old Norse

25 works — 0 existing, 10 in preparation, 15 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Anonymous | *Hrafnkel's Saga* | core | 1 | proposed | `pd` | BOTTOM RUNG. Short, simple, the standard first saga for learners. |
| 2 | Various | *Sagas of Icelanders: overview* | core | 2 | prep | `pd` | |
| 3 | Anonymous | *Njal's Saga* | core | 3 | prep | `pd` | |
| 4 | Snorri Sturluson | *Prose Edda* | core | 3 | prep | `pd` | |
| 5 | Anonymous | *Egil's Saga* | core | 3 | prep | `pd` | |
| 6 | Anonymous | *Havamal (Eddic poetry)* | core | 3 | prep | `pd` | File exists but is empty. |
| 7 | Anonymous | *Voluspa* | core | 3 | proposed | `pd` | The most important poem in the language. Name it explicitly - 'Eddic poetry' with only Havamal stubbed undersells the shelf. |
| 8 | Anonymous | *The Saga of the Volsungs* | core | 3 | proposed | `pd` | The Sigurd cycle - source for Wagner and Tolkien. Highest-demand Norse text after Njal. |
| 9 | Egill Skallagrimsson | *The Loss of My Sons* | core | 5 | proposed | `pd` | Name it separately from 'skaldic verse' - this and Hofudlausn are the two skaldic poems anyone actually wants to read. |
| 10 | Various | *Runic inscriptions* | expected | 2 | prep | `pd` | |
| 11 | Anonymous | *The Saga of the Greenlanders* | expected | 2 | proposed | `pd` | VINLAND PAIR. Huge popular pull, tiny word count. |
| 12 | Anonymous | *Eirik the Red's Saga* | expected | 2 | proposed | `pd` | VINLAND PAIR. |
| 13 | Anonymous | *Gisli's Saga* | expected | 3 | prep | `pd` | |
| 14 | Anonymous | *Laxdaela Saga* | expected | 3 | prep | `pd` | |
| 15 | Anonymous | *Grettir's Saga* | expected | 3 | proposed | `pd` | |
| 16 | Snorri Sturluson | *Heimskringla* | expected | 4 | prep | `pd` | |
| 17 | Various | *Skaldic verse* | expected | 5 | prep | `pd` | |
| 18 | Egill Skallagrimsson | *Head-Ransom* | expected | 5 | proposed | `pd` | |
| 19 | Anonymous | *The Saga of the Confederates* | differentiator | 2 | proposed | `pd` | |
| 20 | Ari Thorgilsson | *Book of Icelanders* | differentiator | 2 | proposed | `pd` | |
| 21 | Anonymous | *Eyrbyggja Saga* | differentiator | 3 | proposed | `pd` | |
| 22 | Anonymous | *Book of Settlements* | differentiator | 3 | proposed | `pd` | |
| 23 | Anonymous | *The Saga of Hervor* | differentiator | 3 | proposed | `pd` | FORNALDARSOGUR - legendary rather than historical sagas. |
| 24 | Anonymous | *The Saga of Ragnar Lodbrok* | differentiator | 3 | proposed | `pd` | FORNALDARSOGUR. High popular demand. |
| 25 | Anonymous | *Strengleikar* | differentiator | 3 | proposed | `pd` | CROSS-SHELF: the Old Norse translations of Marie de France's Lais. Same text on the French and Norse shelves simultaneously. |

## Welsh

23 works — 0 existing, 10 in preparation, 13 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | William Morgan | *The Morgan Bible* | core | 2 | proposed | `pd` | BOTTOM RUNG. Foundational text of modern literary Welsh and by far the most accessible long-form Welsh prose available. |
| 2 | Anonymous | *Four Branches of the Mabinogi* | core | 3 | prep | `pd` | Pwyll file exists but is empty. |
| 3 | Anonymous | *Culhwch and Olwen* | core | 3 | proposed | `pd` | Earliest Arthurian prose tale. In the Mabinogion but outside the Four Branches. |
| 4 | Anonymous | *The Three Romances: Owain, Peredur, Geraint* | core | 3 | proposed | `pd` | |
| 5 | Dafydd ap Gwilym | *Poems* | core | 4 | prep | `pd` | |
| 6 | Anonymous | *The Llywarch Hen Poems* | core | 4 | proposed | `pd` | Saga englynion - the direct Welsh counterpart to the Old English elegies. |
| 7 | Anonymous | *The Heledd Poems* | core | 4 | proposed | `pd` | Saga englynion. |
| 8 | Various | *Book of Taliesin* | core | 5 | prep | `pd` | |
| 9 | Aneirin | *Y Gododdin* | core | 5 | proposed | `pd` | LARGEST HOLE. Arguably the oldest surviving poetry from Britain. You have Taliesin without Aneirin. |
| 10 | Gruffudd ab yr Ynad Coch | *Elegy for Llywelyn (1282)* | core | 5 | proposed | `pd` | One of the great medieval Welsh poems. |
| 11 | Ann Griffiths | *Hymns* | expected | 2 | proposed | `pd` | Griffiths d. 1805. |
| 12 | Anonymous | *Old Stanzas* | expected | 2 | proposed | `pd` | Anonymous folk stanzas - short and easy. |
| 13 | Anonymous | *The Dream of Macsen Wledig* | expected | 3 | proposed | `pd` | |
| 14 | Daniel Owen | *Rhys Lewis* | expected | 3 | proposed | `pd` | Owen d. 1895. The first major Welsh novel. |
| 15 | Ellis Wynne | *Visions of the Sleeping Bard* | expected | 4 | prep | `pd` | Marked with a query on the original list - Wynne d. 1734, fully public domain. |
| 16 | T. Gwynn Jones | *Poems* | expected | 4 | prep | `pd` | Jones d. 1949 - clear in life+70 territories. |
| 17 | Various | *The Cywydd Poets: Iolo Goch, Guto'r Glyn, Dafydd Nanmor* | expected | 4 | proposed | `pd` | 14th-15th c. poets working in the cywydd metre alongside Dafydd ap Gwilym. |
| 18 | Various | *Black Book of Carmarthen* | expected | 5 | prep | `pd` | |
| 19 | Various | *Poets of the Princes* | expected | 5 | prep | `pd` | |
| 20 | Anonymous | *The Law of Hywel Dda* | differentiator | 4 | proposed | `pd` | Medieval law texts. Unusual, and completely unavailable elsewhere in translation online. |
| 21 | Kate Roberts | *Short Stories* | blocked | 3 | prep | `restricted` | BLOCKED. Roberts d. 1985 - protected until 2055. |
| 22 | R. S. Thomas | *Poems* | blocked | 3 | prep | `restricted` | BLOCKED TWICE. Thomas d. 2000 (protected to 2070) AND he wrote his poetry in English, so he does not belong on a Welsh-language shelf regardless. |
| 23 | Saunders Lewis | *Blodeuwedd* | blocked | 4 | prep | `restricted` | BLOCKED. Lewis d. 1985 - protected until 2055. |

## Gaulish (inscription-only)

22 works — 0 existing, 9 in preparation, 13 proposed.

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Various | *The Autun spindle whorls* | core | 2 | proposed | `pd` | Short flirtatious inscriptions on loom weights. Trivial in scale, but the only glimpse of casual spoken Gaulish - likely the most-read page on this shelf. |
| 2 | Various | *The Coligny calendar* | core | 4 | prep | `pd` | |
| 3 | Various | *La Graufesenque graffiti* | core | 4 | proposed | `pd` | Potters' firing lists - distinct from the maker's stamps. The only surviving Gaulish administrative writing. |
| 4 | Various | *The Chamalieres tablet* | core | 5 | prep | `pd` | CORRECTED from 'Chamalifères'. Lead tablet from the spring of Sources des Roches. |
| 5 | Various | *The Larzac lead tablet* | core | 5 | prep | `pd` | CORRECTED from "L'Hal Du Larzac". |
| 6 | Various | *The Chateaubleau tile* | core | 5 | proposed | `pd` | THE REAL GAP. Discovered 1997; the longest connected Gaulish text known. |
| 7 | Various | *Coin legends* | expected | 3 | prep | `pd` | |
| 8 | Various | *Pottery stamps (Lezoux, Banassac)* | expected | 3 | prep | `pd` | |
| 9 | Various | *Classical-source glosses* | expected | 3 | prep | `pd` | See Endlicher's Glossary below - worth naming explicitly. |
| 10 | Endlicher | *Endlicher's Glossary* | expected | 3 | proposed | `pd` | The Vienna glossary of Gaulish place-name elements. |
| 11 | Various | *Alise-Sainte-Reine inscription* | expected | 4 | prep | `pd` | |
| 12 | Various | *Vercelli bilingual* | expected | 4 | prep | `pd` | RELABEL: listed as 'graffito' but it is a bilingual boundary stone. Belongs with Cisalpine Gaulish. |
| 13 | Various | *The Todi bilingual* | expected | 4 | proposed | `pd` | CISALPINE GAULISH - written in northern Italy in a north-Etruscan alphabet. |
| 14 | Various | *The Lezoux plate* | expected | 5 | prep | `pd` | CORRECTED from 'The Lou Mountains plate'. |
| 15 | Various | *The Rom (Deux-Sevres) lead tablet* | expected | 5 | proposed | `pd` | |
| 16 | Marcellus of Bordeaux | *Magical formulas* | differentiator | 4 | proposed | `pd` | |
| 17 | Various | *The Briona inscription* | differentiator | 4 | proposed | `pd` | CISALPINE GAULISH. |
| 18 | Various | *The Voltino bilingual* | differentiator | 4 | proposed | `pd` | CISALPINE GAULISH. |
| 19 | Various | *Seraucourt (Bourges)* | differentiator | 4 | proposed | `pd` | |
| 20 | Various | *The Genouilly stele* | differentiator | 4 | proposed | `pd` | |
| 21 | Various | *The Prestino inscription* | differentiator | 5 | proposed | `pd` | LEPONTIC - earlier, and arguably a separate language. Needs an editorial note either way; including it with the note is more defensible than silent omission. |
| 22 | Various | *The Vergiate inscription* | differentiator | 5 | proposed | `pd` | LEPONTIC. |

## German

18 works — 0 existing, 0 in preparation, 18 proposed. **See reconciliation
note at top of this document — this conflicts with the live
`german.json`, which already has 14 works.**

| # | Author | Work | Tier | Diff | Status | Rights | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Grimm | *Grimms' Fairy Tales* | core | 1 | proposed | `pd` | BOTTOM RUNG. Easiest continuous German narrative. |
| 2 | Luther | *The Luther Bible* | core | 2 | proposed | `pd` | BOTTOM RUNG. Foundational text of modern literary German. |
| 3 | Heine | *Book of Songs* | core | 2 | proposed | `pd` | Short lyrics - good early rung. |
| 4 | Goethe | *The Sorrows of Young Werther* | core | 3 | proposed | `pd` | |
| 5 | Schiller | *William Tell, The Robbers* | core | 3 | proposed | `pd` | |
| 6 | Kafka | *The Metamorphosis* | core | 3 | proposed | `pd` | Kafka d. 1924 - clear. |
| 7 | Anonymous | *The Song of the Nibelungs* | core | 4 | proposed | `pd` | Middle High German. |
| 8 | Walther von der Vogelweide | *Songs* | core | 4 | proposed | `pd` | Middle High German. |
| 9 | Goethe | *Faust I* | core | 4 | proposed | `pd` | |
| 10 | Wolfram von Eschenbach | *Parzival* | core | 5 | proposed | `pd` | Middle High German. |
| 11 | Holderlin | *Poems* | core | 5 | proposed | `pd` | |
| 12 | Hildebrandslied | *The Lay of Hildebrand* | expected | 4 | proposed | `pd` | Old High German - the only surviving OHG heroic poem. Pairs with the Old English shelf. |
| 13 | Kleist | *Michael Kohlhaas* | expected | 4 | proposed | `pd` | |
| 14 | Novalis | *Hymns to the Night* | expected | 4 | proposed | `pd` | |
| 15 | Nietzsche | *Thus Spoke Zarathustra* | expected | 4 | proposed | `pd` | SPLIT DECISION: may belong on Athenaeum. |
| 16 | Gottfried von Strassburg | *Tristan* | expected | 5 | proposed | `pd` | Middle High German. |
| 17 | Rilke | *Duino Elegies* | expected | 5 | proposed | `pd` | Rilke d. 1926 - clear. |
| 18 | Buchner | *Woyzeck* | differentiator | 3 | proposed | `pd` | |
