#!/usr/bin/env python3
"""Voice-continuity audition harness for the Azure migration.

Per TTS-MIGRATION.md, before we flip production to Azure we must verify
that edge-tts and Azure produce indistinguishable audio for the SAME
voice/rate/pitch parameters (they should, since edge-tts wraps Azure).

This script:
    1. Picks 2 representative passages from each of the 9 active languages
       (20 passages total, drawn from the actual library on disk).
    2. Renders each through BOTH edge-tts AND Azure.
    3. Drops the resulting MP3 pairs in /tmp/azure-audition/<lang>/<passage>/
       so Jae (or a reviewer) can listen side-by-side.
    4. Prints a manifest with file paths and char counts.

Usage:
    AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=eastus \\
        python3 pipeline/audition-azure.py

By default uses TTS_BACKEND=both so each call writes both files in one
go. Forces both even if env says otherwise — this script is only useful
in audition mode.

Files dropped:
    /tmp/azure-audition/<lang>/<passage>/edge.mp3       (edge-tts output)
    /tmp/azure-audition/<lang>/<passage>/azure.mp3      (Azure output)
    /tmp/azure-audition/manifest.json                   (everything rendered)
"""
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "data" / "library"

# Force audition mode regardless of env
os.environ["TTS_BACKEND"] = "both"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_backend import synth, TTSBackendError  # noqa


# 2 passages per language. Hand-picked to cover the prosodic range
# (epic verse, lyric, prose, ritual) and the preprocessing edge cases
# (macrons, polytonic Greek, OE thorn/eth, ME yogh, etc.)
AUDITION_PASSAGES = {
    "greek": [
        # Sappho 1 — short lyric, polytonic accents
        ("sappho-1-line-1", "ποικιλόθρον' ἀθανάτ' Ἀφρόδιτα,"),
        # Iliad Book 1 opening — epic hexameter
        ("iliad-1-line-1", "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος"),
    ],
    "latin": [
        # Catullus 85 — famous distich, macrons
        ("catullus-85-line-1", "Ōdī et amō. Quārē id faciam, fortasse requīris."),
        # Aeneid Book 1 opening
        ("aeneid-1-line-1", "Arma virumque canō, Trōiae quī prīmus ab ōrīs"),
    ],
    "french": [
        # Ronsard — Renaissance lyric
        ("ronsard-line-1", "Mignonne, allons voir si la rose"),
        # Villon — late medieval ballade
        ("villon-line-1", "Frères humains qui après nous vivez"),
    ],
    "german": [
        # Goethe Erlkönig — ballad opener
        ("erlkoenig-line-1", "Wer reitet so spät durch Nacht und Wind?"),
        # Heine Lorelei — short lyric
        ("lorelei-line-1", "Ich weiß nicht, was soll es bedeuten,"),
    ],
    "italian": [
        # Dante Inferno opening
        ("inferno-line-1", "Nel mezzo del cammin di nostra vita"),
        # Same canto, line that exercises diphthongs
        ("inferno-line-3", "che la diritta via era smarrita."),
    ],
    "welsh": [
        # Pwyll opening — Middle Welsh prose
        ("pwyll-line-1", "Pwyll Pendeuic Dyuet a oed yn arglwyd ar seith cantref Dyuet."),
        # Same passage, exercises ll/ch/dd
        ("pwyll-line-2", "Ac yn yr amser hwnnw yd oed yn Arberth, prif lys idaw."),
    ],
    "oldenglish": [
        # Beowulf opening — alliterative verse, thorn/eth
        ("beowulf-line-1", "Hwæt! Wē Gār-Dena in geār-dagum"),
        # Caedmon's Hymn — short hymn, OE inventory
        ("caedmon-line-1", "Nū sculon herigean heofonrīces Weard"),
    ],
    "middleenglish": [
        # Canterbury Prologue opening
        ("canterbury-line-1", "Whan that Aprill with his shoures soote"),
        # Same passage, exercises yogh-substituted gh
        ("canterbury-line-2", "The droghte of March hath perced to the roote,"),
    ],
    "oldnorse": [
        # Hávamál opening — Eddic verse, thorn/eth
        ("havamal-line-1", "Gáttir allar áðr gangi fram"),
        # Same, exercises long vowels with accent
        ("havamal-line-2", "um skoðaz skyli, um skygnaz skyli,"),
    ],
}


async def main():
    out_root = Path("/tmp/azure-audition")
    out_root.mkdir(parents=True, exist_ok=True)

    manifest = {
        "passages": [],
        "backend": os.environ.get("TTS_BACKEND"),
        "azure_region": os.environ.get("AZURE_SPEECH_REGION", "eastus"),
        "azure_key_set": bool(os.environ.get("AZURE_SPEECH_KEY")),
    }

    for lang, passages in AUDITION_PASSAGES.items():
        for passage_id, text in passages:
            out_dir = out_root / lang / passage_id
            out_dir.mkdir(parents=True, exist_ok=True)
            edge_path = out_dir / "edge.mp3"
            azure_path = out_dir / "azure.mp3"

            # tts_backend in "both" mode writes edge to out_path and
            # azure to out_path.with_suffix('.azure.mp3'). Use a base
            # name and rename after.
            base = out_dir / "edge.mp3"
            azure_base = base.with_suffix(".azure.mp3")
            print(f"[audition] {lang}/{passage_id} ({len(text)} chars)...", file=sys.stderr)
            try:
                await synth(text, lang, "library", base)
            except TTSBackendError as e:
                print(f"  FAILED: {e}", file=sys.stderr)
                manifest["passages"].append({
                    "lang": lang, "passage_id": passage_id, "text": text,
                    "chars": len(text),
                    "edge": None, "azure": None, "error": str(e),
                })
                continue

            # Move the .azure.mp3 to the canonical name
            if azure_base.exists():
                azure_base.rename(azure_path)

            manifest["passages"].append({
                "lang": lang,
                "passage_id": passage_id,
                "text": text,
                "chars": len(text),
                "edge": str(edge_path) if edge_path.exists() else None,
                "azure": str(azure_path) if azure_path.exists() else None,
                "edge_bytes": edge_path.stat().st_size if edge_path.exists() else 0,
                "azure_bytes": azure_path.stat().st_size if azure_path.exists() else 0,
            })

    manifest_path = out_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    total_chars = sum(p["chars"] for p in manifest["passages"])
    edge_ok = sum(1 for p in manifest["passages"] if p.get("edge"))
    azure_ok = sum(1 for p in manifest["passages"] if p.get("azure"))

    print()
    print(f"Audition complete. Manifest: {manifest_path}")
    print(f"  passages:    {len(manifest['passages'])}")
    print(f"  edge ok:     {edge_ok}")
    print(f"  azure ok:    {azure_ok}")
    print(f"  total chars: {total_chars:,}")
    print()
    print("Listen side-by-side, e.g.:")
    print(f"  cd /tmp/azure-audition")
    print(f"  for d in */*/; do echo \"$d\"; mpv --quiet \"$d/edge.mp3\"; mpv --quiet \"$d/azure.mp3\"; done")


if __name__ == "__main__":
    asyncio.run(main())
