#!/bin/bash
# Daily Paideia pipeline — words → audio → culture, then X-post Latin + Greek
export ANTHROPIC_API_KEY=$(python3 -c "import json; print(json.load(open('/home/jae/.openclaw/workspace/multi-model-engine/config.json'))['claude_api_key'])")
export PATH="$HOME/.local/bin:$PATH"
cd /home/jae/.openclaw/workspace/paideia

echo "=== $(date -u +%Y-%m-%dT%H:%MZ) Paideia daily run ==="
/usr/bin/node pipeline/generate.js
python3 pipeline/audio.py
/usr/bin/node pipeline/culture.js
# Backfill audio for any new library texts (idempotent, skips existing files)
python3 pipeline/library-audio.py
/usr/bin/node pipeline/xpost.js
