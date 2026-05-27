#!/usr/bin/env python3
"""Generate ONE library-audio line on demand.

Usage: library-audio-line.py <text-id> <line-num> <lang> <text>

Backend (edge-tts vs Azure Speech) is selected by env var TTS_BACKEND.
See pipeline/tts_backend.py for details. CLI signature unchanged so
the server's spawn() in server.js keeps working.
"""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "library-audio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_backend import synth, TTSBackendError


async def main():
    if len(sys.argv) != 5:
        print("usage: library-audio-line.py <text-id> <line-num> <lang> <text>", file=sys.stderr)
        sys.exit(1)
    text_id = sys.argv[1]
    line_num = sys.argv[2]
    lang = sys.argv[3]
    text = sys.argv[4]

    out_dir = OUT_DIR / text_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{line_num}.mp3"
    if out_path.exists():
        return

    try:
        # 20-second timeout (matches historical behavior of the previous
        # edge-tts implementation)
        await asyncio.wait_for(
            synth(text, lang, "library", out_path),
            timeout=20,
        )
    except asyncio.TimeoutError:
        print("generation timed out", file=sys.stderr)
        sys.exit(1)
    except TTSBackendError as e:
        print(f"tts_backend error: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate that generation succeeded
    if not out_path.exists() or out_path.stat().st_size == 0:
        print(f"generation failed: empty output", file=sys.stderr)
        if out_path.exists():
            out_path.unlink()
        sys.exit(1)
    print(str(out_path))


if __name__ == "__main__":
    asyncio.run(main())
