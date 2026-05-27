# Kalopaideia TTS Migration — edge-tts → Azure Speech

_Filed 2026-05-20. Plan for migrating Kalopaideia's audio narration off
gray-zone edge-tts onto licensed Azure Speech (paid) by the hard
sunset date **2026-08-18** approved by Jae the same day. Drafted by
OpenClaw against actual on-disk corpus counts, with corrections from
Claude Opus's review._

## Why Azure, not Google

We considered Google Cloud TTS (Opus's review surfaced this option
again) and reaffirmed Azure for one decisive reason: **voice
continuity**.

edge-tts is an unauthorized screen-scraper around Microsoft Edge's
"Read Aloud" feature, which calls the same neural-voice endpoints
Azure Speech exposes officially. Same voice IDs (`it-IT-IsabellaNeural`,
`de-DE-SeraphinaMultilingualNeural`, etc.), same SSML, same prosody
hints. Migration is mostly: swap the HTTP endpoint, add a Bearer auth
header, keep the same voice config table. Existing listeners hear no
audible change.

Google Cloud TTS uses entirely different voice models (WaveNet,
Neural2, Chirp HD). Migrating to Google means re-recording every
cached audio file with a different-sounding voice — and any returning
subscriber notices the swap mid-book. Bad UX on a literature site
where **the voice IS the product**.

The free-tier math reinforces this rather than challenges it:

| Provider | Free tier (perpetual) | Overage (paid) |
|---|---|---|
| **Azure F0** | 500K neural chars/month | $16 / 1M chars (standard neural); $22 / 1M (HD) |
| Google | 4M chars/month standard + 1M neural + 1M Chirp HD | $4 / 1M (standard); $16 / 1M (WaveNet/Neural2) |

Yes, Google's neural free tier is 2× Azure's. But (see corpus numbers
below) the entire Kalopaideia library fits comfortably inside Azure's
500K/month tier on its first render, and the ongoing per-day burn is
~1K chars. The free tier is not the binding constraint here. Voice
continuity is.

**Past the free tier, per-character pricing is essentially identical**
($16 / 1M chars on Azure Neural vs ~$16 / 1M on Google Neural2). The
2× free-tier gap is a one-time accounting difference that vanishes
the moment we cross the threshold — and our corpus doesn't cross it.

**Coverage matters more than the cost gap.** Google's neural catalogue
is thinner on dead and minority languages. We rely on Welsh
(`cy-GB-NiaNeural`), Icelandic-as-Old-Norse (`is-IS-GudrunNeural`),
German-Seraphina-as-Greek, and Italian-Isabella-as-Latin. Azure has
all four; some are absent or weaker on Google. Switching providers
would trade voice continuity AND coverage for a free-tier delta we'll
never exhaust.

## Languages live today

Confirmed from the on-disk corpus (`data/today.json`,
`data/library/*.json`, `pipeline/voices.py`) on 2026-05-20.

**Voice cast — authoritative** (per Jae's 2026-04-25 audition,
reaffirmed 2026-05-20 when Claude Design proposed a male-only cast).
Female-led, with the one male voice on Middle English where Ryan's
gutturals reproduce the consonantal attack of c.1380 London.

| Language | Profile | Voice (Azure ID) | Rate / pitch | Native support? |
|---|---|---|---|---|
| Greek | Ancient / Homeric | `de-DE-SeraphinaMultilingualNeural` | −15% / −3 Hz | 🟡 Substitute (Modern Greek floor + SSML) |
| Greek | Koine (NT / Septuagint) | _same base + Koine SSML profile_ | TBD | 🟡 Forward placeholder — no live Koine works yet |
| Latin | Classical (Dido gravitas) | `it-IT-IsabellaNeural` | −18% / −8 Hz | 🟡 Substitute (Italian voice) |
| French | Literary | `fr-FR-VivienneMultilingualNeural` | −8% / +1 Hz | ✅ Native |
| German | Goethean / philosophical | `de-DE-SeraphinaMultilingualNeural` | −10% / −1 Hz | ✅ Native |
| Italian | Tuscan inheritance | `it-IT-IsabellaNeural` | −10% / 0 Hz | ✅ Native |
| Welsh | Middle + Modern | `cy-GB-NiaNeural` | −10% / 0 Hz | ✅ Native (Modern; passable for Middle) |
| Old English | Elvish-lifted Sonia | `en-GB-SoniaNeural` | −10% / +5 Hz | 🟡 Substitute (en-GB + ash/eth/thorn lexicon) |
| Middle English | Ryan + ME phonetics | `en-GB-RyanNeural` | −15% / −2 Hz | 🟡 Substitute (yogh/gh restored, final-e schwa) |
| Old Norse | Saga register | `is-IS-GudrunNeural` | −15% / −2 Hz | 🟡 Substitute (Modern Icelandic) |
| English (modern) | Translations of English originals | `en-GB-RyanNeural` (default) / `en-US-AndrewNeural` (alt) | tbd | ✅ Native — added 2026-05-20 |

