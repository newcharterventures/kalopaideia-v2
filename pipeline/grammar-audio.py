#!/usr/bin/env python3
"""
Generate TTS audio for each grammar paradigm cell.
Reads data/primer/<lang>.json.
Writes data/grammar-audio/<lang>/<hash>.mp3 where hash is a stable key based on
the paradigm name + row + column + value. The frontend computes the same hash.
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
PRIMER_DIR = ROOT / "data" / "primer"
AUDIO_DIR = ROOT / "data" / "grammar-audio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, VOICES, preprocess_for_tts  # noqa


def value_hash(value: str) -> str:
    """Stable short hash for a paradigm cell value."""
    return hashlib.sha1(value.strip().encode("utf-8")).hexdigest()[:16]


async def speak(text: str, lang_key: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = preprocess_for_tts(text, lang_key)
    kw = speak_kwargs(lang_key, context="alphabet")  # use slow rate for paradigm cells
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))


def collect_values(primer: dict) -> set:
    """Walk the primer JSON and collect every leaf string in any declension or conjugation paradigm."""
    values = set()
    g = primer.get("grammar", {})
    for key in ("declensions", "conjugations"):
        items = g.get(key, [])
        if not isinstance(items, list):
            continue
        for entry in items:
            paradigm = entry.get("paradigm", {})
            if not isinstance(paradigm, dict):
                continue
            for _row, inner in paradigm.items():
                if isinstance(inner, dict):
                    for _col, val in inner.items():
                        if isinstance(val, str) and val.strip():
                            # Keep only the first word if multiple given (e.g., "puella / puella")
                            first = val.strip().split("/")[0].strip()
                            values.add(first)
                elif isinstance(inner, str) and inner.strip():
                    values.add(inner.strip().split("/")[0].strip())
    return values


async def main():
    for lang in VOICES.keys():
        primer_path = PRIMER_DIR / f"{lang}.json"
        if not primer_path.exists():
            continue
        with primer_path.open() as fp:
            primer = json.load(fp)
        values = collect_values(primer)
        out_dir = AUDIO_DIR / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"[{lang}] {len(values)} unique paradigm forms")
        for val in sorted(values):
            # Skip empty/punctuation-only
            if not val or all(not c.isalpha() for c in val):
                continue
            h = value_hash(val)
            out_path = out_dir / f"{h}.mp3"
            if out_path.exists():
                continue
            try:
                await speak(val, lang, out_path)
            except Exception as exc:
                print(f"[{lang}] {val!r} failed: {exc}", file=sys.stderr)
    print("\n✅ Grammar audio complete.")


if __name__ == "__main__":
    asyncio.run(main())
