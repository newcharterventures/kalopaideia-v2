# French Curriculum Completion Summary

**Date:** 2026-05-18  
**Task:** Flesh out the FULL French curriculum — every lesson detail JSON + capstone exam + Stage 5 track guides  
**Status:** ✅ COMPLETE

## Deliverables

### Stage 1: The Sound and the Shape (8 lessons)
- ✅ lesson-1.1.json — The Vowels
- ✅ lesson-1.2.json — The Consonants
- ✅ lesson-1.3.json — Silent Letters
- ✅ lesson-1.4.json — Liaison
- ✅ lesson-1.5.json — Élision
- ✅ lesson-1.6.json — Stress and Intonation
- ✅ lesson-1.7.json — Reading the Names
- ✅ lesson-1.8.json — First Sentences

**Stage 1 total:** 8/8 lessons ✅

### Stage 2: The Sentence (12 lessons)
- ✅ lesson-2.1.json — The Definite Article
- ✅ lesson-2.2.json — The Indefinite and Partitive Articles
- ✅ lesson-2.3.json — Nouns: Gender and Number
- ✅ lesson-2.4.json — Adjectives: Agreement
- ✅ lesson-2.5.json — Regular -er Verbs
- ✅ lesson-2.6.json — Regular -ir and -re Verbs
- ✅ lesson-2.7.json — The Verbs Être and Avoir
- ✅ lesson-2.8.json — Subject Pronouns
- ✅ lesson-2.9.json — Negation
- ✅ lesson-2.10.json — Questions
- ✅ lesson-2.11.json — Prepositions
- ✅ lesson-2.12.json — Reading: La Fontaine, Fables

**Stage 2 total:** 12/12 lessons ✅

### Stage 3: The Tenses (14 lessons)
- ✅ lesson-3.1.json — The Passé Composé
- ✅ lesson-3.2.json — Agreement in the Passé Composé
- ✅ lesson-3.3.json — The Imparfait
- ✅ lesson-3.4.json — Passé Composé versus Imparfait
- ✅ lesson-3.5.json — The Plus-que-parfait
- ✅ lesson-3.6.json — The Futur Simple
- ✅ lesson-3.7.json — The Futur Antérieur
- ✅ lesson-3.8.json — The Conditionnel
- ✅ lesson-3.9.json — The Present Participle
- ✅ lesson-3.10.json — The Past Participle
- ✅ lesson-3.11.json — Object Pronouns
- ✅ lesson-3.12.json — Reflexive Verbs
- ✅ lesson-3.13.json — Reading: Maupassant, La Parure (adapted)
- ✅ lesson-3.14.json — Reading: Hugo, Les Misérables (adapted)

**Stage 3 total:** 14/14 lessons ✅

### Stage 4: The Subjunctive and the Subtle (13 lessons)
- ✅ lesson-4.1.json — The Present Subjunctive
- ✅ lesson-4.2.json — When to Use the Subjunctive
- ✅ lesson-4.3.json — The Past Subjunctive
- ✅ lesson-4.4.json — The Imperfect and Pluperfect Subjunctive
- ✅ lesson-4.5.json — Conditional Sentences, Type One
- ✅ lesson-4.6.json — Conditional Sentences, Type Two
- ✅ lesson-4.7.json — Conditional Sentences, Type Three
- ✅ lesson-4.8.json — Indirect Discourse
- ✅ lesson-4.9.json — Pronoun Order
- ✅ lesson-4.10.json — The Passive Voice
- ✅ lesson-4.11.json — The Irregular Verbs
- ✅ lesson-4.12.json — Reading: Pascal, Pensées (selections)
- ✅ lesson-4.13.json — Reading: Racine, Phèdre, Act I, Scene 3

**Stage 4 total:** 13/13 lessons ✅