**1 language alphabet-only, no daily rotation**: Gaulish (falls back to
the French voice for Latin-alphabet inscriptions, Greek voice for
Gallo-Greek). Not part of the live TTS migration scope.

**Total: 9 live profiles + 1 alphabet-only (Gaulish) + 1 forward
placeholder (Koine Greek) + 1 added 2026-05-20 (Modern English, for
translations of English-original works like Shakespeare or Milton if
they enter the library).**

### Why we kept the female-led cast (decision log 2026-05-20)

Claude Design's TTS playbook proposed an all-male cast (Nestoras,
Diego, Conrad, Henri, Ryan, Gunnar). We considered the proposal and
rejected the cast swap for two reasons:

1. **Voice continuity is the entire reason we chose Azure.** edge-tts
   wraps the SAME voices Azure sells. Migrating to Azure with
   identical voice IDs means listeners hear no change. Swapping the
   cast on the same day undoes that promise.
2. **The current cast was auditioned.** Jae picked Isabella for Latin
   (Dido gravitas), Seraphina for Greek (Pythian weight), Vivienne for
   French (literary lilt), Sonia-lifted for Old English (Elvish dignity
   without modern lilt), Gudrun for Old Norse (Icelandic preserves the
   thorn/eth phonology). Each pick is documented in `voices.py`
   comments with the audition date and rationale.

What we DID adopt from Claude Design's audio playbook:

- **A/B canary phase** before full cutover (§ Migration phases below)
- **Per-language telemetry** (chars_billed, cache_hit_ratio,
  per-language consumption split)
- **Scheduler priority** (5-tier queue when free tier approaches the
  soft cap)
- **Koine Greek as a separate SSML profile** (forward placeholder for
  when NT / Septuagint texts enter the library)
- **Modern English row** (for translations of English-original works
  if we add Shakespeare, Milton, etc. to Akousma)
- **Voice consent / licensing check** added to Jae's open decisions

## Classical-language fidelity roadmap (the honest part)

Of the 9 active languages, **5 have no native TTS voice on Azure
(or Google, or any major cloud provider)**:

- Ancient/Koine Greek
- Classical Latin
- Old English
- Middle English
- Old Norse

What we ship today is a chain of approximations:

1. Phonetic-respelling preprocessor (`middle_english_phonetics.py`,
   the macron/eth/thorn maps in `voices.py`) converts the source text
   into something a modern voice can pronounce.
2. The modern voice (Italian for Latin, Modern Greek for Ancient
   Greek, etc.) reads the respelled text.
3. We accept that the result is a *reading*, not a reconstruction:
   - Italian-voice Latin sounds ecclesiastical, not Restored Classical
     (no aspirated stops, no quantitative meter).
   - German-Seraphina Greek loses iotacism distinctions and metrical
     ictus.
   - Modern Icelandic on Eddic verse is roughly right but flat.
   - Modern British English on Old English forces silent letters the
     OE phonotactics didn't have.

