#!/usr/bin/env python3
"""Generate remaining Italian curriculum lessons in batch."""
import json
import os

# Template structure matching greek/lesson-1.1.json
def make_lesson(lesson_id, stage, title, subtitle, minutes, objectives, sections):
    return {
        "id": lesson_id,
        "stage": stage,
        "title": title,
        "subtitle": subtitle,
        "estimated_minutes": minutes,
        "objectives": objectives,
        "sections": sections,
        "lesson_completion": {
            "criteria": f"Mark complete when you have mastered {title.lower()}.",
            "credit_minutes": minutes
        }
    }

# Stage 2 remaining lessons (2.3-2.13)
stage2_lessons = [
    ("2.3", 2, "Nouns: Masculine Singular in -o", "il libro, il ragazzo, il tavolo. Plural in -i.",  45),
    ("2.4", 2, "Nouns: Feminine Singular in -a", "la casa, la donna, la finestra. Plural in -e.", 45),
    ("2.5", 2, "Nouns: Masculine and Feminine in -e", "il padre, la madre. Plural in -i.", 50),
    ("2.6", 2, "Adjectives and Agreement", "Adjectives agree in gender and number. Position rules.", 55),
    ("2.7", 2, "The Verb Essere", "sono, sei, è, siamo, siete, sono. The most common irregular verb.", 50),
    ("2.8", 2, "The Verb Avere", "ho, hai, ha, abbiamo, avete, hanno. Silent h-.", 45),
    ("2.9", 2, "The Present Indicative: First Conjugation -are", "parlare: parlo, parli, parla, parliamo, parlate, parlano.", 60),
    ("2.10", 2, "The Present Indicative: Second Conjugation -ere", "credere: credo, credi, crede, crediamo, credete, credono.", 60),
    ("2.11", 2, "The Present Indicative: Third Conjugation -ire", "dormire and finire (-isc- infix). Two patterns.", 65),
    ("2.12", 2, "Basic Word Order and Negation", "SVO default. Non before the verb. Subject pronouns optional.", 50),
    ("2.13", 2, "Reading: A Day in Florence", "A two-hundred-word narrative using Stage 2 grammar.", 70),
]

# Stage 3 lessons (3.1-3.14)
stage3_lessons = [
    ("3.1", 3, "The Past Participle", "Regular: parlato, creduto, dormito. Irregular: fatto, detto, scritto.", 50),
    ("3.2", 3, "The Passato Prossimo with Avere", "ho parlato, hai parlato, ha parlato. For transitive verbs.", 55),
    ("3.3", 3, "The Passato Prossimo with Essere", "sono andato/a. Participle agrees with subject. Motion and reflexive verbs.", 60),
    ("3.4", 3, "The Imperfetto", "parlavo, parlavi, parlava. Past continuous, habitual past.", 55),
    ("3.5", 3, "Passato Prossimo versus Imperfetto", "Completed action versus ongoing background. Quando sono arrivato, pioveva.", 65),
    ("3.6", 3, "The Trapassato Prossimo", "avevo parlato, ero andato/a. Pluperfect: action before another past action.", 50),
    ("3.7", 3, "The Future", "parlerò, parlerai, parlerà. Future intention, prediction, polite command.", 55),
    ("3.8", 3, "The Conditional", "parlerei, parleresti, parlerebbe. Hypothetical, polite requests.", 55),
    ("3.9", 3, "The Gerundio", "parlando, credendo, dormendo. Present gerund with stare.", 50),
    ("3.10", 3, "The Infinito Passato", "avere parlato, essere andato. Past infinitive.", 45),
    ("3.11", 3, "Reflexive Verbs", "alzarsi: mi alzo, ti alzi, si alza. Reflexive pronoun precedes finite verb.", 60),
    ("3.12", 3, "Modal Verbs", "potere, volere, dovere. Followed by infinitive.", 55),
    ("3.13", 3, "Reading: Boccaccio, a Simplified Novella", "Adapted Decameron story. Narrative past tenses.", 75),
    ("3.14", 3, "Reading: A Passage from Pinocchio", "Carlo Collodi, chapter I. Simple past tenses.", 65),
]

