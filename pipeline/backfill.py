#!/usr/bin/env python3
"""
Backfill Paideia word-of-the-day entries from:
  1. /home/jae/twitter-word-game/paideia_archive.json (Greek, Apr 11-20)
  2. @LatinateGame X tweets (French/German/Old English/Latin, Apr 14 only)

Writes paideia/data/words/YYYY-MM-DD.json using the same schema as
pipeline/generate.js. Only real data — no fabrication, no LLM generation
from scratch, only LLM reformatting of existing content into the schema.
"""

import json
import os
import sys
import re
import time
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

try:
    import anthropic
except ImportError:
    print("pip install anthropic", file=sys.stderr)
    sys.exit(1)

ROOT = Path("/home/jae/.openclaw/workspace/paideia")
WORDS_DIR = ROOT / "data" / "words"
WORDS_DIR.mkdir(parents=True, exist_ok=True)

PAIDEION_ARCHIVE = ROOT / "data" / "backfill-source-paideion.json"
LATINATE_TWEETS = ROOT / "data" / "backfill-source-latinate.json"

MODEL = "claude-sonnet-4-5"

def load_api_key():
    config_path = Path("/home/jae/.openclaw/workspace/multi-model-engine/config.json")
    with open(config_path) as f:
        c = json.load(f)
    return c.get("claude_api_key") or c.get("anthropic_api_key")

# ============================================================
# Schema target — must match pipeline/generate.js output
# ============================================================
SCHEMA_KEYS = [
    "word", "transliteration", "pronunciation", "ipa",
    "part_of_speech", "meaning", "forms", "etymology",
    "literary_context", "usage_example", "did_you_know",
]

def reformat_prompt(lang_display, raw_content):
    return f"""You are reformatting an existing {lang_display} word-of-the-day post into a structured JSON schema.

The raw content below is ALREADY a complete post with all the information needed. Your job is ONLY to reorganize it into the schema below. Do NOT invent new facts, do NOT generate new content. Preserve every fact exactly.

Output a JSON object with exactly these keys:
- "word": the headword in its original script, with diacritics/accents intact (for Greek: polytonic accents)
- "transliteration": Latin-alphabet romanization (empty string for Latin/French/German if already Latin alphabet)
- "pronunciation": the English-phonetic guide already given in the raw content (e.g. "ah-reh-TAY")
- "ipa": IPA transcription — extract if given; otherwise derive closely from the pronunciation guide
- "part_of_speech": e.g. "noun, feminine" or "verb, 1st conjugation"
- "meaning": one-line English gloss
- "forms": declension or conjugation summary (short, readable — NOT the full paradigm)
- "etymology": root and descendants, as given
- "literary_context": name the author + work + any quoted passage from raw content
- "usage_example": the quoted passage with its English translation, in format "Original. — English translation."
- "did_you_know": the "Did you know?" fact from the raw content

HARD RULES:
- Only reformat what's in the raw content. Do NOT add facts not present.
- If a field is not derivable from the raw, output an empty string "" for it.
- Output ONLY valid JSON. No prose, no code fences.
- Use ASCII straight quotes in JSON structure. Diacritics intact in string values.

RAW CONTENT:
{raw_content}

Output JSON only."""

def reformat_to_schema(client, lang_display, raw_content, retries=2):
    for attempt in range(retries + 1):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                messages=[{"role": "user", "content": reformat_prompt(lang_display, raw_content)}],
            )
            text = resp.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text.rsplit("```", 1)[0]
                if text.startswith("json\n"):
                    text = text[5:]
            data = json.loads(text)
            # Ensure all keys present
            for k in SCHEMA_KEYS:
                if k not in data:
                    data[k] = ""
            return data
        except json.JSONDecodeError as e:
            print(f"  JSON parse fail (try {attempt+1}): {e}", file=sys.stderr)
            if attempt == retries:
                return None
            time.sleep(1)
        except Exception as e:
            print(f"  API error (try {attempt+1}): {e}", file=sys.stderr)
            if attempt == retries:
                return None
            time.sleep(2)

# ============================================================
# Greek: parse paideion archive
# ============================================================
def ingest_greek(client):
    print("=== GREEK (from paideia_archive.json) ===", file=sys.stderr)
    with open(PAIDEION_ARCHIVE) as f:
        archive = json.load(f)
    
    # Group by date; take the first entry per date (if multiple, later ones override? let's take first)
    by_date = {}
    for entry in archive:
        date = entry["timestamp"][:10]
        if date not in by_date:
            by_date[date] = entry
    
    results = {}
    for date in sorted(by_date.keys()):
        entry = by_date[date]
        word = entry["word"]
        thread_text = "\n\n".join(entry["thread"]["tweets"])
        print(f"  {date}  {word}", file=sys.stderr)
        formatted = reformat_to_schema(client, "Ancient Greek", thread_text)
        if formatted:
            results[date] = formatted
    
    return results

