#!/usr/bin/env python3
"""Pre-render the full Kalopaideia library through the configured TTS backend.

Per the 2026-05-20 TTS-MIGRATION.md plan, this script walks every line of
every library work and generates missing audio. It is:

    * idempotent     — already-rendered files (sha1 cache key) are skipped
    * resume-safe    — a crash mid-run costs minutes, not budget
    * priority-aware — marquee works first, long tail last
    * throttled      — 20 req/sec global cap (Azure F0 ceiling)
    * dry-run safe   — --dry-run prints what would happen, generates nothing

Usage:
    # see what would render
    python3 pre-render-library.py --dry-run

    # render through current TTS_BACKEND env (default: edge-tts)
    python3 pre-render-library.py

    # render through Azure (requires AZURE_SPEECH_KEY)
    TTS_BACKEND=azure python3 pre-render-library.py

    # limit by language or work
    python3 pre-render-library.py --lang greek
    python3 pre-render-library.py --work iliad-book-1

Output: progress to stderr; final tally to stdout.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Iterator, NamedTuple

ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = ROOT / "data" / "library"
AUDIO_DIR = ROOT / "data" / "library-audio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_backend import synth, TTSBackendError  # noqa
from voices import speak_kwargs  # noqa  (validates lang_keys we see)


# ─────────────────────── priority order ───────────────────────

# Per TTS-MIGRATION.md: marquee works first, then short high-value,
# then daily-word backlog (rendered by a separate script), then long tail.
# Each tier is rendered in full before the next begins.

MARQUEE = [
    "iliad-book-1",
    "iliad-book-2",
    "iliad-proem",
    "odyssey-book-1",
    "aeneid-book-1",
    "aeneid-proem",
    "republic-book-1",
]

SHORT_HIGH_VALUE = [
    "sappho-1",
    "catullus-85",
    "dante-inferno-1",
    "cicero-catilinam-1",
    "goethe-erlkoenig",
    "heine-lorelei",
    "villon-ballade-pendus",
    "ronsard-mignonne",
    "beowulf-prologue",
    "caedmons-hymn",
    "wanderer.json".replace(".json", ""),
    "canterbury-prologue",
    "havamal-opening",
    "pwyll-opening",
]

# Anything not in MARQUEE or SHORT_HIGH_VALUE is "long tail".


def priority_tier(text_id: str) -> int:
    if text_id in MARQUEE:
        return 0
    if text_id in SHORT_HIGH_VALUE:
        return 1
    return 2


# ─────────────────────── corpus discovery ───────────────────────

class LineJob(NamedTuple):
    text_id: str
    line_num: str   # string because of Stephanus pagination (327a, etc.)
    lang: str
    text: str

    @property
    def out_path(self) -> Path:
        return AUDIO_DIR / self.text_id / f"{self.line_num}.mp3"

    @property
    def char_count(self) -> int:
        return len((self.text or "").strip())


def iter_corpus(lang_filter: str | None = None, work_filter: str | None = None) -> Iterator[LineJob]:
    """Walk every line of every library work; yield LineJob.

    Sorted by priority tier (marquee → short high value → long tail),
    then by text_id alphabetical inside each tier.
    """
    files = sorted(LIB_DIR.glob("*.json"))
    # Filter out metadata / backups
    files = [f for f in files if "backup" not in f.name and f.name != "library-meta.json"]

    # Group by priority tier
    by_tier: dict[int, list[Path]] = {0: [], 1: [], 2: []}
    for f in files:
        text_id = f.stem
        if work_filter and text_id != work_filter:
            continue
        by_tier[priority_tier(text_id)].append(f)

    for tier in (0, 1, 2):
        for path in by_tier[tier]:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"[pre-render] WARN: failed to parse {path.name}: {e}", file=sys.stderr)
                continue
            lang = data.get("language")
            if lang_filter and lang != lang_filter:
                continue
            text_id = path.stem

            lines = list(data.get("lines") or [])
            for section in data.get("sections") or []:
                lines.extend(section.get("lines") or [])

            for ln in lines:
                line_num = str(ln.get("n", "")).strip()
                orig = (ln.get("original") or "").strip()
                if not line_num or not orig:
                    continue
                yield LineJob(text_id=text_id, line_num=line_num, lang=lang, text=orig)


# ─────────────────────── throttled runner ───────────────────────

class TokenBucket:
    """Simple async token bucket. 20 req/sec by default — matches Azure F0."""

    def __init__(self, rate_per_sec: int = 20):
        self.capacity = rate_per_sec
        self.rate = rate_per_sec
        self.tokens = float(rate_per_sec)
        self.last = time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last
            self.last = now
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            if self.tokens < 1:
                wait = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait)
                self.tokens = 0
            else:
                self.tokens -= 1


async def render_one(job: LineJob, bucket: TokenBucket, stats: dict):
    if job.out_path.exists():
        stats["skipped_cached"] += 1
        return
    try:
        # Validate the lang up front so an unknown lang doesn't reach the network
        speak_kwargs(job.lang)
    except KeyError:
        stats["skipped_unknown_lang"] += 1
        return

    await bucket.acquire()
    try:
        await asyncio.wait_for(
            synth(job.text, job.lang, "library", job.out_path),
            timeout=30,
        )
        stats["rendered"] += 1
        stats["chars_rendered"] += job.char_count
    except asyncio.TimeoutError:
        stats["failed_timeout"] += 1
        print(f"[pre-render] TIMEOUT {job.text_id} line {job.line_num}", file=sys.stderr)
    except TTSBackendError as e:
        stats["failed_backend"] += 1
        print(f"[pre-render] BACKEND ERROR {job.text_id} line {job.line_num}: {e}", file=sys.stderr)
        # Circuit-break errors should halt the whole run, not just this line.
        if "circuit break" in str(e).lower():
            raise


# ─────────────────────── main ───────────────────────

async def main_async(args):
    bucket = TokenBucket(rate_per_sec=args.rate)
    stats = {
        "total_seen": 0,
        "skipped_cached": 0,
        "skipped_unknown_lang": 0,
        "rendered": 0,
        "chars_rendered": 0,
        "failed_timeout": 0,
        "failed_backend": 0,
    }

    jobs = list(iter_corpus(lang_filter=args.lang, work_filter=args.work))
    stats["total_seen"] = len(jobs)

    # Dry-run: count and tier-summarize, generate nothing
    if args.dry_run:
        tier_chars = {0: 0, 1: 0, 2: 0}
        tier_count = {0: 0, 1: 0, 2: 0}
        tier_missing = {0: 0, 1: 0, 2: 0}
        per_lang_missing = {}
        for j in jobs:
            t = priority_tier(j.text_id)
            tier_chars[t] += j.char_count
            tier_count[t] += 1
            if not j.out_path.exists():
                tier_missing[t] += 1
                per_lang_missing[j.lang] = per_lang_missing.get(j.lang, 0) + j.char_count
        print("DRY RUN — nothing rendered\n")
        print(f"Total lines seen:        {stats['total_seen']:,}")
        print(f"Filter lang:             {args.lang or '(all)'}")
        print(f"Filter work:             {args.work or '(all)'}")
        print()
        print(f"{'Tier':<25s} {'Lines':>8s} {'Chars':>10s} {'Missing':>8s}")
        for t, label in [(0, "0  marquee"), (1, "1  short high-value"), (2, "2  long tail")]:
            print(f"{label:<25s} {tier_count[t]:>8,} {tier_chars[t]:>10,} {tier_missing[t]:>8,}")
        print()
        print("Missing chars by language (what a full render would cost):")
        for lang, n in sorted(per_lang_missing.items(), key=lambda x: -x[1]):
            cost = n * 16 / 1_000_000
            print(f"  {lang:<15s} {n:>8,} chars   ~${cost:.4f} on Azure paid tier")
        return

    # Real run — render in tier order
    print(f"[pre-render] starting; backend={__import__('os').environ.get('TTS_BACKEND','edge')} "
          f"jobs={len(jobs)} rate={args.rate}/s", file=sys.stderr)
    started = time.monotonic()

    # Use a moderate semaphore so we don't spin up thousands of pending tasks.
    sem = asyncio.Semaphore(args.concurrency)

    async def _job(j):
        async with sem:
            await render_one(j, bucket, stats)

    try:
        await asyncio.gather(*[_job(j) for j in jobs])
    except TTSBackendError as e:
        print(f"[pre-render] HALTED by circuit break: {e}", file=sys.stderr)

    elapsed = time.monotonic() - started
    print(f"\n[pre-render] done in {elapsed:.1f}s")
    print(json.dumps(stats, indent=2))


def main():
    ap = argparse.ArgumentParser(description="Pre-render Kalopaideia library audio")
    ap.add_argument("--dry-run", action="store_true", help="Plan only; render nothing.")
    ap.add_argument("--lang", help="Only render this language.")
    ap.add_argument("--work", help="Only render this text-id (file stem).")
    ap.add_argument("--rate", type=int, default=20, help="Requests per second (Azure F0 ceiling).")
    ap.add_argument("--concurrency", type=int, default=8, help="Max in-flight requests.")
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
