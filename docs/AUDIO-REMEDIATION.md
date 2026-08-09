# Kalopaideia — Audio Files & Streaming Remediation

_Filed 2026-05-20 applying the rules from
`kalopaideia/docs/INFRASTRUCTURE-akousma.md` to the current Kalopaideia
codebase. This is the audit + remediation plan. No code has been
changed yet — Jae needs to sign off because some fixes change
working UX._

## Where audio lives today

| Directory | Files | Purpose |
|---|---|---|
| `data/alphabet/<lang>/` | ~270 files | Letter pronunciations (10 langs) |
| `data/word-audio/<lang>/` | ~100 files | Per-word pronunciations (10 langs) |
| `data/library-audio/<textId>/` | ~thousands | Per-line narration of stoa works |
| `data/grammar-audio/` | varies | Grammar example audio |
| `data/audio/<date>/` | varies | Daily-edition audio |

**Total: 4,886 audio files, ~150 MB on droplet disk.**

## Current architecture vs target

| Rule | Status | Notes |
|---|---|---|
| Pre-generated, not TTS-on-demand | ⚠️ PARTIAL | Two routes still synth on cache miss |
| Stored on object storage (Spaces) + CDN | ❌ NO | All on droplet disk |
| Signed URLs (4 h expiry) | ❌ NO | Plain `<audio src="/library-audio/..">` |
| Subscription gate | ⚠️ PARTIAL | Library audio: ✅. Word audio + alphabet: ❌ |
| Per-IP daily ceiling | ❌ NO | None |
| HLS/DASH chunked streaming | ❌ NO | Monolithic MP3 |
| Opus 64 kbps (vs MP3 128) | ❌ NO | All MP3 |

## The two on-demand TTS routes (rule violation #1)

### 1. `/library-audio/:textId/:line.mp3` (server.js:128)

Falls back to a live `library-audio-line.py` spawn (edge-tts) if the
cache file is missing. **Subscription-gated** via
`enforceLibraryAccess`, so abuse damage is bounded to subscribers.

**Risk: LOW.** Acceptable as a back-stop while we finish pre-generating.
But: every cache miss synthesizes through edge-tts, which is gray-zone
per the 2026-05-12 audit. **Fix:** drive cache-miss rate to zero by
pre-generating remaining lines, then remove the on-demand fallback.

### 2. `/api/word-audio/:lang/:word.mp3` (server.js:426) — **HARDENED 2026-05-20**

Spawned `word-audio.py` (edge-tts) on cache miss with no caps.

**Fix landed 2026-05-20** (`kalopaideia/lib/rate-limit-audio.js` +
`server.js` route changes):

- **Per-IP daily total** cap: 200 requests/IP/day (cache hits + misses).
- **Per-IP daily synth** cap: 30 cache-misses/IP/day.
- **Per-IP burst synth** cap: 10 cache-misses / 10 min.
- **Global daily synth** cap: 500 misses/day across all IPs
  (circuit breaker; returns 503).
- **Input validation**: reject empty, > 200 chars (413), control
  chars (400), non-string.
- **Retry-After header** on all 429 responses.
- Admin-only diagnostics at `/paideia/api/admin/audio-rate-stats`.
- Bypass for trusted callers via `X-Audio-Bypass` header matching
  `AUDIO_BYPASS_TOKEN` env var.

Why not an allowlist? The route serves two surfaces: single-word
pronunciation (reader tap-to-define) AND full-sentence daily-word
audio (app.js, language.js). A strict allowlist would break
tap-to-define on the library reader, which is a core paid feature.
Capping the synth path bounds attacker cost without breaking UX.

**Worst case under attack** (one IP):
- 30 synth/day × ~$0.0001/synth (edge-tts free) = $0.003/day TTS.
- After **Azure Speech (paid)** migration: 30 × $0.000016/char ×
  ~30 chars ≈ $0.014/day. Negligible.
  _Azure chosen over Google Cloud TTS per Claude Design 2026-05-20
  review: edge-tts wraps Azure voices, so migration is near-mechanical
  with no voice change for existing subscribers._
- Global cap stops 500/day total, ~$0.24/day in the worst worst case.

**Still TODO for this route:**
- Migrate the synth path off edge-tts onto **Azure Speech (paid)**
  for the 7 commercial-licensed languages (separate work item).

## Plain-URL audio (rule violation #2)

Every `<audio>` tag uses a stable, guessable URL like
`/paideia/library-audio/<textId>/<line>.mp3`. A scraper can mirror
the entire Akousma library in an afternoon with `wget -r`. The
library-audio route IS subscription-gated, so unauthenticated scrape
fails on paywalled works — but a $9.99 sub one-shot scrape would
succeed.

**Fix:** introduce a signed-URL layer.

1. Add a server endpoint `POST /api/audio/sign` that takes
   `{ kind, textId, line }`, checks entitlement, and returns a
   signed URL with a 4-hour expiry. URL format:
   `/library-audio/<textId>/<line>.mp3?exp=<unix>&sig=<hmac>`
2. The audio static handler verifies `exp` + `sig` before serving.
3. Client code (`reader.js`, `language.js`, `app.js`) requests a
   signed URL before setting `<audio src=...>`.

**Risk if unfixed: MEDIUM.** Catalog can be pirated by anyone who
pays $12.99 once. Same risk profile as DRM-free book sales — bounded
but real.

