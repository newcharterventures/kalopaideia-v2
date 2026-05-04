# Paideia

A site of learning for the classical languages: Latin, Greek, French, German, and Old English. Each day, a word from each tradition — with pronunciation, etymology, literary context, and a cultural vignette drawn from public-domain sources.

## Sections
- Latin (classical Roman)
- Greek (classical Ancient Greek)
- French (literary: Molière → Hugo → Baudelaire era)
- German (philosophy/literature: Kant, Goethe, Hölderlin, Nietzsche)
- Old English (Anglo-Saxon literary tradition)

## Architecture
- Content generation: Anthropic Claude Sonnet 4.5 (one call per language per day)
- Audio: Edge TTS (free Microsoft TTS, via `edge-tts` npm/python)
- Culture images: Wikimedia Commons (public domain / CC, attribution required)
- Storage: JSON files under `data/words/`, MP3 under `data/audio/`, JSON under `data/culture/`
- Delivery: Express static server, port 3025, path `/paideia`

## Content flow
1. `pipeline/generate.js` creates today's word + thread content for each language → writes `data/words/YYYY-MM-DD.json`
2. `pipeline/audio.js` generates MP3 for each word via Edge TTS → `data/audio/YYYY-MM-DD/<lang>.mp3`
3. `pipeline/culture.js` fetches public-domain image + writes cultural vignette via Claude → `data/culture/YYYY-MM-DD.json`
4. `pipeline/xpost.js` reads today's JSON, posts to X for languages with dedicated accounts (Latin → @LatinateGame, Greek → @Paideion). Other languages skip X until accounts exist.

## X account routing
| Language | X account |
|----------|-----------|
| Latin | @LatinateGame |
| Greek | @Paideion |
| French | none (pending) |
| German | none (pending) |
| Old English | none (pending) |

When new accounts come online, edit `pipeline/xpost.js` to enable them.
