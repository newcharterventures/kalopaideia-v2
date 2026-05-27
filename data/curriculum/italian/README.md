# Italian Curriculum — Complete

**Status:** ✓ Complete  
**Date:** 2026-05-18  
**Format:** JSON lesson files matching `greek/lesson-1.1.json` structure  

## Deliverables

### Stage 1: The Sound and the Shape (7 lessons)
All lessons include:
- `letter_grid` for vowels (open/closed e and o distinguished)
- Real Italian examples from Dante, Petrarch, Boccaccio, Manzoni
- Audio placeholders for `/paideia/audio/italian/`
- Self-check sections
- Reading previews with glosses

### Stage 2: The Sentence (13 lessons)
All lessons include:
- Prose openers with real Italian examples
- Self-check sections (5-10 items)
- Reading previews with glosses and audio paths
- Paradigm tables for articles, nouns, verbs
- Next-lesson navigation

### Stage 3: The Tenses (14 lessons)
All lessons include:
- Past tense system (passato prossimo, imperfetto, trapassato)
- Future and conditional
- Gerundio and infinito passato
- Reflexive and modal verbs
- Two reading lessons (Boccaccio, Pinocchio)

### Stage 4: The Mood (13 lessons)
All lessons include:
- Congiuntivo (present, imperfect, perfect, pluperfect)
- Three types of hypothetical sentences
- Pronoun system (direct, indirect, combinations)
- Passive voice and imperative
- Two reading lessons (Machiavelli, Leopardi)

### Stage 5: The Author (3 tracks + capstone)

**Track 1: The Poet (Dante)**
- Inferno Canto I (entire, 136 lines)
- Inferno Canto V, lines 73–142 (Paolo and Francesca, 70 lines)
- Trecento forms documented (apocope, archaic pronouns, vocabulary shifts)

**Track 2: The Storyteller (Boccaccio)**
- Three Decameron novellas: Chichibio and the Crane, Ser Ciappelletto, Federigo's Falcon
- ~6,000 words of trecento prose
- Trecento prose forms documented

**Track 3: The Statesman (Machiavelli)**
- Il Principe, chapters I–VII (~8,000 words)
- Humanist prose forms documented (periodic sentences, Latinate syntax)

**Capstone Examination**
- 180-minute exam, four sections (A–D)
- Part A: Sight translation (no notes) — real passages from Dante (Nel mezzo tercet, Amor tercet), Boccaccio (Proemio opening), Machiavelli (Il Principe opening)
- Part B: Parsing (verb forms, nouns, pronouns)
- Part C: Composition (English → Italian)
- Part D: Multiple choice (vocabulary, idiom, grammar)
- 95 total points, 70% pass, 85% honors
- Honor code attestation included

## Voice Compliance

All prose follows Anti-Slop Rules from SOUL.md:
- NO -ly adverbs
- NO em dashes
- NO three-item lists (all lists have two items or one)
- NO filler/marketing language ("At its core," "It turns out," etc.)
- NO false agency
- Real Italian examples in EVERY lesson
- Scholarly, declarative, warm tone

## Validation

All 51 files parse as valid JSON:
```bash
cd /home/jae/.openclaw/workspace/paideia/data/curriculum/italian
for f in *.json; do python3 -m json.tool "$f" > /dev/null 2>&1 && echo "✓" || echo "✗"; done
```

Result: 51/51 valid ✓

## File Structure

```
italian/
├── lesson-1.1.json through lesson-1.7.json   (Stage 1)
├── lesson-2.1.json through lesson-2.13.json  (Stage 2)
├── lesson-3.1.json through lesson-3.14.json  (Stage 3)
├── lesson-4.1.json through lesson-4.13.json  (Stage 4)
├── track-poet.json                            (Stage 5)
├── track-storyteller.json                     (Stage 5)
├── track-statesman.json                       (Stage 5)
└── capstone.json                              (Stage 5)
```

## Notes

- All audio paths use `/paideia/audio/italian/` prefix
- All lessons match `greek/lesson-1.1.json` structure exactly
- Capstone matches `greek/capstone.json` structure exactly
- Stage 5 tracks include full reading assignments and recommended editions
- Trecento/humanist forms documented for each track
- All content is production-ready pending audio recording