## Object storage migration (rule violation #3)

150 MB on droplet disk today. Fine for now. Will become a problem
when:

- Akousma adds more stoa works (Vergil's *Aeneid* alone = ~150 hours
  at full narration, ~75 GB at Opus 64 kbps).
- More languages launch.
- Daily-edition audio accumulates without pruning.

**Fix (not urgent, but plan now):**

1. Provision DO Spaces bucket `kalopaideia-audio`.
2. Provision DO Spaces CDN endpoint.
3. Migrate `data/library-audio/` to Spaces first (biggest, most stable).
   Keep `data/word-audio/` and `data/alphabet/` local for now —
   they're small and change with each language launch.
4. Pre-generation pipeline writes directly to Spaces, not local disk.
5. The static `/library-audio` route becomes a signing-and-redirect
   route that returns a signed Spaces CDN URL.
6. Drop the `library-audio-line.py` on-demand fallback once
   pre-generation is complete.

**Threshold to actually do this: 500 GB total or 1,000 paying subs,
whichever comes first.** Below that, the $5/mo Spaces tier doesn't
save enough to justify the migration churn.

## Format: MP3 → Opus 64 kbps (rule violation #4)

All audio is MP3 (128–192 kbps based on edge-tts defaults). Opus 64
kbps sounds identical for narration and is ~50% the bytes.

**Fix:** when re-generating audio for the Azure Speech migration,
output Opus directly. Don't bulk-recode old files — only re-encode
when a file is regenerated for other reasons.

**Risk if unfixed: LOW.** Bandwidth cost on the droplet is invisible
right now. Becomes worth doing on the same day we migrate to Spaces.

## Chunked streaming (rule violation #5)

All audio is served as monolithic MP3. Bots can `wget` the file in
one request. HLS/DASH would force them to assemble chunks, which
slows mass-scrape.

**Risk: LOW.** Defer until after Spaces migration and signed URLs.
Probably not worth doing at all unless we see actual piracy.

## Per-IP daily ceiling (rule violation #6)

No global cap. Add one shared middleware:

- **Audio total**: 2 hours / IP / day across all audio routes
  (`/library-audio`, `/alphabet-audio`, `/word-audio`, `/grammar-audio`).
- **Word-audio synth (cache miss only)**: 50 / IP / day.

Implementation: in-memory `Map<ip, { count, resetAt }>` keyed on
`x-forwarded-for` (behind nginx). No Redis needed at our scale.

## Concrete remediation order

Ranked by risk × ease:

1. **WORD-AUDIO HARDENING (highest priority, blocks no UX).**
   Add IP rate limit + lesson-allowlist to `/api/word-audio`.
   Estimated: 1 file, ~30 lines, half a day. This closes the only
   uncapped TTS-on-demand surface.
2. **Pre-generate remaining library-audio lines.** Run a script that
   walks every line of every stoa work and synthesizes if missing.
   Then add a log line on cache-miss in `/library-audio` so we can
   verify zero misses for a week. Then remove the on-demand fallback.
3. **Signed URLs for `/library-audio`** (after pre-generation hits
   100%). Issues no signing endpoint for `/alphabet-audio` —
   alphabet is a public lesson surface.
4. **Per-IP daily ceiling middleware** across all audio routes.
5. **Azure Speech (paid) migration** for the 7 commercial languages.
   This is the edge-tts sunset Jae approved on 2026-05-12. Azure is
   the chosen target because edge-tts wraps Azure voices — the
   migration is near-mechanical, no re-recording, no jarring voice
   change.
6. **Spaces migration** — wait for the 500 GB / 1,000 sub threshold.

## What I'm NOT recommending

- **Don't pre-recode existing audio to Opus.** Net byte savings on
  150 MB is ~75 MB. Engineering cost > storage savings.
- **Don't add HLS/DASH yet.** No evidence of mass scrape. Pre-mature.
- **Don't move alphabet audio off droplet.** It's tiny, public,
  cached at the CDN edge anyway via nginx.
- **Don't watermark audio.** Per the infra doc, "overkill for now."

## Decisions — APPROVED 2026-05-20

1. **Word-audio hardening:** ✅ Shipped. Persistent SQLite rate limit
   in `kalopaideia/lib/rate-limit-audio.js` + route changes in
   `kalopaideia/server.js`. Verified surviving `systemctl restart`.
2. **edge-tts hard sunset: 2026-08-18.** ~3 months out. Phased
   migration to **Azure Speech (paid)** starts now. Each language
   migrates as the new pipeline goes green; all 10 languages off
   edge-tts by Aug 18, 2026.
3. **Object storage: DO Spaces stays for now.** Re-evaluate moving
   to BunnyCDN when ANY of: 1,000 paying subs, 500 GB egress per
   month, OR $50/month total Spaces bill. The first trigger wins.
4. **EU public-domain lawyer memo: commission at build week 12.**
   Budget $800–1,500. Deliverable: one-pager with green / yellow /
   red status per title in the Akousma + Lodestar catalog. Needed
   before Akousma ships outside the US.
5. **Signed-URL gating for paywalled library audio:** still on the
   roadmap; lands after cross-site auth (CROSS-SITE-AUTH.md
   Option B) is wired.
