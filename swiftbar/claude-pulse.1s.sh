#!/bin/bash

STATE_FILE="$HOME/.claude/pulse-state.json"
DIR="$HOME/tools/claude-pulse/swiftbar"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
    echo "⚫"
    echo "---"
    echo "Claude Pulse: Not Running"
    echo "Start Pulse | bash=$DIR/pulse-start.sh terminal=false"
    exit 0
fi

# Check if state file is stale (>60 seconds old)
FILE_AGE=$(( $(date +%s) - $(stat -f %m "$STATE_FILE") ))
if [ "$FILE_AGE" -gt 60 ]; then
    echo "⚫"
    echo "---"
    echo "Claude Pulse: Stale (${FILE_AGE}s ago)"
    echo "Start Pulse | bash=$DIR/pulse-start.sh terminal=false"
    exit 0
fi

# Single jq call to extract all fields
DATA=$(jq -r '[
  (.state // "idle"),
  ((.intensity // 0) * 100 | floor | tostring),
  ((.active_agents // 0) | tostring),
  ((.tool_rate // 0) | floor | tostring),
  (.current_tool // ""),
  (.project // ""),
  (.branch // "")
] | join("|")' "$STATE_FILE" 2>/dev/null)

IFS='|' read -r STATE INTENSITY AGENTS TOOL_RATE TOOL PROJECT BRANCH <<< "$DATA"

# Fallback if parsing failed
STATE="${STATE:-idle}"
INTENSITY="${INTENSITY:-0}"
AGENTS="${AGENTS:-0}"

# Map state to icon and label
case "$STATE" in
    idle)     ICON="⚪"; LABEL="Idle" ;;
    thinking) ICON="🟣"; LABEL="Thinking" ;;
    working)  ICON="🟢"; LABEL="Working" ;;
    spawning) ICON="🟠"; LABEL="Spawning" ;;
    error)    ICON="🔴"; LABEL="Error" ;;
    waiting)  ICON="🟡"; LABEL="Waiting" ;;
    *)        ICON="⚫"; LABEL="Unknown" ;;
esac

echo "$ICON"
echo "---"
echo "$ICON $LABEL (intensity: ${INTENSITY}%)"
echo "---"
[ -n "$PROJECT" ] && echo "Project: $PROJECT"
[ -n "$BRANCH" ] && echo "Branch: $BRANCH"
if [ -n "$TOOL" ]; then
    if [ "$AGENTS" -gt 0 ] 2>/dev/null; then
        echo "Tool: $TOOL ($AGENTS agents)"
    else
        echo "Tool: $TOOL"
    fi
fi
[ "$TOOL_RATE" -gt 0 ] 2>/dev/null && echo "Tool Rate: ${TOOL_RATE}/min"
# Read current renderer preference from config
CONFIG_FILE="$HOME/.claude/pulse-config.json"
RENDERER=$(jq -r '.renderer // "orb"' "$CONFIG_FILE" 2>/dev/null)
RENDERER="${RENDERER:-orb}"

if [ "$RENDERER" = "orb" ]; then
    ORB_CHECK="✓ "; PIXEL_CHECK=""
else
    ORB_CHECK=""; PIXEL_CHECK="✓ "
fi

echo "---"
echo "Renderer"
echo "--${ORB_CHECK}Orb | bash=$DIR/pulse-renderer.sh param1=orb terminal=false refresh=true"
echo "--${PIXEL_CHECK}Pixel Dev | bash=$DIR/pulse-renderer.sh param1=pixel-character terminal=false refresh=true"
echo "---"
echo "Show/Hide Widget | bash=$DIR/pulse-toggle.sh terminal=false"
echo "---"
echo "Start Pulse | bash=$DIR/pulse-start.sh terminal=false"
echo "Stop Pulse | bash=$DIR/pulse-stop.sh terminal=false"
