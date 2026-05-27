# Historic English Curricula — Delivery Summary

**Completed:** 2026-05-18  
**Task:** Flesh out FULL Old English and Middle English curricula for Diploma in Reading courses

## Deliverables

### Old English (35 files)
**Path:** `/home/jae/.openclaw/workspace/paideia/data/curriculum/oldenglish/`

#### Stage 1: The Sound and the Shape (7 lessons)
- `lesson-1.1.json` — The Alphabet
- `lesson-1.2.json` — Æ, Þ, Ð, Ƿ
- `lesson-1.3.json` — Vowels and Diphthongs
- `lesson-1.4.json` — Consonants
- `lesson-1.5.json` — Stress
- `lesson-1.6.json` — First Words
- `lesson-1.7.json` — First Sentence (Ælfred kyning hāteþ grētan Wærferþ biscep)

#### Stage 2: The Sentence (13 lessons)
- `lesson-2.1.json` — The Four Cases
- `lesson-2.2.json` — The Definite Article (se/sēo/þæt)
- `lesson-2.3.json` — Strong Nouns — Masculine a-Stems
- `lesson-2.4.json` — Strong Nouns — Neuter a-Stems
- `lesson-2.5.json` — Strong Nouns — Feminine ō-Stems
- `lesson-2.6.json` — Weak Nouns
- `lesson-2.7.json` — Present Indicative of Strong Verbs
- `lesson-2.8.json` — Past Indicative of Strong Verbs
- `lesson-2.9.json` — The Verb 'To Be'
- `lesson-2.10.json` — Adjectives — Strong and Weak
- `lesson-2.11.json` — Prepositions and Case Government
- `lesson-2.12.json` — Reading: Anglo-Saxon Chronicle, Year 449
- `lesson-2.13.json` — Reading: Ælfric, on the Creation

#### Stage 3: The Reading (14 lessons)
- `lesson-3.1.json` — Weak Verbs — Class I
- `lesson-3.2.json` — Weak Verbs — Class II
- `lesson-3.3.json` — Noun Declensions — i-Stems and u-Stems
- `lesson-3.4.json` — Pronouns — Personal and Demonstrative
- `lesson-3.5.json` — The Subjunctive
- `lesson-3.6.json` — The Infinitive and the Participles
- `lesson-3.7.json` — Old English Poetic Meter
- `lesson-3.8.json` — Kennings and Variation
- `lesson-3.9.json` — Caedmon's Hymn — Lines 1–5
- `lesson-3.10.json` — Caedmon's Hymn — Lines 6–9
- `lesson-3.11.json` — Beowulf, Lines 1–11
- `lesson-3.12.json` — Beowulf, Lines 12–25
- `lesson-3.13.json` — Beowulf, Lines 26–50
- `lesson-3.14.json` — Sight Reading Practice

#### Capstone
- `capstone.json` — Three-hour examination with Parts A (sight translation), B (parsing), D (multiple choice). Pass mark 70%, Honors 85%. Uses Caedmon's Hymn and Beowulf opening as capstone texts.

---

### Middle English (36 files)
**Path:** `/home/jae/.openclaw/workspace/paideia/data/curriculum/middleenglish/`

#### Stage 1: The Sound and the Shape (7 lessons)
- `lesson-1.1.json` — The Alphabet and Spelling Chaos
- `lesson-1.2.json` — The Vowels Before the Shift
- `lesson-1.3.json` — The Final -e
- `lesson-1.4.json` — Consonants and the Yogh
- `lesson-1.5.json` — Stress and Meter
- `lesson-1.6.json` — First Lines (Whan that Aprill...)
- `lesson-1.7.json` — Ten Common Words

#### Stage 2: The Sentence (14 lessons)
- `lesson-2.1.json` — The Infinitive and the Present Tense
- `lesson-2.2.json` — The Past Tense — Weak Verbs
- `lesson-2.3.json` — The Past Tense — Strong Verbs
- `lesson-2.4.json` — The Past Participle
- `lesson-2.5.json` — The Subjunctive
- `lesson-2.6.json` — The Verb 'To Be'
- `lesson-2.7.json` — Pronouns — Personal
- `lesson-2.8.json` — Pronouns — Relative and Demonstrative
- `lesson-2.9.json` — Nouns and the Genitive
- `lesson-2.10.json` — Adjectives
- `lesson-2.11.json` — Negation
- `lesson-2.12.json` — Word Order and Style
- `lesson-2.13.json` — Reading: The General Prologue, Lines 1–18
- `lesson-2.14.json` — Reading: The Knight's Tale, Lines 859–882

