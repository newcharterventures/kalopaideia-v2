#!/usr/bin/env python3
"""
Generate TTS audio for every line in every library text.
Reads data/library/*.json, writes data/library-audio/<text_id>/<line_n>.mp3
Idempotent.
"""
import asyncio
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed", file=sys.stderr)
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, add_prosody_hints, preprocess_for_tts  # noqa

ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = ROOT / "data" / "library"
OUT_DIR = ROOT / "data" / "library-audio"


async def speak(text: str, lang_key: str, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = preprocess_for_tts(text, lang_key)
    text = add_prosody_hints(text)
    kw = speak_kwargs(lang_key, context="library")
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))


async def main():
    texts = sorted(LIB_DIR.glob("*.json"))
    if not texts:
        print("no texts in library/", file=sys.stderr)
        return
    for text_path in texts:
        with text_path.open() as fp:
            data = json.load(fp)
        text_id = data.get("id")
        lang = data.get("language")
        try:
            speak_kwargs(lang)
        except KeyError:
            print(f"[{text_id}] no voice for {lang}, skipping")
            continue
        out_dir = OUT_DIR / text_id
        out_dir.mkdir(parents=True, exist_ok=True)
        # Collect lines from either flat 'lines' or 'sections[*].lines'
        all_lines = []
        if "sections" in data:
            for sec in data.get("sections", []):
                for ln in sec.get("lines", []):
                    all_lines.append(ln)
        if data.get("lines"):
            all_lines.extend(data["lines"])

        for line in all_lines:
            n = line["n"]
            text = line.get("original", "").strip()
            out_path = out_dir / f"{n}.mp3"
            if out_path.exists() or not text:
                continue
            try:
                print(f"[{text_id}:{n}] {text[:50]}")
                await speak(text, lang, out_path)
            except Exception as exc:
                print(f"[{text_id}:{n}] failed: {exc}", file=sys.stderr)
                continue
    print("\n✅ Library audio complete.")


if __name__ == "__main__":
    asyncio.run(main())
