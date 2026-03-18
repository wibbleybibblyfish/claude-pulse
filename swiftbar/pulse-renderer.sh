#!/bin/bash
curl -sX POST http://localhost:3200/control/renderer \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"$1\"}"
