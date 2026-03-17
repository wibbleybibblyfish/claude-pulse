#!/bin/bash
# Forwards hook event data (stdin) to Claude Pulse server
# Fails silently if server is not running
curl -sX POST http://localhost:3200/hooks/event \
  -H "Content-Type: application/json" \
  --connect-timeout 1 \
  -d @- 2>/dev/null
exit 0
