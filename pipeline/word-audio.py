#!/usr/bin/env python3
"""
Generate a TTS MP3 for a single word in a given language.
Called by the server on-demand. Caches to data/word-audio/<lang>/<sha1>.mp3

Backend (edge-tts vs Azure Speech) is selected by env var TTS_BACKEND.
See pipeline/tts_backend.py for details. CLI signature unchanged so
the server's spawn() in server.js keeps working.
"""
import asyncio
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "data" / "word-audio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs  # noqa  (validates lang_key)
from tts_backend import synth, TTSBackendError


def value_hash(value: str) -> str:
    return hashlib.sha1(value.strip().encode("utf-8")).hexdigest()[:16]


def detect_context(text: str) -> str:
    # Single word -> headword. Multi-word with spaces -> sentence.
    return "sentence" if (" " in text.strip()) else "headword"


async def main():
    if len(sys.argv) != 3:
        print("usage: word-audio.py <lang> <word>", file=sys.stderr)
        sys.exit(1)
    lang = sys.argv[1].lower()
    word = sys.argv[2].strip()
    try:
        speak_kwargs(lang)
    except KeyError:
        print(f"unsupported lang: {lang}", file=sys.stderr)
        sys.exit(1)
    h = value_hash(word)
    out = AUDIO_DIR / lang / f"{h}.mp3"
    if out.exists():
        print(str(out))
        return
    try:
        await synth(word, lang, detect_context(word), out)
    except TTSBackendError as e:
        print(f"tts_backend error: {e}", file=sys.stderr)
        sys.exit(1)
    # Validate that generation succeeded
    if not out.exists() or out.stat().st_size == 0:
        print(f"generation failed: empty output", file=sys.stderr)
        if out.exists():
            out.unlink()
        sys.exit(1)
    print(str(out))


if __name__ == "__main__":
    asyncio.run(main())