The **long-term fix is not a different cloud provider**. It is local
inference on the MS-02 GPU box (Jae's planned hardware) running
VibeVoice or similar with LoRA fine-tunes trained on the Daitz, Bagby,
and Allen restored-pronunciation recordings. That work is out of scope
for the Aug-18 migration but should be filed as the eventual successor.

Migrating to Azure is therefore explicitly an **interim** move: it
closes the edge-tts licensing exposure with zero perceptible voice
change, and buys us 6–12 months to bring the local-inference pipeline
up to quality.

## Corpus inventory (real, measured 2026-05-20)

### One-time library narration cost

| Language | Library text on disk | Render cost @ Azure $16/1M |
|---|---|---|
| Greek | 138,697 chars | $2.22 |
| Latin | 34,529 chars | $0.55 |
| Old English | 2,147 chars | $0.03 |
| Middle English | 1,599 chars | $0.03 |
| Old Norse | 1,292 chars | $0.02 |
| Italian | 1,279 chars | $0.02 |
| German | 1,004 chars | $0.02 |
| French | 941 chars | $0.02 |
| Welsh | 408 chars | $0.01 |
| Gaulish | 194 chars | $0.00 |
| **TOTAL** | **182,090 chars** | **$2.91** |

**182K chars is well under one month of Azure's 500K free tier.** The
entire current library can be re-rendered into Azure voices in a single
afternoon, inside the free tier, with zero spend. Even at 5× the
current corpus we'd stay under one month's free allotment.

### Ongoing daily burn (measured)

Daily-word audio across all 9 active languages, computed from
`data/words/<date>.json` files: **~1,015 chars/day** ≈ **30K chars/month**.

That's 6% of the Azure F0 free tier in steady state. The free tier
covers a 16× growth in daily content before overage begins.

### Library expansion budget

If Jae approves new library works at the rate of one major work per
language per quarter (a generous ceiling), each major addition is
~30K–100K chars (one ancient-epic book is ~25K chars). At three new
major works per quarter across 9 languages, that's ~300K chars/quarter
≈ 100K/month — still well under the free tier.

**Conclusion: Azure F0's 500K/month is more than enough for Kalopaideia
in its current and near-future form.** Paid-tier spend should never
exceed $5/month except during a one-time backlog render of cached
audio.

## Migration mechanics

### What changes in `pipeline/`

The on-disk voice config in `voices.py` does NOT change at all. Voice
IDs are identical between edge-tts and Azure Speech.

What changes is `word-audio.py` and `library-audio-line.py`: replace

```python
import edge_tts
communicate = edge_tts.Communicate(text, voice, rate=..., pitch=...)
await communicate.save(outpath)
```

with the Azure Speech SDK pattern:

```python
import azure.cognitiveservices.speech as speechsdk
config = speechsdk.SpeechConfig(subscription=KEY, region=REGION)
config.speech_synthesis_voice_name = voice
synth = speechsdk.SpeechSynthesizer(speech_config=config, audio_config=AUDIO_OUT)
ssml = f'<speak><voice name="{voice}"><prosody rate="{rate}" pitch="{pitch}">{text}</prosody></voice></speak>'
synth.speak_ssml_async(ssml).get()
```

Or the simpler REST endpoint (no SDK, easier to rate-limit ourselves):

```
POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1
Headers: Ocp-Apim-Subscription-Key: <key>
         Content-Type: application/ssml+xml
         X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3
Body: <speak version="1.0" xml:lang="en-US">
        <voice name="it-IT-IsabellaNeural">
          <prosody rate="-18%" pitch="-8Hz">
            <text>
          </prosody>
        </voice>
      </speak>
```

REST is simpler for our scale. Estimated change: ~40 lines per pipeline
script. Total migration: maybe a day of careful work + a regression
audition.

### Free-tier governance (must-build)

Per the 2026-05-20 cost-ceiling aphorism in `MEMORY.md`:
**every cost ceiling is only as real as the database table behind it.**

Build a new SQLite table (extends the existing
`paideia/data/audio-rate-limit.db`):

```sql
CREATE TABLE IF NOT EXISTS azure_tts_usage (
  month TEXT NOT NULL,        -- YYYY-MM
  chars_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (month)
);
```

Every Azure synthesis increments `chars_used` by the character count
of the input text. The pipeline checks this counter BEFORE each call:

- < 450K chars used this month → proceed normally.
- 450K–500K → log a warning, continue (still inside free tier).
- > 500K → fall into paid tier; log every call with cost estimate;
  email the operator if monthly spend will exceed $5.
- > 1M → circuit-breaker. Synth requests return a polite "audio being
  prepared" error rather than continue billing.

This means Azure overage is bounded at ~$8/month even in pathological
cases.

**Defense in depth: Azure portal-side budget cap.** Set a hard
billing alert + cap **in the Azure portal itself**, not just in our
app:

- Budget: **$20 / month** for the Speech resource.
- Alert at 50% ($10), 80% ($16), and 100% ($20).
- At 100%, Azure's budget action automatically suspends the Speech
  resource.

This is belt-and-suspenders against the in-app `azure_tts_usage`
counter. If our app-side counter has a bug (under-counts, fails to
persist, etc.), the portal cap is a hard backstop that fires
regardless. If a runaway pre-render job loops on the same passage,
the portal stops the bleeding even if our app doesn't notice.

Neither cap should ever fire in normal operation. Both should exist.

### Migration phases (Claude Design 2026-05-20, adopted)

Low-risk phased cutover. The existing edge-tts cache is preserved
throughout — we never regenerate audio that already exists.

**Phase 1 — Shim** (1 day): `tts_backend.py` already exposes
`TTS_BACKEND=edge|azure|both` selection via env var (shipped earlier
today). Both paths speak the same `synth(text, lang, context, out_path)`
interface. ✅ Done.

**Phase 2 — Canary** (1 week, starts when AZURE_SPEECH_KEY lands):
set `TTS_BACKEND=both` so every NEW synthesis renders through BOTH
edge-tts and Azure for the audition window. The edge-tts file is the
live one served to users; the Azure file is dropped at
`<out>.azure.mp3` for side-by-side listening. Run
`pipeline/audition-azure.py` to generate the 20-passage continuity
test. Listen, confirm indistinguishable, log any discrepancies.

**Phase 3 — Cutover** (1 day): flip `TTS_BACKEND=azure` in the
production systemd Environment line. New synthesis routes exclusively
through Azure. edge-tts code path stays in `tts_backend.py` for one
release as a dev-only fallback, then removed.

**Phase 4 — Reconciliation** (ongoing): re-tag the existing cache
manifest so edge-tts files are attributed to the matching Azure voice
ID. **No regeneration.** Files keep playing exactly as they always
have; only the metadata catches up.

### Telemetry & scheduler priority (Claude Design 2026-05-20, adopted)

When the free tier approaches the soft cap, the scheduler should
favor user-visible content over backfill. Five-tier priority order:

1. **Today's daily-word audio** (must ship same day; user-facing)
2. **Canonical works without audio yet** (Iliad, Aeneid, etc. that
   are linked from the homepage / Akousma catalog)
3. **Newly added library books** (within 24 hours of ingestion)
4. **Backfill for the long tail** (older library lines, less-trafficked)
5. **Re-renders triggered by voice/lexicon updates** (NEVER blocks the
   above tiers)

Telemetry the system records every day:

- `chars_billed` (synthesis cost — cache misses only)
- `chars_cached` (cache hits — zero Azure cost)
- `cache_hit_ratio` = cached / (cached + billed)
- **Per-language consumption split** (so we can see which language
  is eating the budget — expected: Latin and Greek dominate)
- Monthly burn-down graph (chars_billed vs. 500K free-tier ceiling)

Admin diagnostics endpoint:
`GET /paideia/api/admin/tts-stats` (already in tts_backend.py as
`getAudioRateLimitStats` for the rate-limit table; extend with the
Azure usage table queries).

### Caching principle: audio is permanent

Every file generated through Azure (or edge-tts, historically) is
**permanent on disk**. Once a passage is rendered with a given voice +
rate + pitch + text, the file is keyed on `sha1(...)` and re-served on
every future request for that exact tuple. There is no TTL, no
expiry, no "refresh" pipeline. **A book narrated once never costs
Azure again.**

This is what makes the free-tier math work: the 182K-char library is
a one-time render, not a recurring cost. The only ongoing Azure spend
is genuinely new content (new daily-word entries, new library works
Jae adds).

Corollary: when we eventually re-render for a voice-quality upgrade
(MS-02 local inference, restored-pronunciation LoRA, etc.), we use
**different cache keys** so old files stay valid until explicitly
deprecated. Voice upgrades are additive, not destructive.

### Queue strategy (priority + batching)

When the pre-generation script runs to migrate the existing corpus:

1. **Priority order**: most-popular works first. We don't have view
   analytics yet, so initial priority order is editorial:
   - Iliad Book 1, Odyssey Book 1, Aeneid Book 1 (the marquee works
     the audition recordings highlighted)
   - Sappho, Catullus, Dante, Goethe (short, high-value, often-cited)
   - The Greek/Latin daily-word backlog (most uncached entries)
   - The long tail (Old English, Welsh, Old Norse one-offs)
2. **Batch overnight.** Burst the entire renderable backlog in one
   pass (it all fits in free tier anyway), but rate-limit Azure
   requests to 20 req/sec to stay below their per-account API
   throttle (Azure F0 limit is 20 transactions/sec).
3. **Idempotent**: keyed on `sha1(voice + rate + pitch + text)[:16]`
   so re-runs after a partial failure don't re-spend.

Resume-safe means a crash mid-run costs minutes, not budget.

### Voice-continuity test (must-pass before sunset)

Before flipping production to Azure, run a side-by-side diff:

1. Take 20 representative passages (2 per language).
2. Render each through both edge-tts (current) and Azure Speech (new)
   with identical voice/rate/pitch parameters.
3. Audio-fingerprint compare or simply listen — they should be
   indistinguishable. If a passage diverges noticeably, investigate
   (likely an SSML quirk).
4. Only after all 20 pass: ship.

## What we are NOT migrating

- **The voice-config table.** `voices.py` is the source of truth and
  it's already correct.
- **The preprocessing maps** (macron stripping, Old English ash/eth/
  thorn, Middle English yogh, etc.). All language-specific phonetic
  normalization stays — it's what makes the modern voices passable
  for the dead languages.
- **The rate-limit module.** `paideia/lib/rate-limit-audio.js` already
  caps client requests; it doesn't need to know about Azure.
- **The library-text JSON shape.** No content changes; only the audio
  generation backend changes.

## Hard sunset milestones

| Date | Milestone |
|---|---|
| 2026-05-20 | This document filed; Azure account provisioning starts |
| 2026-05-27 | Azure F0 keys in production env; pipeline scripts ported |
| 2026-06-10 | Voice-continuity audition for all 9 languages passed |
| 2026-06-15 | Pilot: Greek daily-word + library re-rendered through Azure |
| 2026-07-01 | All 9 languages cut over for new audio; cache fills with Azure renders |
| 2026-07-15 | Pre-rendering script complete; entire current library on Azure |
| 2026-08-01 | edge-tts marked deprecated in `voices.py`; calls log warnings |
| **2026-08-18** | **edge-tts hard sunset. All `import edge_tts` removed.** |

## Cross-references

- `paideia/docs/INFRASTRUCTURE-akousma.md` — high-level audio architecture
- `paideia/docs/AUDIO-REMEDIATION.md` — broader audio hardening plan
- `MEMORY.md` (root) — 2026-05-20 Azure decision + rate-limit aphorism
- `paideia/pipeline/voices.py` — voice mapping table (canonical)

## What Jae needs to decide

1. **Azure region.** `eastus` is the default and matches likely
   subscriber geography. Confirm or pick alternate.
2. **Azure account.** Use the existing Microsoft tenant or create a
   standalone account with billing capped at $20/month? Recommend
   standalone with billing cap for blast-radius isolation.
3. **Audition cohort.** Confirm OK to use the 20-passage list above
   for the continuity test, or specify alternates.
4. **Local-inference roadmap.** When MS-02 is online, who picks the
   classical-language voice corpora (Daitz, Bagby, Allen, others)?
   That's its own project; doesn't block the Aug-18 sunset.
5. **Voice consent / licensing** (Claude Design 2026-05-20). Confirm
   Azure's terms permit redistribution of generated audio inside a
   paid app/site. Spot-check on the S0 tier was yes; **re-verify
   before launch** as a formal step in the legal pre-launch review.
   Cross-references the EU PD lawyer memo at build week 12 — ask the
   lawyer to cover Azure ToS as a one-line confirmation in the same
   memo.
6. **Old English audition** (Claude Design 2026-05-20). Claude
   Design's playbook suggested Icelandic (`is-IS-GunnarNeural`) as
   the Old English base voice on phonological grounds. Our current
   pick is `en-GB-SoniaNeural` pitch-lifted (per Jae 2026-04-25
   audition). Worth a listener test with a medievalist before we
   ship to settle whether Icelandic-base is genuinely better for OE.
   Doesn't block the sunset; defer to a Phase 1.5 audition pass.
