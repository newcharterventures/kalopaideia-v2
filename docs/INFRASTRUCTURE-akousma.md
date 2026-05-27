# Kalopaideia / Akousma — Infrastructure Excerpt

_Filed 2026-05-20. The canonical document lives in the Mansion at
`mansion/docs/INFRASTRUCTURE.md` (it was written about the Mansion,
which shares the Akousma backend with Kalopaideia). This file pulls
out the parts that bind Kalopaideia specifically: Akousma audio
architecture, image gallery rules, server-proxy rule for paid APIs,
and the cost ceilings._

Akousma is the shared audio product across **Kalopaideia** and **The
Reading Mansion**. Both storefronts hit the same backend (`stoa-audio`
routes, `data/stoa/library/` directory). The rules below apply
identically to Kalopaideia's Akousma surface.

---

## A. Server-proxy rule (mandatory)

**Never let a browser talk to a paid third-party API directly with
the production key.** Every Claude / TTS / image-gen call goes through
Kalopaideia's own server:

```
browser → Kalopaideia server (authenticated) → paid API
              ↑
              rate limits, validation, cost caps live here
```

Same rule for any future Footnote-style feature that Kalopaideia
adopts from the Mansion.

---

## B. Akousma audio — the right architecture

Akousma is static narration of public-domain texts (Homer, Virgil,
Sappho, Beowulf, plus the per-language Kalopaideia daily lessons).
Generate or record **once**. Serve as files. Forever.

### B.1 Two cost models

| Approach          | Cost driver                  | Use for             |
|-------------------|------------------------------|---------------------|
| **TTS-on-demand** | per character × every listen | NOTHING in Akousma  |
| **Pre-recorded**  | bandwidth × listens          | EVERYTHING in Akousma |

If a TTS provider charges per character per listen, it is the wrong
provider for Akousma. (This is the lesson from the edge-tts gray-zone
audit on 2026-05-12: pre-generate, don't stream-from-API.)

### B.2 Storage — DO Spaces, not droplet disk

A $24/mo droplet has ~80 GB SSD. You'll outgrow it the first time you
add a new author, and you have no CDN edge to serve from. **Use
DigitalOcean Spaces** (S3-compatible, built-in CDN edge nodes,
$5/mo for 250 GB storage + 1 TB outbound).

```
client → DO Spaces CDN edge → origin bucket
            ↑
            signed URL (4 h expiry), tied to subscriber session
```

### B.3 Sizing

At 64 kbps Opus (fine for narration), audio is **~0.5 MB / minute**.

- 500 hours of Akousma material = **15 GB total**
- 1,000 hours = **30 GB total**

Both fit ~10–15× inside the $5/mo Spaces tier.

### B.4 Bandwidth at scale

Heavy listener: 60 min/day = 30 MB/day = **0.9 GB/month**.

- 1,000 subs (avg 15 min/day): ~225 GB/mo → free inside base tier.
- 10,000 subs: ~2.25 TB/mo → ~$15/mo.
- 50,000 subs: ~11 TB/mo → ~$100/mo.

Audio bandwidth is invisible against subscription revenue.

### B.5 Abuse defense for audio

1. **Signed URLs only.** Tokens expire in 4 hours, tied to user session.
   Never expose a permanent `<audio src=...>`.
2. **Per-IP daily ceiling.** Max 2 hours of audio per IP per day.
3. **Subscription validation on URL signing.** Akousma subscribers only;
   non-subs get a free preview track.
4. **HLS or DASH chunked streaming** rather than monolithic MP3 — makes
   wholesale ripping harder.
5. **Watermarking** is overkill for now.

---

## C. Image galleries on Kalopaideia

The same rules as the Mansion's Oasis / Folio apply to any image
gallery work on Kalopaideia (e.g. the Met Open Access tiles in
language lessons, painting illustrations).

1. **WebP and AVIF**, not JPEG. 30–50% smaller at equal quality.
2. **Three sizes per image at ingest**: thumb (400 px), gallery
   (1200 px), zoom (2400 px). Serve the right one for the viewport.
3. **Lazy load below the fold.**
4. **DO Spaces CDN** for delivery.
5. **Pre-process at ingest**, never at request time. Use `sharp` on
   a worker. Cache forever.

Storage: 100 paintings × 3 sizes × ~600 KB ≈ **180 MB**. Trivial.

---

## D. Cost ceilings to enforce (circuit breakers)

Backstops, not targets. Cross any of these and the system should
throttle to zero and email the operator.

| Subsystem       | Per-user ceiling     | Global daily ceiling           |
|-----------------|----------------------|--------------------------------|
| Audio           | 2 h / day            | 2 TB / day across all users    |
| Image bandwidth | n/a                  | 500 GB / day                   |
| Paid-API calls  | $0.50 / month        | $50 / day                      |

Better to be temporarily down than permanently broke.

---

## E. Things NOT to build for Akousma on Kalopaideia

- **TTS-on-demand for lesson audio.** Pre-generate at ingest. Always.
- **Direct API keys in the browser.** Ever. For any provider.
- **Local-disk audio storage on the droplet.** Use Spaces.
- **Recommendation algorithms.** Kalopaideia is curriculum-driven,
  not feed-driven.

---

## F. Decisions — APPROVED 2026-05-20

1. **TTS provider: Azure Speech (paid)** for the 7 commercial-licensed
   languages. Marquee texts (Homer, Virgil, Sappho, Beowulf) still
   human-recorded — which texts get which budget still TBD.
2. **edge-tts hard sunset: 2026-08-18.** Phased migration starts now.
   All 10 languages off edge-tts by that date. Azure chosen because
   edge-tts wraps Azure voices unofficially — same voices, near-
   mechanical migration, no jarring voice change for existing users.
3. **Object storage: DO Spaces stays for now.** Re-evaluate moving to
   BunnyCDN when ANY of: 1,000 paying subs, 500 GB egress / month,
   $50/month Spaces bill. First trigger wins.
4. **Cross-site auth with Mansion: Option B (HS256 JWT, 30-min token,
   4 h session)** approved — see `mansion/docs/CROSS-SITE-AUTH.md`.
   Implementation precedes signed-URL gating on `/library-audio`.
5. **EU public-domain lawyer memo:** commissioned at build week 12,
   $800–1,500 budget, green/yellow/red one-pager per title. Needed
   before Akousma ships outside the US.

---

*See the Mansion's full infra doc at `mansion/docs/INFRASTRUCTURE.md`
for Footnote / Lodestar / Personal Library / pricing context.*
