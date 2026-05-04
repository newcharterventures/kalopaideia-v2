#!/usr/bin/env python3
"""
Generate a TTS MP3 for a single word in a given language.
Called by the server on-demand. Caches to data/word-audio/<lang>/<sha1>.mp3
"""
import asyncio
import hashlib
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "data" / "word-audio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, add_prosody_hints, preprocess_for_tts  # noqa


def value_hash(value: str) -> str:
    return hashlib.sha1(value.strip().encode("utf-8")).hexdigest()[:16]


def detect_context(text: str) -> str:
    # Single word -> headword. Multi-word with spaces -> sentence.
    return "sentence" if (" " in text.strip()) else "headword"


async def speak(text: str, lang_key: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ctx = detect_context(text)
    text = preprocess_for_tts(text, lang_key)
    text = add_prosody_hints(text) if ctx == "sentence" else text
    kw = speak_kwargs(lang_key, context=ctx)
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))


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
    await speak(word, lang, out)
    print(str(out))


if __name__ == "__main__":
    asyncio.run(main())
