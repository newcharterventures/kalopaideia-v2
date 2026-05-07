#!/bin/bash
export ANTHROPIC_API_KEY=$(python3 -c "import json; print(json.load(open('/home/jae/.openclaw/workspace/multi-model-engine/config.json'))['claude_api_key'])")

# Paideia's own session secret (paideia.sid cookie). Different from Mansion's.
# This is fresh each session unless overridden in the systemd unit.
export SESSION_SECRET="${SESSION_SECRET:-paideia-$(openssl rand -hex 24)}"

# Shared auth: same Supabase project as the Mansion.
export SUPABASE_URL="${SUPABASE_URL:-https://wfkfybuealpfbktgbnee.supabase.co}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2Z5YnVlYWxwZmJrdGdibmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTU3NzcsImV4cCI6MjA5MzU5MTc3N30.iEzgLZFNAO60C_GEby_1RukE7a3hLnFvg7R3_Udlqr8}"

# Stripe (test/live key + webhook signing secret). Set via systemd Environment=
# when ready. Without these, /paideia/checkout/* shows the 'Almost ready' page.
# export STRIPE_SECRET_KEY="..."
# export STRIPE_WEBHOOK_SECRET="..."

# Shared accounts DB path (Mansion writes here too).
export MANSION_ACCOUNTS_DB="/home/jae/.openclaw/workspace/mansion/data/shared/accounts.db"
export MANSION_STOA_DIR="/home/jae/.openclaw/workspace/mansion/data/stoa/library"

cd /home/jae/.openclaw/workspace/paideia
exec /usr/bin/node server.js
