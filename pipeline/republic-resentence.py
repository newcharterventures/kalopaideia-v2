#!/usr/bin/env python3
"""
Re-ingest Republic Book I:
  1. Read clean Jowett translation from /tmp/republic-book1-en.txt
  2. For each Stephanus section (327-354), use Sonnet to:
     - Split the Greek paragraph into sentences
     - Find the matching English passage from Jowett
     - Split English into sentences aligned to Greek
  3. Write new lines[] with each entry being one sentence.
     - n: stephanus + letter (327a, 327b, ...)
     - original: one Greek sentence
     - english: aligned English sentence(s)
     - gloss: keep existing per-stephanus gloss
"""
import json
import sys
import time
from pathlib import Path
import anthropic

ROOT = Path("/home/jae/.openclaw/workspace/paideia")
LIB = ROOT / "data" / "library" / "republic-book-1.json"
EN_FILE = Path("/tmp/republic-book1-en.txt")

MODEL = "claude-sonnet-4-5"

def load_api_key():
    return json.load(open("/home/jae/.openclaw/workspace/multi-model-engine/config.json"))["claude_api_key"]

PROMPT = """You are aligning Plato's Republic Book I, Stephanus section {n}, sentence-by-sentence.

GREEK (from Perseus, one Stephanus section):
{greek}

ENGLISH (Jowett translation, full Book I — find ONLY the portion that corresponds to this Greek section):
{english}

Your task:
1. Split the Greek into individual sentences. Trust the Greek punctuation (·, ;, .). Each Greek sentence becomes one entry.
2. For each Greek sentence, find the matching English from Jowett. English may not align 1:1 — sometimes one Greek sentence covers multiple English sentences, sometimes vice versa. Group them so each entry has complete thought-units.
3. Output a JSON array. Each entry: {{"original": "<one Greek sentence>", "english": "<matched English>"}}

HARD RULES:
- Use ONLY clean Jowett English. No editorial apparatus, no footnote text, no "Cf." references, no manuscript notes.
- Greek text must be verbatim from input.
- Preserve Greek polytonic accents/breathing marks exactly.
- If a Greek sentence has no clear English match (e.g. it's a rhetorical fragment), use a translation that fits the Jowett style.
- Output ONLY the JSON array. No preamble, no code fence.

Output now:"""

def main():
    client = anthropic.Anthropic(api_key=load_api_key())
    
    with open(LIB) as f:
        data = json.load(f)
    
    # Save backup
    backup = LIB.parent / f"republic-book-1.backup-{int(time.time())}.json"
    backup.write_text(LIB.read_text())
    print(f"Backed up to {backup.name}", flush=True)
    
    en_full = EN_FILE.read_text()
    
    new_lines = []
    
    for line in data["lines"]:
        n = line["n"]
        greek = line["original"]
        gloss = line.get("gloss", "")
        
        print(f"[{n}] aligning {len(greek)} chars of Greek...", flush=True)
        
        prompt = PROMPT.format(n=n, greek=greek, english=en_full)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            if text.startswith("json\n"):
                text = text[5:]
        
        try:
            sentences = json.loads(text)
        except json.JSONDecodeError as e:
            print(f"  [{n}] JSON parse failed: {e}", flush=True)
            print(f"  raw: {text[:200]}", flush=True)
            # Fallback: keep as one entry
            new_lines.append({"n": str(n), "original": greek, "english": "", "gloss": gloss})
            continue
        
        for i, s in enumerate(sentences):
            sub_n = f"{n}{chr(ord('a') + i)}"  # 327a, 327b, ...
            entry = {
                "n": sub_n,
                "original": s.get("original", "").strip(),
                "english": s.get("english", "").strip(),
            }
            # Attach gloss to first sentence only
            if i == 0 and gloss:
                entry["gloss"] = gloss
            new_lines.append(entry)
        
        print(f"  [{n}] split into {len(sentences)} sentences", flush=True)
    
    data["lines"] = new_lines
    
    with open(LIB, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Wrote {len(new_lines)} sentence entries to {LIB.name}", flush=True)

if __name__ == "__main__":
    main()
