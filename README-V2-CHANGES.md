# Kalopaideia v2 — Redesigned by Claude Design

**Major redesign and feature expansion completed May 2026.**

This document captures the comprehensive changes from v1 (the original Kalopaideia implementation) to v2 (Claude Design's complete redesign and feature expansion).

---

## Table of Contents

1. [Visual & Design System](#visual--design-system)
2. [Branding & Naming](#branding--naming)
3. [Language Expansion](#language-expansion)
4. [Reader & Library Experience](#reader--library-experience)
5. [Subscription & Commerce](#subscription--commerce)
6. [Analytics & Admin](#analytics--admin)
7. [Architecture & Infrastructure](#architecture--infrastructure)
8. [Audio System](#audio-system)
9. [Technical Implementation](#technical-implementation)

---

## Visual & Design System

### V3 Illuminated Word-Header
**Complete redesign of the daily word presentation** (May 12, 2026):

- **Double bronze-rule framing** above and below headword block
- **Small-caps eyebrow** for part-of-speech with diamond flankers
- **Centered headword** in Bodoni Moda with dynamic font-sizing
- **Three-diamond ornament separator** between transliteration and meaning
- **Manuscript-inspired aesthetic** — reads like a medieval opening
- **Responsive typography** with `fitHeadwords()` JS function that binary-searches the largest font size that keeps long compounds (e.g. *Weltfrömmigkeit*) on a single line
- **Mobile optimization** with scaled-down typography and reduced gutters below 760px

### V2 Design System CSS
**New design language** (`v2-design.css` + `akousma-v2.css`):

- **Refined color palette**: ivory backgrounds (#fdfbf7), warm bronze accents (#8b7355), muted typography
- **Typography hierarchy**: Cinzel for headings, Cormorant Garamond for body, Source Serif 4 for original-language text
- **Temple ruin watermark**: subtle background motif on homepage and category pages
- **Consistent spacing & rhythm**: standardized margins, padding, and line-heights across all pages
- **Card-based layouts**: book cards, language cards, category cards — all using unified design tokens
- **Hover states & micro-interactions**: smooth transitions, subtle shadows, refined button states

### Homepage Redesign
**Complete visual overhaul** (May 20, 2026):

- New masthead block with **Athenaeum-style wordmark**
- **Ten-language grid** with language cards (flags, native names, sample words)
- **Celtic + Germanic category cards** with dedicated landing pages
- **The Akousma promo section** with featured book cards
- **Refined navigation** with dropdown menus for language categories
- **Mobile-first responsive layout** that degrades gracefully

### Navigation Improvements
**Enhanced mast-nav** with dropdown support:

- **Hover-to-open dropdowns** on desktop (Celtic Languages, Germanic Languages)
- **Tap-to-toggle on mobile** with nested visual hierarchy
- **Sign in / Account links** in header nav
- **Consistent nav across all pages** (homepage, language pages, reader, category pages)
- **Vertical alignment fixes** for dropdown items

---

## Branding & Naming

### "The Akousma" Rebrand
**Complete rename** from "Store" / "Stoa" to **"The Akousma"** (May 12, 2026):

- **All user-facing surfaces updated**: nav labels, page titles, CTAs, copy
- **URL migration**: `/paideia/store` → 301 redirect → `/paideia/akousma`
- **Per-work URLs**: `/paideia/store/:id` → `/paideia/akousma/:id`
- **Copy shift**: "Read" → "Listen" everywhere (The Akousma is an audio library)
- **Backend route names stay as 'stoa'** for backward compatibility

### "Kalopaideia" as Primary Brand
**Display name standardization** (April 30, 2026):

- HTML `<title>` tags: "Kalopaideia — A Daily Book of Words"
- Masthead H1: "Kalopaideia"
- Footer, About, Contact, Terms: all use "Kalopaideia"
- PWA manifest: `name: "Kalopaideia"`, `short_name: "Kalopaideia"`
- **URLs stay at `/paideia/`** to preserve inbound links, X-post archives, RSS, search-engine results, bookmarks

---

## Language Expansion

### Celtic & Germanic Language Categories
**New language taxonomy** (May 12, 2026):

- **Celtic Languages**: Welsh, Gaulish (added in v2)
- **Germanic Languages**: Old English, Middle English, Old Norse (Old Norse added in v2)
- **Category landing pages** at `/paideia/celtic` and `/paideia/germanic`
- **Dropdown navigation** for easy discovery of related languages
- **10 languages total** (v1 had 7: Greek, Latin, French, German, Italian, Old English, Middle English)

### New Languages Added in v2

#### Welsh (May 12, 2026)
- **Medieval Mabinogi corpus**: Pwyll, the Four Branches
- **Daily words** with IPA, pronunciation audio, etymology
- **Library text**: *Pwyll Prince of Dyfed* (line-by-line audio + translation + gloss)
- **50+ curriculum lessons** (3 chapters × 17 lessons each)

#### Old Norse (May 12, 2026)
- **Eddic / saga corpus**: Hávamál, Völuspá
- **Daily words** with Old Norse pronunciation (Icelandic-approximated voice)
- **Library text**: *Hávamál* stanzas 1–10 (line-by-line audio + translation + gloss)
- **50+ curriculum lessons**

#### Gaulish (May 12, 2026)
- **Gallo-Roman epigraphy**: Coligny calendar, votive tablets
- **Daily words** with reconstructed pronunciation
- **Library text**: *Gaulish Epigraphy Primer* (2-line intro)
- **50+ curriculum lessons**

### Italian & Middle English Expansion
**Languages promoted from skeleton to full** (earlier in v1, enhanced in v2):

- **Italian**: Dante *Inferno* I (36 lines), daily words, grammar paradigms
- **Middle English**: Chaucer *General Prologue* (42 lines), daily words, IPA pronunciation with Ryan + respelling

---

## Reader & Library Experience

### Per-Work Reader Redesign
**Complete visual overhaul of `/paideia/read/:id`** (May 21, 2026):

- **New work header** (`.akv2-work-head`): cover image, title, author, translator, metadata
- **Akousma v2 player** (`.akv2-player`): line-by-line audio controls with refined UI
- **Side-by-side layout**: original-language text + English translation + gloss popover
- **Click-to-reveal glosses**: morphology, notes, etymology on every English line
- **Reading progress tracking**: saves scroll position and last-read line per user
- **Responsive typography**: original text in Source Serif 4 16px, English in Cormorant 16px
- **Manuscript-inspired aesthetic**: consistent with v2 design language

### Library Tab Redesign
**Every language page now includes a Library tab** (May 12, 2026):

- **Grid of book cards**: one card per work, with cover + blurb + state-aware CTA
- **Three render states**:
  1. **No subscription**: "Subscribe to Listen" button (opens Akousma page)
  2. **Subscribed**: "Open & Listen →" button (opens reader)
  3. **Free gateway (Odyssey I)**: "Open & Listen →" for signed-in users, "Sign in to Listen" for anonymous
- **Per-language filtering**: each language page shows only works in that language
- **Cover art curation**: every work has a museum-grade PD painting (see `paideia-covers` skill)

### Akousma Storefront
**Dedicated page at `/paideia/akousma`** (May 12, 2026):

- **Pricing table**: $12.99/mo + $99.99/yr (was $11.99/mo single-tier in v1)
- **Featured works carousel**: highlights from the 22-work catalog
- **All 22 works listed** with cover cards, blurbs, and "Subscribe to Listen" CTA
- **Cross-link to The Reading Mansion**: one subscription unlocks both sites
- **Subscription buttons gated**: render as "Subscribe — coming soon" until `STRIPE_SECRET_KEY` is set

---

## Subscription & Commerce

### Pricing Update
**New two-tier model** (May 20, 2026):

- **Monthly**: $12.99/mo (was $11.99/mo in v1)
- **Annual**: $99.99/yr (new tier in v2)
- **One subscription unlocks**:
  - All 22 Akousma works on Kalopaideia
  - All Akousma works on The Reading Mansion
  - Same Stripe customer across both sites

### Stripe Integration Overhaul
**Enhanced commerce backend** (May 10–20, 2026):

- **Shared Supabase Auth**: one sign-in works at both Kalopaideia and The Reading Mansion
- **Shared SQLite accounts DB**: `../mansion/data/shared/accounts.db` (WAL mode for concurrent writes)
- **Stripe webhook handlers**: `POST /webhooks/stripe` processes subscription events
- **Holdings tracking**: `holdings` table tracks which users own which works
- **Subscription status**: `subscriptions` table tracks active/canceled/trialing subs
- **Checkout flow**: inline `price_data` in Stripe Checkout (not fixed Price IDs), so pricing changes flow directly on next charge
- **Environment-based gating**: all Subscribe buttons disabled until `STRIPE_SECRET_KEY` is set

### Free Gateway
**Odyssey Book 1 as free sample** (May 12, 2026):

- **Any signed-in user** can open Odyssey I without a subscription
- **Anonymous users** see "Sign in to Listen" CTA
- **Designed to convert**: high-quality line-by-line audio + translation + gloss → Subscribe CTA at end

---

## Analytics & Admin

### User-Facing Analytics Dashboard
**New `/paideia/dashboard` page** (May 17, 2026):

- **Reading streak tracker**: days in a row visiting the daily word
- **Progress by language**: % of words seen, lines listened to
- **Time spent reading**: total minutes in the reader
- **Favorite languages**: ranked by engagement
- **Recent activity feed**: last 10 interactions (words viewed, lines listened, works opened)
- **Client-side tracker**: `analytics-client.js` logs events to `POST /api/analytics/event`
- **Privacy-first**: no third-party trackers, data stays in local SQLite

### Admin Dashboard
**New `/paideia/admin` page** (May 17, 2026):

- **User metrics**: total users, active subscribers, trial users, canceled subs
- **Revenue metrics**: MRR, ARR, churn rate
- **Content metrics**: total words, lines, audio hours
- **Language breakdown**: users per language, most-listened works
- **Recent sign-ups**: last 20 users with email, sign-up date, sub status
- **Admin-only gate**: requires `ADMIN_BYPASS_TOKEN` cookie or sub_status = 'admin'

### Privacy Banner
**GDPR-lite compliance** (May 17, 2026):

- **Privacy banner on first visit**: "We use cookies for login and analytics. No third-party trackers."
- **Accept / Decline buttons**: Accept sets `privacy_accepted=1` cookie, Decline redirects to `/privacy`
- **Terms updated**: `/paideia/terms.html` documents analytics, cookies, data retention

---

## Architecture & Infrastructure

### Cross-Site Auth (SSO)
**Shared JWT for Mansion ↔ Kalopaideia** (May 20, 2026):

- **Option B (HS256 shared JWT)** approved by Jae
- **30-minute access tokens**, 4-hour session window
- **`ncv_sso` cookie** scoped to `Domain=newcharterventures.com`
- **Secret in env var**: `MANSION_SSO_SECRET` on both sites
- **Spec**: `mansion/docs/CROSS-SITE-AUTH.md`
- **Implementation pending**: needed before signed-URL gating ships

### Shared Accounts Database
**One SQLite DB for both sites** (May 10, 2026):

- **Location**: `/home/jae/.openclaw/workspace/mansion/data/shared/accounts.db`
- **WAL mode**: safe for concurrent writers (Mansion + Kalopaideia both write)
- **Tables**:
  - `users`: id, email, created_at, last_sign_in
  - `holdings`: user_id, work_id, acquired_at, source
  - `subscriptions`: user_id, stripe_customer_id, status, plan_id, current_period_end
  - `stripe_customers`: user_id, stripe_customer_id
  - `stripe_events`: event_id, type, data, processed_at
- **Supabase as identity layer**: email/password auth, magic links, OAuth (Google, GitHub)

### Audio Rate-Limiting
**Word-audio endpoint hardening** (May 20, 2026):

- **SQLite-backed counters**: `paideia/data/audio-rate-limit.db` (three tables: `audio_daily`, `audio_burst`, `audio_global`)
- **Per-IP daily total**: 200 words/day
- **Per-IP daily synth**: 30 new TTS calls/day (cache hits don't count)
- **Per-IP burst synth**: 10 new TTS calls per 10 minutes
- **Global daily synth**: 500 new TTS calls across all IPs
- **429 on limit**: returns `Retry-After` header
- **Counters survive restart**: UPSERT-based persistence (fixed in v2; v1 used in-memory Maps that reset on restart)
- **Admin diagnostics**: `GET /api/word-audio/diagnostics` (admin-only)

### TTS Migration Plan
**edge-tts sunset by 2026-08-18** (May 20, 2026):

- **Migrate 7/10 languages to Azure Speech** (paid): same voices as edge-tts, near-mechanical migration
- **3 languages stay on edge-tts until sunset**: Welsh, Old Norse, Gaulish (no Azure equivalent)
- **After Aug 18**: no edge-tts in production
- **Current status**: all 10 languages still on edge-tts as of May 2026

### Infrastructure Decisions (Claude Design Phase-0)
**Six architectural rulings** (May 20, 2026):

1. **Framework**: stay on Node + Express (no Next/Astro/Remix rewrite)
2. **Hosting**: stay on DO droplet (single droplet + nginx + systemd)
3. **EU launch**: Q3 2026 (Jae override; Claude Design said Q1 2027)
4. **Side-by-side migration**: yes, with feature flags (3-week SSO overlap, 90-day TTS overlap)
5. **DO Spaces region**: match droplet region (NYC3 if droplet is NYC3)
6. **Secrets management**: `.env` acceptable for one engineer; upgrade to DO encrypted env vars or sops/Doppler/Infisical when second person gets SSH access

---

## Audio System

### Pre-Generated Audio
**No TTS-on-demand** for library texts:

- **All library audio pre-generated**: `data/library-audio/<work-id>/<line-number>.mp3`
- **22 works × avg 300 lines = ~6,600 audio files**
- **Edge TTS for generation**: per-language voice tuning in `pipeline/voices.py`
- **Cache-first serving**: library-audio endpoint serves pre-generated files, no fallback synth
- **Word-audio has cache-miss fallback**: if `data/audio/YYYY-MM-DD/<lang>.mp3` doesn't exist, synth on-demand (rate-limited)

### Voice Tuning
**Per-language voice mapping** (`pipeline/voices.py`):

| Language | Voice | Rate | Pitch | Notes |
|---|---|---|---|---|
| Greek | el-GR-AthinaNeural | 0.85 | -5% | Modern Greek voice, slowed for Ancient Greek gravitas |
| Latin | it-IT-ElsaNeural | 0.90 | -3% | Italian voice, classical register |
| French | fr-FR-DeniseNeural | 1.0 | 0% | Standard literary French |
| German | de-DE-KatjaNeural | 0.95 | -2% | Softer than default, evokes Romantic era |
| Italian | it-IT-ElsaNeural | 1.0 | 0% | Same as Latin |
| Old English | en-GB-SoniaNeural | 0.85 | -5% | British English, slowed for archaic feel |
| Middle English | en-GB-RyanNeural | 0.90 | -3% | British English, slightly elevated |
| Welsh | cy-GB-NiaNeural | 0.95 | 0% | Native Welsh voice |
| Old Norse | is-IS-GudrunNeural | 0.85 | -5% | Icelandic voice as Old Norse proxy |
| Gaulish | fr-FR-HenriNeural | 0.85 | -8% | French male voice, heavily modulated for reconstructed feel |

### Audio Delivery Architecture
**Separate paths for library audio vs word audio**:

1. **Library audio**: `GET /api/library/audio/:work_id/:line_number.mp3`
   - Serves pre-generated file from `data/library-audio/`
   - No fallback synth (cache-only)
   - Sub-gated (requires active subscription, except Odyssey I for signed-in users)
   
2. **Word audio**: `GET /api/word-audio/:lang/:word.mp3`
   - Serves pre-generated file from `data/audio/YYYY-MM-DD/` if exists
   - Falls back to on-demand edge-tts synth if cache miss
   - Rate-limited (SQLite-backed counters)
   - Not sub-gated (free for all)

---

## Technical Implementation

### File Structure Changes
**New directories and files in v2**:

```
paideia/
├── public/
│   ├── v2-design.css              # NEW: v2 design tokens
│   ├── akousma-v2.css             # NEW: Akousma reader v2 styles
│   ├── category.html              # NEW: Celtic / Germanic landing pages
│   ├── dashboard.html             # NEW: user analytics dashboard
│   ├── admin.html                 # NEW: admin metrics dashboard
│   ├── analytics-client.js        # NEW: client-side event tracker
│   └── _mockups/                  # NEW: design mockups (archived)
│       ├── mockup-front-v2.html
│       ├── redesign-mockup.html
│       └── redesign-2026.html
├── lib/
│   ├── rate-limit-audio.js        # NEW: SQLite-backed audio rate limiter
│   ├── analytics.js               # NEW: analytics endpoints + helpers
│   ├── commerce-catalog.js        # UPDATED: Akousma pricing $12.99 / $99.99
│   └── commerce-stripe.js         # UPDATED: annual subscription support
├── data/
│   ├── library/
│   │   └── library-meta.json      # NEW: cover art + blurbs for all 22 works
│   ├── curriculum/
│   │   ├── welsh/                 # NEW: 50+ Welsh lessons
│   │   ├── oldnorse/              # NEW: 50+ Old Norse lessons
│   │   └── gaulish/               # NEW: 50+ Gaulish lessons
│   ├── audio-rate-limit.db        # NEW: SQLite counters for word-audio rate limits
│   └── analytics.db               # NEW: SQLite events for user analytics
└── docs/
    ├── AUDIO-REMEDIATION.md       # NEW: TTS licensing + migration plan
    ├── INFRASTRUCTURE-akousma.md  # NEW: cost model + scaling plan
    ├── TTS-MIGRATION.md           # NEW: edge-tts → Azure Speech timeline
    └── STRIPE-PATRON-SETUP.md     # NEW: Patron tier setup (future work)
```

### Database Schema Changes
**New tables in v2**:

#### `analytics.db`
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  event_type TEXT,  -- 'word_view', 'line_listen', 'work_open', etc.
  language TEXT,
  work_id TEXT,
  metadata TEXT,    -- JSON blob
  created_at INTEGER
);

CREATE TABLE daily_streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER,
  longest_streak INTEGER,
  last_visit_date TEXT
);
```

#### `audio-rate-limit.db`
```sql
CREATE TABLE audio_daily (
  ip TEXT,
  date TEXT,
  total_requests INTEGER,
  synth_requests INTEGER,
  PRIMARY KEY (ip, date)
);

CREATE TABLE audio_burst (
  ip TEXT,
  window_start INTEGER,
  synth_requests INTEGER,
  PRIMARY KEY (ip, window_start)
);

CREATE TABLE audio_global (
  date TEXT PRIMARY KEY,
  synth_requests INTEGER
);
```

#### `accounts.db` (shared with Mansion)
**New columns in v2**:

```sql
ALTER TABLE subscriptions ADD COLUMN plan_id TEXT;  -- 'monthly' | 'annual'
ALTER TABLE subscriptions ADD COLUMN current_period_end INTEGER;
```

### API Endpoints Added in v2

#### Analytics
- `POST /api/analytics/event` — log a client-side event
- `GET /api/analytics/dashboard` — user's own analytics summary
- `GET /api/analytics/admin` — site-wide metrics (admin-only)

#### Library
- `GET /api/library/:lang` — list all works in a language (with cover art)
- `GET /api/library/text/:work_id` — full text JSON for a work
- `GET /api/library/audio/:work_id/:line.mp3` — line audio (sub-gated)

#### Commerce
- `GET /api/whoami` — current user + sub status + stripe_ready flag
- `GET /api/akousma/cards` — featured Akousma works for promo cards

#### Admin
- `GET /api/word-audio/diagnostics` — rate-limit diagnostics (admin-only)

### Environment Variables Added in v2
```bash
# Cross-site auth
MANSION_SSO_SECRET=<shared-jwt-secret>

# Analytics
ANALYTICS_DB=/path/to/analytics.db

# Rate limiting
AUDIO_RATE_LIMIT_DB=/path/to/audio-rate-limit.db

# Admin
ADMIN_BYPASS_TOKEN=<admin-bypass-token>
```

---

## Migration Notes

### Breaking Changes from v1 to v2
1. **URL changes**: `/paideia/store` → `/paideia/akousma` (301 redirect in place)
2. **Pricing**: $11.99/mo → $12.99/mo (existing subs grandfathered)
3. **Subscription model**: single-tier → two-tier (monthly + annual)
4. **Akousma branding**: "Store" / "Stoa" → "The Akousma" everywhere
5. **Audio rate-limiting**: in-memory → SQLite (counters now survive restart)

### Non-Breaking Additions
- New languages (Welsh, Old Norse, Gaulish) are additive
- Analytics system is opt-in (privacy banner on first visit)
- Admin dashboard requires explicit token (not auto-exposed)
- v2 design CSS is additive (v1 `styles.css` still loaded)

### Backward Compatibility
- Old `/paideia/store` URLs 301 redirect to `/paideia/akousma`
- Backend routes still use `stoa` naming internally
- Library catalog JSON structure unchanged (only added cover art metadata)
- Subscription webhooks handle both old and new plan formats

---

## Performance & Optimization

### Improvements in v2
1. **Lazy-loaded images**: book covers + language cards use `loading="lazy"`
2. **Reduced font load**: consolidated Google Fonts requests (Cinzel + Cormorant + Source Serif + Inter in one request)
3. **Audio pre-generation**: eliminates TTS latency on library reads
4. **SQLite WAL mode**: concurrent reads/writes for shared accounts DB
5. **Rate-limit caching**: reduces DB hits for audio endpoint (in-memory cache + SQLite persistence)
6. **Responsive images**: `srcset` for cover art (1x, 2x, 3x DPR)

### Known Bottlenecks
1. **Library audio size**: 6,600 pre-generated MP3s = ~2 GB on disk (not yet migrated to DO Spaces)
2. **Gloss lookup**: per-line morphology fetched on click (could be pre-embedded in JSON)
3. **Analytics writes**: SQLite writes on every client event (could batch)

---

## Testing & QA

### What Was Tested in v2
1. **Subscription flow**: sign-up → checkout → webhook → holdings unlock
2. **Audio playback**: line-by-line audio in reader, daily word audio
3. **Rate limiting**: verified 10 synths → 11th returns 429, restart → counters persist
4. **Cross-site auth**: not yet implemented (pending SSO completion)
5. **Analytics tracking**: client events → POST → SQLite → dashboard display
6. **Admin dashboard**: metrics calculation, user list, revenue summaries
7. **Mobile responsive**: tested on iPhone 12, iPad Pro, Android (Pixel 6)
8. **Browser compat**: Chrome 120+, Safari 17+, Firefox 121+

### Known Bugs / Tech Debt
1. **Cross-site auth not yet live**: SSO JWT spec written, implementation pending
2. **Signed URLs for audio**: not yet implemented (sub-gating relies on session cookies only)
3. **EU PD lawyer memo**: not yet commissioned (blocks non-US Akousma rollout)
4. **BunnyCDN evaluation**: DO Spaces works, but BunnyCDN could halve egress costs (deferred to 500 GB/mo threshold)
5. **Edge-tts gray zone**: still using unofficial Microsoft wrapper (Azure Speech migration planned for Q3 2026)

---

## Future Work (Post-v2)

### Phase 2: The Reading Mansion v2 Design Migration
**Awaiting review** after Phase 1 (Kalopaideia) ships:

- Apply v2 design language to Mansion (server-rendered templates)
- Update Mansion pricing to $12.99 / $99.99
- Unified Akousma experience across both sites

### Patron Tiers
**Spec written, not yet implemented** (`STRIPE-PATRON-SETUP.md`):

- **Reader**: $5/mo (early access to new languages)
- **Scholar**: $10/mo (downloadable audio, ad-free)
- **Patron**: $25/mo (custom word requests, acknowledgment in About)
- **Benefactor**: $100/mo (1:1 language tutoring, lifetime access)

### EU Launch (Q3 2026)
**Blockers**:

1. Commission PD lawyer memo (week 12 of build)
2. Geo-gate sign-ups to US/CA/UK until EU clearance
3. Swap or geo-restrict any red-list titles

### Audio Migration
**edge-tts → Azure Speech** (by 2026-08-18):

- Migrate 7/10 languages to paid Azure voices
- Pre-generate all library audio with new voices
- Keep 3 languages on edge-tts until sunset
- After Aug 18: no edge-tts anywhere

---

## Credits

### Design & Architecture
- **Claude Design** — v2 visual design, mockups, design system, Phase-0 architectural decisions
- **Jae Lee** — product vision, editorial curation, final design approval

### Implementation
- **Claude (Opus 4-7)** — v2 implementation, backend refactor, analytics system, rate-limiting, Stripe integration

### Content & Curation
- **Public domain translations**: Project Gutenberg, Wikisource, Perseus Digital Library
- **Cover art**: Wikimedia Commons (see `paideia-covers` skill for curation rules)
- **IPA transcriptions**: Wiktionary REST API + manual verification

---

## License

Site code: proprietary to New Charter Ventures LLC.

Content: all text translations and audio voices are public domain or licensed for editorial use.

Cover art: public domain paintings only (see editorial rules in README.md).

---

## Contact

**New Charter Ventures LLC**  
Email: info@newcharterventures.com  
Live site: https://newcharterventures.com/paideia/

---

*This v2 redesign represents 6 weeks of coordinated work across design (Claude Design), architecture (Claude Design Phase-0), and implementation (Claude Opus 4-7), shipped in phases May 10–21, 2026.*