#### Stage 3: The Reading (14 lessons)
- `lesson-3.1.json` — The General Prologue, Lines 1–42
- `lesson-3.2.json` — The General Prologue, Lines 43–78
- `lesson-3.3.json` — The General Prologue, Lines 79–100
- `lesson-3.4.json` — Chaucer's Vocabulary — Layers
- `lesson-3.5.json` — Chaucer's Meter and Rhyme
- `lesson-3.6.json` — Sir Gawain — Dialect and Spelling
- `lesson-3.7.json` — Sir Gawain — Alliterative Meter
- `lesson-3.8.json` — Sir Gawain, Lines 136–159
- `lesson-3.9.json` — Sir Gawain, Lines 160–183
- `lesson-3.10.json` — Sir Gawain, Lines 184–207
- `lesson-3.11.json` — Sir Gawain, Lines 208–231
- `lesson-3.12.json` — Alliterative Vocabulary
- `lesson-3.13.json` — Comparison: Chaucer and Gawain
- `lesson-3.14.json` — Sight Reading Practice

#### Capstone
- `capstone.json` — Three-hour examination with Parts A (sight translation), B (parsing), D (multiple choice). Pass mark 70%, Honors 85%. Uses Canterbury Tales General Prologue lines 1–100 and Sir Gawain lines 136–231 as capstone texts.

---

## Shape and Voice Compliance

### Lesson JSON Structure
Each lesson follows the Greek `lesson-1.1.json` gold-standard shape:
- `id`, `stage`, `title`, `subtitle`, `estimated_minutes`, `objectives`
- `sections[]` array with `kind` (prose, letter_grid, paradigm_table, self_check, reading_preview, next_lesson)
- `lesson_completion` with `criteria` and `credit_minutes`

### Capstone JSON Structure
Each capstone mirrors Greek `capstone.json` shape:
- `id`, `lang`, `title`, `instructions`, `time_limit_minutes`
- `sections[]` with `id`, `title`, `items[]`
- Item types: `translate`, `parse`, `mcq`
- `scoring` with `max_points`, `pass_mark`, `honors_mark`
- `honor_code` text

### Anti-Slop Voice Rules Applied
Every prose section:
- NO -ly adverbs
- NO em dashes
- NO three-item lists (two or one)
- NO filler ("It's worth noting," "At its core," etc.)
- NO false agency
- Real text examples in EVERY lesson
- Scholarly, declarative, warm

### Reading Preview Shape
For Old English: `{ oldenglish, transliteration|null, gloss, audio: "/paideia/audio/oldenglish/..." }`  
For Middle English: `{ middleenglish, transliteration|null, gloss, audio: "/paideia/audio/middleenglish/..." }`

---

## Real Texts Used

### Old English
- **Beowulf** — opening 50 lines
- **Caedmon's Hymn** — complete (9 lines)
- **Anglo-Saxon Chronicle** — Year 449 entry
- **Ælfric's Genesis** — opening verses
- **King Alfred's Preface to the Pastoral Care** — opening sentence

### Middle English
- **Chaucer, Canterbury Tales** — General Prologue lines 1–100
- **Chaucer, The Knight's Tale** — lines 859–882
- **Sir Gawain and the Green Knight** — lines 136–231 (Green Knight entrance and challenge)
- References to **Langland's Piers Plowman**, **Julian of Norwich**, **York mystery plays**

---

## Paradigms and Grammar

### Old English Paradigms Included
- Definite article (se/sēo/þæt) — 17 forms
- Strong masculine a-stems (stān)
- Strong neuter a-stems (scip)
- Strong feminine ō-stems (giefu)
- Weak nouns (guma)
- Strong verb conjugation (rīdan, Classes I-VII)
- Weak verbs Class I (dēman) and Class II (lufian)
- Verb 'to be' (eom/bēon/wesan)
- Personal pronouns
- Adjectives (strong/weak declension)

### Middle English Paradigms Included
- Verb conjugation (present: loveth; past: loved, rood)
- Pronouns (thou/ye distinction, hir/hem)
- The subjunctive
- Weak vs. strong past tense
- Genitive/plural -es system

---

## Validation

All 71 JSON files:
- ✅ Parse successfully (validated with Python `json.load`)
- ✅ Follow schema from Greek lesson template
- ✅ Include self_check, reading_preview, next_lesson sections
- ✅ Use real text examples
- ✅ Obey Anti-Slop rules

---

## Notes

Both curricula are **Diploma in Reading** courses (3-stage), not 5-stage Mastery courses. Stage 3 ends with a sustained reading capstone, not a track fork.

Capstone exams are **reading-only** (no composition section for these dead languages). Format: **A (sight translation 4-5 items), B (parsing 4 items), D (MCQ 6 items)**. No section C (composition). Total ~90 points.

All lessons include:
- Prose openers with real text examples
- Self-check items (5-10)
- Reading preview with audio paths
- Paradigm tables for inflection (where applicable)
- Next lesson pointer

**DELIVERABLE COMPLETE.**
