#!/usr/bin/env python3
"""Generate ONE library-audio line on demand.
Usage: library-audio-line.py <text-id> <line-num> <lang> <text>
"""
import asyncio
import sys
from pathlib import Path
import edge_tts

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, add_prosody_hints, preprocess_for_tts  # noqa

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "library-audio"


async def main():
    if len(sys.argv) != 5:
        print("usage: library-audio-line.py <text-id> <line-num> <lang> <text>", file=sys.stderr)
        sys.exit(1)
    text_id = sys.argv[1]
    line_num = sys.argv[2]
    lang = sys.argv[3]
    text = preprocess_for_tts(sys.argv[4], lang)
    text = add_prosody_hints(text)
    
    out_dir = OUT_DIR / text_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{line_num}.mp3"
    if out_path.exists():
        return
    
    kw = speak_kwargs(lang, context="library")
    c = edge_tts.Communicate(text, **kw)
    await asyncio.wait_for(c.save(str(out_path)), timeout=20)
    # Validate that generation succeeded
    if not out_path.exists() or out_path.stat().st_size == 0:
        print(f"generation failed: empty output", file=sys.stderr)
        if out_path.exists():
            out_path.unlink()
        sys.exit(1)
    print(str(out_path))


if __name__ == "__main__":
    asyncio.run(main())