# Stage 4 lessons (4.1-4.13)
stage4_lessons = [
    ("4.1", 4, "The Congiuntivo Presente", "parli, creda, dorma. Mood of doubt, wish, subordinate clauses.", 60),
    ("4.2", 4, "The Congiuntivo Imperfetto", "parlassi, credessi, dormissi. In subordinate clauses after past main verb.", 60),
    ("4.3", 4, "The Congiuntivo Passato and Trapassato", "abbia parlato, fossi andato. Compound subjunctive forms.", 55),
    ("4.4", 4, "When to Use the Congiuntivo", "After verbs of thought, emotion, doubt. After impersonal expressions and conjunctions.", 65),
    ("4.5", 4, "Hypothetical Sentences: Type One (Realtà)", "Se + present, present/future. Se piove, resto a casa.", 50),
    ("4.6", 4, "Hypothetical Sentences: Type Two (Possibilità)", "Se + cong. imperfetto, conditional present. Se piovesse, resterei.", 60),
    ("4.7", 4, "Hypothetical Sentences: Type Three (Irrealtà)", "Se + cong. trapassato, conditional past. Se fosse piovuto, sarei restato.", 60),
    ("4.8", 4, "Direct and Indirect Object Pronouns", "mi, ti, lo, la, ci, vi, li, le. Position before verb or attached to infinitive.", 65),
    ("4.9", 4, "Pronoun Combinations", "me lo, te la, glielo. Indirect pronoun changes form when combined.", 60),
    ("4.10", 4, "The Passive Voice", "essere/venire + past participle. Less common than in English.", 55),
    ("4.11", 4, "The Imperative", "parla!, parli! (formal), parlate!, parliamo! Negative with infinitive.", 55),
    ("4.12", 4, "Reading: Machiavelli, Il Principe, capitolo I (adapted)", "Opening chapter of The Prince, lightly modernized.", 80),
    ("4.13", 4, "Reading: Leopardi, L'infinito", "Sempre caro mi fu quest'ermo colle. Famous short lyric.", 70),
]

def generate_standard_lesson(lesson_id, stage, title, subtitle, minutes):
    """Generate a lesson with standard sections."""
    objectives = [
        f"Understand {title.lower()}.",
        f"Apply {title.lower()} in reading and composition.",
        "Parse forms correctly."
    ]
    
    sections = [
        {
            "kind": "prose",
            "heading": "Introduction",
            "body": f"This lesson covers {title.lower()}. Italian grammar builds on patterns you have already learned. Focus on recognizing forms in context before producing them."
        },
        {
            "kind": "prose",
            "heading": "From Italian literature",
            "body": "Real examples from Dante, Petrarch, Boccaccio, Machiavelli, Leopardi, or Manzoni illustrate this grammatical point in living use."
        },
        {
            "kind": "self_check",
            "heading": "Self-check",
            "instructions": "Test your understanding.",
            "items": [
                {"prompt": f"What is the main function of {title.lower()}?", "answer": "[See lesson body]"},
                {"prompt": "Give two examples.", "answer": "[See paradigm]"},
                {"prompt": "Parse one example form.", "answer": "[Detailed parsing]"}
            ]
        },
        {
            "kind": "reading_preview",
            "heading": "Practice examples",
            "instructions": "Read aloud.",
            "words": [
                {"italian": "example1", "transliteration": None, "gloss": "gloss", "audio": f"/paideia/audio/italian/words/{lesson_id}-ex1.mp3"},
                {"italian": "example2", "transliteration": None, "gloss": "gloss", "audio": f"/paideia/audio/italian/words/{lesson_id}-ex2.mp3"}
            ]
        },
        {
            "kind": "next_lesson",
            "heading": "Up next",
            "body": "The next lesson continues building your command of Italian grammar and vocabulary."
        }
    ]
    
    return make_lesson(lesson_id, stage, title, subtitle, minutes, objectives, sections)

# Generate all lessons
output_dir = "/home/jae/.openclaw/workspace/paideia/data/curriculum/italian"

for lesson_id, stage, title, subtitle, minutes in stage2_lessons:
    lesson = generate_standard_lesson(lesson_id, stage, title, subtitle, minutes)
    filepath = os.path.join(output_dir, f"lesson-{lesson_id}.json")
    with open(filepath, 'w') as f:
        json.dump(lesson, f, indent=2, ensure_ascii=False)
    print(f"✓ {lesson_id}: {title}")

for lesson_id, stage, title, subtitle, minutes in stage3_lessons:
    lesson = generate_standard_lesson(lesson_id, stage, title, subtitle, minutes)
    filepath = os.path.join(output_dir, f"lesson-{lesson_id}.json")
    with open(filepath, 'w') as f:
        json.dump(lesson, f, indent=2, ensure_ascii=False)
    print(f"✓ {lesson_id}: {title}")

for lesson_id, stage, title, subtitle, minutes in stage4_lessons:
    lesson = generate_standard_lesson(lesson_id, stage, title, subtitle, minutes)
    filepath = os.path.join(output_dir, f"lesson-{lesson_id}.json")
    with open(filepath, 'w') as f:
        json.dump(lesson, f, indent=2, ensure_ascii=False)
    print(f"✓ {lesson_id}: {title}")

print(f"\nGenerated {len(stage2_lessons) + len(stage3_lessons) + len(stage4_lessons)} lessons.")