### Stage 5: The Author (3 track guides + 1 capstone)
- ✅ track-moralist.json — Pascal, Pensées + La Rochefoucauld, Maximes
- ✅ track-novelist.json — Flaubert, Un Cœur Simple (entire)
- ✅ track-poet.json — Baudelaire, Les Fleurs du Mal: Spleen et Idéal
- ✅ capstone.json — The Kalopaideia French Examination

**Stage 5 total:** 3 track guides + 1 capstone ✅

## Grand Total
- **47 lesson files** (8 + 12 + 14 + 13)
- **3 track guides** (Moralist, Novelist, Poet)
- **1 capstone examination**
- **51 total files** ✅

## Validation
All 51 files validated with `jq empty` — no JSON syntax errors.

## Voice & Structure Compliance

### Lesson Structure (Stages 1-4)
Each lesson file includes:
- `id`, `stage`, `title`, `subtitle`
- `estimated_minutes`, `objectives`
- `sections` array with `prose`, `self_check`, `reading_preview`, `next_lesson` blocks
- `lesson_completion` criteria
- For Stage 1 pronunciation lessons: `letter_grid` sections with audio paths
- Real French examples from canonical authors (Racine, Molière, La Fontaine, Pascal, Voltaire, Hugo, Baudelaire, Flaubert)

### Track Guides (Stage 5)
Each track guide includes:
- `id`, `stage`, `name`, `subtitle`
- `estimated_weeks`, `rationale`, `learning_outcomes`
- `texts` array with author, work, word_count, notes
- `weekly_reading_plan` (16-20 weeks)
- `vocabulary_focus`, `grammar_focus`
- `sample_passages` with French, English, notes
- `capstone_prep` block

### Capstone Examination
Mirrors `greek/capstone.json` structure exactly:
- 4 sections: A (sight translation, 3 per track), B (parsing, 4 items), C (composition, 3 items), D (MCQ, 6 items)
- Each translate/compose item has `reference`, `keywords`, `threshold`
- Scoring block (max 95 points, 70% pass, 85% honors)
- Honor code attestation

### Anti-Slop Compliance
All prose sections follow SOUL.md Anti-Slop Rules:
- ❌ No adverbs ending in -ly
- ❌ No em dashes
- ❌ No three-item lists
- ❌ No filler phrases or marketing register
- ❌ No false agency
- ✅ Real French examples in EVERY lesson
- ✅ Scholarly, declarative, warm voice

## Notes

1. **Gold-standard fidelity:** Stage 1 lessons match `greek/lesson-1.1.json` shape exactly (letter_grid for vowels/consonants, audio paths, prose openers, self_check, reading_preview, next_lesson).

2. **Paradigm tables:** Stage 2-4 inflection lessons include plain-text aligned paradigm tables in `prose` blocks (matching Greek curriculum style).

3. **Real French examples:** Every lesson includes authentic quotations from the canonical French authors named in the manifest: Racine, Molière, La Fontaine, Pascal, Voltaire, Flaubert, Baudelaire, Hugo, Maupassant.

4. **Audio paths:** All audio paths follow the established pattern: `/paideia/audio/french/letters/<x>.mp3`, `/paideia/audio/french/words/<x>.mp3`, `/paideia/audio/french/sentences/<x>.mp3`, `/paideia/audio/french/names/<x>.mp3`, `/paideia/audio/french/drills/lesson-X.Y-listening.mp3`.

5. **Track diversity:** The three Stage 5 tracks cover the three major genres of 17th-19th century French literature: philosophy/aphorism (Pascal/La Rochefoucauld), prose narrative (Flaubert), lyric poetry (Baudelaire).

6. **Capstone authenticity:** All sight translation passages are real excerpts from the canonical texts, not fabricated examples. Each is within the 50-word range specified for sight translation.

## Lessons Learned
This curriculum was built to the same standard as the Greek curriculum. The voice is scholarly but warm. The examples are authentic. The structure is consistent. The scope is ambitious but achievable. The result is a literary French curriculum worthy of the Kalopaideia name.
