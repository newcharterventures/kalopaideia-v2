#!/usr/bin/env python3
"""Generate audio for one library text. Usage: library-audio-single.py <text-id>"""
import asyncio
import json
import sys
from pathlib import Path
import edge_tts

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voices import speak_kwargs, add_prosody_hints, preprocess_for_tts  # noqa

ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = ROOT / "data" / "library"
OUT_DIR = ROOT / "data" / "library-audio"

async def speak(text, lang_key, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = preprocess_for_tts(text, lang_key)
    text = add_prosody_hints(text)
    kw = speak_kwargs(lang_key, context="library")
    communicate = edge_tts.Communicate(text, **kw)
    await communicate.save(str(out_path))

async def main():
    text_id = sys.argv[1]
    path = LIB_DIR / f"{text_id}.json"
    with open(path) as f:
        data = json.load(f)
    lang_key = data["language"]
    speak_kwargs(lang_key)  # validate
    out_dir = OUT_DIR / text_id
    out_dir.mkdir(parents=True, exist_ok=True)
    
    lines = []
    if "sections" in data:
        for sec in data["sections"]:
            lines.extend(sec.get("lines", []))
    if data.get("lines"):
        lines.extend(data["lines"])
    
    kw = speak_kwargs(lang_key, context="library")
    print(f"[{text_id}] {len(lines)} lines, voice={kw['voice']} rate={kw['rate']} pitch={kw['pitch']}", flush=True)
    
    for line in lines:
        n = line["n"]
        text = (line.get("original") or "").strip()
        out_path = out_dir / f"{n}.mp3"
        if out_path.exists() or not text:
            continue
        try:
            print(f"  [{n}] {text[:60]}", flush=True)
            await asyncio.wait_for(speak(text, lang_key, out_path), timeout=60)
        except asyncio.TimeoutError:
            print(f"  [{n}] TIMEOUT", flush=True)
        except Exception as e:
            print(f"  [{n}] FAIL: {e}", flush=True)
    
    files = sorted(out_dir.glob("*.mp3"))
    print(f"[{text_id}] done: {len(files)} files", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
