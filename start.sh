#!/bin/bash
export ANTHROPIC_API_KEY=$(python3 -c "import json; print(json.load(open('/home/jae/.openclaw/workspace/multi-model-engine/config.json'))['claude_api_key'])")
cd /home/jae/.openclaw/workspace/paideia
exec /usr/bin/node server.js
