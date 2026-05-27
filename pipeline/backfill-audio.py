#!/usr/bin/env python3
"""Generate audio for all backfilled word files."""
import asyncio
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("pip install edge-tts", file=sys.stderr)
    sys.exit(1)

ROOT = Path("/home/jae/.openclaw/workspace/paideia")
WORDS_DIR = ROOT / "data" / "words"
AUDIO_ROOT = ROOT / "data" / "audio"

VOICES = {
    "latin":      "it-IT-IsabellaNeural",
    "greek":      "el-GR-AthinaNeural",
    "french":     "fr-FR-DeniseNeural",
    "german":     "de-DE-KatjaNeural",
    "oldenglish": "en-GB-LibbyNeural",
}

async def speak(text, voice, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    c = edge_tts.Communicate(text, voice, rate="-10%")
    await c.save(str(out_path))

async def main():
    # Only backfill Apr 11–20 (skip newer days that already have audio)
    files = sorted(WORDS_DIR.glob("2026-04-*.json"))
    backfill_files = [f for f in files if f.stem <= "2026-04-20"]
    
    for wf in backfill_files:
        date = wf.stem
        with open(wf) as f:
            issue = json.load(f)
        
        audio_dir = AUDIO_ROOT / date
        for lang, entry in issue.get("languages", {}).items():
            voice = VOICES.get(lang)
            if not voice: continue
            word = entry.get("word", "").strip()
            if not word: continue
            out = audio_dir / f"{lang}.mp3"
            if out.exists():
                print(f"  [{date}/{lang}] exists, skip", file=sys.stderr)
                continue
            print(f"  [{date}/{lang}] '{word}' -> {out}", file=sys.stderr)
            try:
                await speak(word, voice, out)
            except Exception as e:
                print(f"    ERROR: {e}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
