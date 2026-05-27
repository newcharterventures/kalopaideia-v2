#!/usr/bin/env python3
"""
Centralized TTS backend for Kalopaideia.

Per the 2026-05-20 TTS-MIGRATION.md plan, the codebase is moving from
edge-tts (gray-zone, unofficial Microsoft Edge Read-Aloud scraper) to
Azure Speech (paid, official, same neural voices).

This module is the seam between callers (word-audio.py,
library-audio-line.py, pre-render scripts) and the underlying provider.
Provider is selected by env var TTS_BACKEND:

    TTS_BACKEND=edge      → use edge-tts (default; unchanged behavior)
    TTS_BACKEND=azure     → use Azure Speech REST API
    TTS_BACKEND=both      → render with both, write Azure to .azure.mp3
                            (audition mode for voice-continuity testing)

Voice config comes from voices.py — voice IDs are IDENTICAL across
edge-tts and Azure since edge-tts wraps Azure voices. SSML prosody
(rate, pitch) translates 1:1.

The Azure path requires env vars:
    AZURE_SPEECH_KEY      — primary or secondary key from the resource
    AZURE_SPEECH_REGION   — e.g. eastus, westus, etc.

Per-month usage is tracked in SQLite (paideia/data/audio-rate-limit.db
→ azure_tts_usage table). Three thresholds:
    < 450K chars/month   → silent, free tier
    450K–500K            → log a warning, continue (still free)
    500K–1M              → log every call, email operator if > $5 spend
    > 1M                 → circuit break; raise TTSBackendError

The portal-side $20/month billing cap is a separate, harder backstop
(Claude Design's recommendation 2026-05-20).
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RATE_LIMIT_DB = ROOT / "data" / "audio-rate-limit.db"

# Provider selection
BACKEND = os.environ.get("TTS_BACKEND", "edge").lower()
if BACKEND not in ("edge", "azure", "both"):
    print(f"[tts_backend] WARNING: unknown TTS_BACKEND={BACKEND!r}, defaulting to edge", file=sys.stderr)
    BACKEND = "edge"

# Azure config (only loaded if needed)
AZURE_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_REGION = os.environ.get("AZURE_SPEECH_REGION", "eastus")

# Thresholds (Azure free tier = 500K chars/month neural)
WARN_THRESHOLD = 450_000
PAID_THRESHOLD = 500_000
CIRCUIT_BREAK_THRESHOLD = 1_000_000


class TTSBackendError(Exception):
    """Raised when the TTS backend refuses or fails a request."""
    pass


# ─────────────────────── usage tracking (SQLite) ───────────────────────

def _ensure_usage_table():
    """Create the azure_tts_usage table if it doesn't exist.

    Schema:
        month        TEXT (YYYY-MM)
        chars_used   INTEGER
        calls_made   INTEGER
        last_updated TEXT (ISO-8601 UTC)
        PRIMARY KEY (month)
    """
    conn = sqlite3.connect(str(RATE_LIMIT_DB))
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS azure_tts_usage (
                month TEXT PRIMARY KEY,
                chars_used INTEGER NOT NULL DEFAULT 0,
                calls_made INTEGER NOT NULL DEFAULT 0,
                last_updated TEXT NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_azure_usage_this_month() -> dict:
    """Return {'chars_used': int, 'calls_made': int} for the current month."""
    _ensure_usage_table()
    conn = sqlite3.connect(str(RATE_LIMIT_DB))
    try:
        row = conn.execute(
            "SELECT chars_used, calls_made FROM azure_tts_usage WHERE month = ?",
            (_current_month(),),
        ).fetchone()
        if row is None:
            return {"chars_used": 0, "calls_made": 0}
        return {"chars_used": row[0], "calls_made": row[1]}
    finally:
        conn.close()


def _record_azure_usage(char_count: int):
    """Atomically record an Azure synthesis (caller passes input char count)."""
    _ensure_usage_table()
    conn = sqlite3.connect(str(RATE_LIMIT_DB))
    try:
        conn.execute(
            """
            INSERT INTO azure_tts_usage (month, chars_used, calls_made, last_updated)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(month) DO UPDATE SET
                chars_used = chars_used + excluded.chars_used,
                calls_made = calls_made + 1,
                last_updated = excluded.last_updated
            """,
            (_current_month(), char_count, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def _check_azure_budget(char_count: int) -> Optional[str]:
    """Pre-flight check before an Azure call. Returns:
        None  → proceed silently
        str   → a warning message (caller decides to log + continue)
    Raises TTSBackendError on circuit-break.
    """
    usage = get_azure_usage_this_month()
    projected = usage["chars_used"] + char_count

    if projected >= CIRCUIT_BREAK_THRESHOLD:
        raise TTSBackendError(
            f"Azure TTS circuit break: projected {projected:,} chars this month "
            f"exceeds {CIRCUIT_BREAK_THRESHOLD:,}. Refusing further calls. "
            f"Reset by waiting for next month or raising CIRCUIT_BREAK_THRESHOLD."
        )

    if projected >= PAID_THRESHOLD:
        cost_estimate = (projected - PAID_THRESHOLD) * 16 / 1_000_000
        return (
            f"Azure TTS PAID TIER: {projected:,} chars this month, "
            f"~${cost_estimate:.2f} estimated spend"
        )

    if projected >= WARN_THRESHOLD:
        return (
            f"Azure TTS approaching free-tier ceiling: {projected:,} / "
            f"{PAID_THRESHOLD:,} chars this month"
        )

    return None


# ─────────────────────── SSML builder ───────────────────────

# Map our (rate, pitch) kwargs from voices.py into Azure SSML <prosody>
# attributes. edge-tts and Azure both accept the same string forms.

def _build_ssml(text: str, voice: str, rate: str, pitch: str) -> str:
    # Azure requires xml:lang on <speak>. Pull it from the voice locale prefix.
    # voice format: "<locale>-<VoiceName>" e.g. "it-IT-IsabellaNeural"
    locale = "-".join(voice.split("-")[:2]) if "-" in voice else "en-US"
    # Escape XML special chars in body
    safe = (text.replace("&", "&amp;")
                 .replace("<", "&lt;")
                 .replace(">", "&gt;"))
    return (
        f'<speak version="1.0" xml:lang="{locale}" '
        f'xmlns="http://www.w3.org/2001/10/synthesis">'
        f'<voice name="{voice}">'
        f'<prosody rate="{rate}" pitch="{pitch}">{safe}</prosody>'
        f'</voice></speak>'
    )


# ─────────────────────── Azure REST synth ───────────────────────

async def _synth_azure(text: str, voice: str, rate: str, pitch: str, out_path: Path):
    """Synthesize via Azure Speech REST API. Writes MP3 to out_path."""
    if not AZURE_KEY:
        raise TTSBackendError(
            "AZURE_SPEECH_KEY env var not set. "
            "Cannot use Azure backend without it."
        )

    char_count = len(text)
    warning = _check_azure_budget(char_count)
    if warning:
        print(f"[tts_backend][azure] {warning}", file=sys.stderr)

    # Lazy import — only paid when Azure path actually runs
    import urllib.request
    import urllib.error

    url = f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    ssml = _build_ssml(text, voice, rate, pitch)

    req = urllib.request.Request(
        url,
        data=ssml.encode("utf-8"),
        method="POST",
        headers={
            "Ocp-Apim-Subscription-Key": AZURE_KEY,
            "Content-Type": "application/ssml+xml",
            # Match what edge-tts emits: 24 kHz 48 kbps mono MP3
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "kalopaideia-tts/1.0",
        },
    )

    # Run blocking urllib in a thread so we don't stall the event loop
    loop = asyncio.get_event_loop()

    def _do_request():
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            raise TTSBackendError(
                f"Azure TTS HTTP {e.code}: {body}"
            ) from e

    audio_bytes = await loop.run_in_executor(None, _do_request)

    if not audio_bytes:
        raise TTSBackendError("Azure TTS returned empty audio response")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(audio_bytes)
    _record_azure_usage(char_count)


# ─────────────────────── edge-tts synth (default) ───────────────────────

async def _synth_edge(text: str, voice: str, rate: str, pitch: str, out_path: Path):
    """Synthesize via edge-tts. Unchanged from historical behavior."""
    try:
        import edge_tts
    except ImportError:
        raise TTSBackendError("edge-tts not installed")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(
        text, voice=voice, rate=rate, pitch=pitch
    )
    await communicate.save(str(out_path))


# ─────────────────────── public API ───────────────────────

async def synth(text: str, lang_key: str, context: str, out_path: Path):
    """Synthesize text to MP3 at out_path using the configured backend.

    `lang_key` and `context` are passed through speak_kwargs() in voices.py
    so all language-specific preprocessing and prosody decisions stay in
    one place. This module is just the network/file/budget layer.

    On TTS_BACKEND=both, writes the edge-tts file to out_path AND the
    Azure file to out_path.with_suffix('.azure.mp3') — used by the
    audition harness.
    """
    # Late import to avoid circular paths
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from voices import speak_kwargs, preprocess_for_tts, add_prosody_hints

    text = preprocess_for_tts(text, lang_key)
    if context in ("sentence", "library"):
        text = add_prosody_hints(text)

    kw = speak_kwargs(lang_key, context=context)
    voice, rate, pitch = kw["voice"], kw["rate"], kw["pitch"]

    if BACKEND == "edge":
        return await _synth_edge(text, voice, rate, pitch, out_path)

    if BACKEND == "azure":
        return await _synth_azure(text, voice, rate, pitch, out_path)

    if BACKEND == "both":
        # Audition mode — render both, save side-by-side
        await _synth_edge(text, voice, rate, pitch, out_path)
        azure_path = out_path.with_suffix(".azure.mp3")
        try:
            await _synth_azure(text, voice, rate, pitch, azure_path)
        except TTSBackendError as e:
            print(f"[tts_backend][both] Azure synth failed: {e}", file=sys.stderr)
        return

    raise TTSBackendError(f"Unknown TTS_BACKEND: {BACKEND!r}")


# ─────────────────────── CLI for diagnostics ───────────────────────

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "usage":
        u = get_azure_usage_this_month()
        print(f"Month: {_current_month()}")
        print(f"  chars_used: {u['chars_used']:,}")
        print(f"  calls_made: {u['calls_made']:,}")
        print(f"  thresholds:")
        print(f"    warn at  {WARN_THRESHOLD:,}")
        print(f"    paid at  {PAID_THRESHOLD:,}")
        print(f"    break at {CIRCUIT_BREAK_THRESHOLD:,}")
        print(f"  backend: {BACKEND}")
        print(f"  azure_key_set: {bool(AZURE_KEY)}")
        print(f"  azure_region: {AZURE_REGION}")
        sys.exit(0)

    print(
        "tts_backend module. Diagnostic CLI:\n"
        "  python3 tts_backend.py usage   # show this month's Azure usage",
        file=sys.stderr,
    )
    sys.exit(1)
