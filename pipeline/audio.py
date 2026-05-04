#!/usr/bin/env python3
"""
Generate TTS audio for today's Paideia words using Edge TTS.
Reads data/today.json, writes data/audio/YYYY-MM-DD/<lang>.mp3

Edge TTS doesn't support Latin or Ancient Greek natively. Strategy:
- Latin: use Italian voice (closest Romance pronunciation)
- Ancient Greek: use Modern Greek voice (best available, not authentic classical)
- Old English: use English voice (imperfect but readable)
- French, German: native voices
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed. Run: pip install edge-tts", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
TODAY_JSON = ROOT / "data" / "today.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, preprocess_for_tts  # noqa


async def speak(text: str, lang_key: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = preprocess_for_tts(text, lang_key)
    kw = speak_kwargs(lang_key, context="headword")
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))


def word_for_tts(lang_key: str, entry: dict) -> str:
    """Build the text to send to TTS for a given language entry."""
    word = entry.get("word", "")
    # For Greek, include transliteration as backup (Modern Greek voice may read accented ancient Greek oddly)
    # For all, keep just the word — pronunciation is primary.
    return word


async def main():
    if not TODAY_JSON.exists():
        print(f"No today.json at {TODAY_JSON}", file=sys.stderr)
        sys.exit(1)

    with TODAY_JSON.open() as fp:
        issue = json.load(fp)

    date = issue["date"]
    audio_dir = ROOT / "data" / "audio" / date
    audio_dir.mkdir(parents=True, exist_ok=True)

    for lang_key, entry in issue.get("languages", {}).items():
        try:
            speak_kwargs(lang_key)
        except KeyError:
            print(f"[{lang_key}] no voice defined, skipping")
            continue
        text = word_for_tts(lang_key, entry)
        if not text:
            print(f"[{lang_key}] no word to synthesize, skipping")
            continue
        out = audio_dir / f"{lang_key}.mp3"
        try:
            print(f"[{lang_key}] synthesizing {text!r} -> {out}")
            await speak(text, lang_key, out)
        except Exception as exc:
            print(f"[{lang_key}] TTS failed: {exc}", file=sys.stderr)
            continue

    print(f"\n✅ Audio for {date} written to {audio_dir}")


if __name__ == "__main__":
    asyncio.run(main())
