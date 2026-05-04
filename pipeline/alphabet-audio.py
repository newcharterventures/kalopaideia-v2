#!/usr/bin/env python3
"""
Generate TTS audio for each letter of each language's alphabet.
Reads data/primer/<lang>.json, writes data/alphabet/<lang>/<idx>.mp3

Idempotent: skips existing files.
"""
import asyncio
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed. pip install edge-tts", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
PRIMER_DIR = ROOT / "data" / "primer"
AUDIO_DIR = ROOT / "data" / "alphabet"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, VOICES  # noqa


async def speak(text: str, lang_key: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    kw = speak_kwargs(lang_key, context="alphabet")
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))


def text_for_letter(entry: dict) -> str:
    """Build the phrase sent to TTS for one alphabet entry."""
    char = entry.get("char", "")
    # If the char is an accent/breathing placeholder, just say its name
    if not char or all(ord(c) < 32 or c in "◌" for c in char):
        return entry.get("name", "").strip()
    return char


async def main():
    for lang_key in VOICES.keys():
        primer_path = PRIMER_DIR / f"{lang_key}.json"
        voice = lang_key  # placeholder; using lang_key for speak()
        if not primer_path.exists():
            print(f"[{lang_key}] no primer file, skipping")
            continue
        with primer_path.open() as fp:
            primer = json.load(fp)
        alphabet = primer.get("alphabet", [])
        out_dir = AUDIO_DIR / lang_key
        out_dir.mkdir(parents=True, exist_ok=True)
        for idx, entry in enumerate(alphabet):
            out_path = out_dir / f"{idx}.mp3"
            if out_path.exists():
                continue
            text = text_for_letter(entry)
            if not text:
                continue
            try:
                print(f"[{lang_key}:{idx}] {text!r}")
                await speak(text, lang_key, out_path)
            except Exception as exc:
                print(f"[{lang_key}:{idx}] TTS failed: {exc}", file=sys.stderr)
                continue
    print("\n✅ Alphabet audio complete.")


if __name__ == "__main__":
    asyncio.run(main())