# ============================================================
# Non-Greek: parse @LatinateGame thread groups from April 14
# ============================================================
def group_tweets_into_threads(tweets):
    """
    Group consecutive tweets from the same thread using content signatures.
    Each lit bot's thread mentions the target WORD in every tweet, so we can
    use explicit hardcoded thread boundaries based on our inspection.
    """
    sorted_tweets = sorted(tweets, key=lambda p: p["created_at"])
    # Known thread boundaries: {first_ts_prefix: (lang, word_marker_in_text)}
    # We explicitly assign each tweet to a thread by matching on content marker.
    THREAD_MARKERS = [
        # (start_ts_prefix, end_ts_prefix, word_marker, lang)
        ("2026-04-14T12:03:50", "2026-04-14T12:04:16", "spleen",       "french"),
        ("2026-04-14T12:04:49", "2026-04-14T12:05:15", "Weltschmerz", "german"),
        ("2026-04-14T12:05:35", "2026-04-14T12:06:02", "woruld-candel", "oldenglish"),
        ("2026-04-14T12:13:28", "2026-04-14T12:13:54", "chim\u00e8re",      "french"),
        ("2026-04-14T12:47:40", "2026-04-14T12:48:07", "f\u0101tum",        "latin"),
    ]
    threads = []
    for start, end, marker, lang in THREAD_MARKERS:
        bucket = [t for t in sorted_tweets if start <= t["created_at"][:19] <= end]
        if bucket:
            threads.append({"lang": lang, "marker": marker, "tweets": bucket})
    return threads



def ingest_non_greek(client):
    print("=== NON-GREEK (from @LatinateGame) ===", file=sys.stderr)
    with open(LATINATE_TWEETS) as f:
        data = json.load(f)
    posts = data.get("data", [])
    
    relevant = [p for p in posts if p["created_at"].startswith("2026-04-14T12")]
    threads = group_tweets_into_threads(relevant)
    
    LANG_DISPLAY = {
        "french": "French", "german": "German",
        "oldenglish": "Old English", "latin": "Latin",
    }
    
    results = defaultdict(dict)
    seen_langs = set()
    for thread_obj in threads:
        lang = thread_obj["lang"]
        tweets = thread_obj["tweets"]
        if not tweets:
            continue
        if lang in seen_langs:
            print(f"  skipping duplicate {lang} thread at {tweets[0]['created_at'][:19]}", file=sys.stderr)
            continue
        seen_langs.add(lang)
        date = tweets[0]["created_at"][:10]
        thread_text = "\n\n".join(t["text"] for t in tweets)
        print(f"  [{lang}] {tweets[0]['created_at'][:19]}  word={thread_obj['marker']!r}  ({len(tweets)} tweets)", file=sys.stderr)
        formatted = reformat_to_schema(client, LANG_DISPLAY[lang], thread_text)
        if formatted:
            results[lang][date] = formatted
    
    return dict(results)

# ============================================================
# Write output
# ============================================================
def merge_and_write(greek_by_date, non_greek_by_lang):
    """
    For each date, write a words/YYYY-MM-DD.json that matches the generate.js schema:
      { date, generated_at, languages: { greek: {...}, latin: {...}, ... } }
    
    Non-greek backfill only has April 14, but we'll add the greek entries into
    the same file so a user viewing April 14 sees Greek + whatever else we got.
    """
    all_dates = set(greek_by_date.keys())
    for lang_dates in non_greek_by_lang.values():
        all_dates.update(lang_dates.keys())
    
    for date in sorted(all_dates):
        out_path = WORDS_DIR / f"{date}.json"
        
        # If file exists and has a language already, preserve it (don't clobber today's)
        existing = {}
        if out_path.exists():
            try:
                with open(out_path) as f:
                    existing = json.load(f)
            except Exception:
                pass
        
        languages = existing.get("languages", {})
        
        if date in greek_by_date and "greek" not in languages:
            languages["greek"] = {**greek_by_date[date], "display": "Ancient Greek"}
        
        LANG_DISPLAY = {
            "latin": "Latin",
            "french": "French",
            "german": "German",
            "oldenglish": "Old English",
        }
        for lang, dates in non_greek_by_lang.items():
            if date in dates and lang not in languages:
                languages[lang] = {**dates[date], "display": LANG_DISPLAY[lang]}
        
        out = {
            "date": date,
            "generated_at": existing.get("generated_at", datetime.now(timezone.utc).isoformat()),
            "backfilled_at": datetime.now(timezone.utc).isoformat(),
            "backfill_source": "paideia_archive.json + @LatinateGame X timeline",
            "languages": languages,
        }
        
        with open(out_path, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        
        print(f"  wrote {out_path.name} ({len(languages)} langs)", file=sys.stderr)

# ============================================================
# Main
# ============================================================
def main():
    api_key = load_api_key()
    client = anthropic.Anthropic(api_key=api_key)
    
    greek = ingest_greek(client)
    non_greek = ingest_non_greek(client)
    
    print("\n=== WRITING FILES ===", file=sys.stderr)
    merge_and_write(greek, non_greek)
    print(f"\n✓ Backfill complete", file=sys.stderr)

if __name__ == "__main__":
    main()
