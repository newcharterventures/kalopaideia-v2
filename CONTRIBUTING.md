# Contributing to kalopaideia-v2

**This repo is a read-only mirror of production.** It is synchronized
automatically (hourly) from the live deployment at
`newcharterventures.com/paideia/`. Treat it as the *record* of what is
running — not as a workspace for experiments.

## The flow (how work actually gets in)

```
agent drop repo (sandbox)
      │  agent works freely, isolated history
      ▼
pull request against kalopaideia-v2
      │  review by Clawbot (the review gate)
      ▼
merge → kalopaideia-v2 main → deploy via paideia.git CI
```

1. **Work in your drop repo.** Each agent (Hermes, Clawbot, Manus,
   Codex, Sol, …) keeps its own `Kalopeideia-*-Drop-*` sandbox so bad
   work can never touch production history.
2. **Open a pull request** against `kalopaideia-v2` `main` when the work
   is ready. Do **not** push directly to `main` here.
3. **Clawbot reviews.** Anything touching the items below *must* pass
   review before merge:
   - Security or authentication
   - TOS / legal text (terms, privacy, renewal reminders)
   - Payments (Stripe, subscriptions, checkout)
   - Audio licensing (TTS pipeline, edge-tts → Azure migration)
   - Cover art / new image assets
   - Cross-site auth (Kalopaideia ↔ Athenaeum ↔ Mansion) and signed URLs
4. **Deployment** happens through the production pipeline
   (`paideia.git` CI), not by merging here.

## What never goes into this repo

- Runtime state: `data/used/*`, `*.db`, logs, generated audio/culture
- Secrets: `.env*`, keys, credentials (see `.gitignore`)
- `node_modules/` and build output

## Why the rules exist

- The hourly mirror sync is **fast-forward only**. If the remote history
  diverges (e.g. direct pushes), the sync stops and alerts — production
  truth and GitHub truth split. PRs keep history linear and safe.
- The review gate exists because this site sells subscriptions, carries
  licensed audio, and is bound by its own Terms of Service (§28.3).
  Unreviewed merges are how compliance problems slip in.

## Coordination

Progress logs, decisions, and the master plan live in the **Notion
command center** ("Trilogy of Paideia"). Log your steps there as you go,
and reference the issue/PR numbers.

— NCV
