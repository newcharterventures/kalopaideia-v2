#!/usr/bin/env python3
"""
Generate numbers tutorial data for each Paideia language.
Produces a `numbers` section in each primer JSON with:
  - cardinals (0-20, tens to 100, 1000)
  - ordinals (1st-10th)
  - notes: grammatical quirks (Latin declined 1-3, Greek dual for 2, etc.)

One-shot generation via Sonnet. Writes into data/primer/<lang>.json
"""
import json
import os
import sys
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("pip install anthropic", file=sys.stderr)
    sys.exit(1)

ROOT = Path("/home/jae/.openclaw/workspace/paideia")
PRIMER_DIR = ROOT / "data" / "primer"

MODEL = "claude-sonnet-4-5"

LANGS = [
    {"key": "latin",      "display": "Classical Latin"},
    {"key": "greek",      "display": "Ancient Greek (Attic, with polytonic accents)"},
    {"key": "french",     "display": "Standard French"},
    {"key": "german",     "display": "Standard German"},
    {"key": "oldenglish", "display": "Old English (West Saxon)"},
]

PROMPT_TEMPLATE = """You are compiling a numbers tutorial for Paideia, a classical-language learning site.

Target language: {display}

Produce a JSON object with these exact keys:

- "overview": 2-3 sentences explaining what makes numbers in this language distinctive (e.g. Latin declines 1-3; Greek has a dual for two; French counts in 20s past 69; Old English uses hundred forms differently). No filler, no adverbs in -ly, no em dashes.

- "cardinals": an array of cardinal number entries. Include every number from 0 through 20, then 30, 40, 50, 60, 70, 80, 90, 100, 1000, and 1,000,000. Each entry:
    {{
      "value": 0,
      "word": "the word in the target language (with proper diacritics/accents; for Greek use polytonic)",
      "ipa": "IPA transcription",
      "pronunciation": "English-phonetic guide e.g. 'oo-NUSS'",
      "note": "optional grammatical note (gender, declension, usage); empty string if none"
    }}

- "ordinals": an array of ordinals, 1st through 10th. Each entry:
    {{
      "rank": 1,
      "word": "the word in the target language",
      "ipa": "IPA",
      "pronunciation": "English-phonetic guide",
      "meaning": "first/second/etc. — include the agreement pattern if relevant",
      "note": "optional note"
    }}

- "teaching_notes": array of 3-5 short pedagogical tips. Each is a single string, 1-2 sentences, specific to this language's numbers. Things like declension patterns, archaic forms in literature, compound number formation, gender agreement.

HARD RULES:
- Use proper diacritics / accents / long marks. Latin macrons (ā ē ī ō ū). Greek polytonic accents. German umlauts. French accents. Old English þ ð æ where relevant.
- Output ONLY valid JSON. No code fences, no prose before or after.
- All string values must be plain ASCII-quoted JSON strings (but the content inside may have any Unicode).
- No slop. No "in today's world". No filler.

Output the JSON now."""

def load_api_key():
    config_path = Path("/home/jae/.openclaw/workspace/multi-model-engine/config.json")
    with open(config_path) as f:
        c = json.load(f)
    return c.get("claude_api_key") or c.get("anthropic_api_key")

def generate_numbers(client, lang):
    prompt = PROMPT_TEMPLATE.format(display=lang["display"])
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        if text.startswith("json\n"):
            text = text[5:]
    return json.loads(text)

def main():
    client = anthropic.Anthropic(api_key=load_api_key())
    
    for lang in LANGS:
        key = lang["key"]
        print(f"[{key}] generating numbers...", file=sys.stderr)
        try:
            numbers = generate_numbers(client, lang)
        except json.JSONDecodeError as e:
            print(f"[{key}] JSON decode fail: {e}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"[{key}] FAIL: {e}", file=sys.stderr)
            continue
        
        # Validate structure
        if not all(k in numbers for k in ["overview", "cardinals", "ordinals", "teaching_notes"]):
            print(f"[{key}] missing keys in response", file=sys.stderr)
            continue
        
        # Merge into primer
        primer_path = PRIMER_DIR / f"{key}.json"
        with open(primer_path) as f:
            primer = json.load(f)
        primer["numbers"] = numbers
        with open(primer_path, "w") as f:
            json.dump(primer, f, indent=2, ensure_ascii=False)
        
        print(f"[{key}] ✓ cardinals={len(numbers['cardinals'])} ordinals={len(numbers['ordinals'])} tips={len(numbers['teaching_notes'])}", file=sys.stderr)
    
    print("\n✓ Numbers generation complete", file=sys.stderr)

if __name__ == "__main__":
    main()
