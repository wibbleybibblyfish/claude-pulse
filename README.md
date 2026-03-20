# Claude Pulse

An ambient desktop presence widget for [Claude Code](https://claude.ai/code). A floating orb that reacts to Claude's activity in real-time — changing colour, particle intensity, and size based on what Claude is doing.

![idle](https://img.shields.io/badge/idle-blue-6496FF) ![thinking](https://img.shields.io/badge/thinking-purple-B464FF) ![working](https://img.shields.io/badge/working-green-50DC78) ![spawning](https://img.shields.io/badge/spawning-orange-FFB432) ![waiting](https://img.shields.io/badge/waiting-amber-FFC83C) ![error](https://img.shields.io/badge/error-red-FF3C3C)

## How it works

Claude Code fires hook events (tool use, agent spawning, etc.) via HTTP to a local server running inside a Tauri app. The app maintains a state machine and renders a Canvas 2D orb that reflects Claude's current activity.

```
Claude Code → hooks → HTTP POST localhost:3200 → Tauri app → orb visual
                                                           → state file → SwiftBar menubar indicator
```

## States

| State | Colour | Trigger |
|-------|--------|---------|
| Idle | Blue | No activity for 30s |
| Thinking | Purple | User prompt submitted |
| Working | Green | Tool calls in progress |
| Spawning | Orange | Sub-agents active (orb grows with agent count) |
| Waiting | Amber | Permission prompt — Claude needs user input |
| Error | Red | Tool failure (5s flash) |

## Prerequisites

- **macOS** (uses Tauri's macOS private API for transparent windows)
- **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (18+)
- **jq** — `brew install jq` (for SwiftBar plugin)
- **SwiftBar** — optional, for menubar indicator ([swiftbar.app](https://swiftbar.app))

## Install

```bash
git clone <repo-url> ~/tools/claude-pulse
cd ~/tools/claude-pulse
npm install
cargo tauri build
```

The built app will be at `src-tauri/target/release/bundle/macos/Claude Pulse.app`.

## Setup

### 1. Claude Code hooks

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "PostToolUse": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "SubagentStart": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "SubagentStop": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }],
    "Notification": [{ "matcher": "permission_prompt", "hooks": [{ "type": "command", "command": "~/tools/claude-pulse/swiftbar/pulse-hook.sh" }] }]
  }
}
```

Hooks fail silently if the Pulse server isn't running — they never block Claude.

### 2. SwiftBar plugin (optional)

Symlink the plugin into your SwiftBar plugins directory:

```bash
ln -s ~/tools/claude-pulse/swiftbar/claude-pulse.1s.sh ~/path/to/swiftbar-plugins/claude-pulse.1s.sh
```

### 3. Launch

```bash
open ~/tools/claude-pulse/src-tauri/target/release/bundle/macos/Claude\ Pulse.app
```

Or add to System Settings → General → Login Items for auto-start on boot.

## Architecture

- **Tauri app** (Rust + web frontend) — single process running the HTTP server and rendering the orb
- **Axum HTTP server** on port 3200 — receives hook events, maintains state machine
- **Canvas 2D renderers** — pluggable interface, ships with orb and pixel-character renderers (switchable at runtime)
- **SwiftBar plugin** — reads `~/.claude/pulse-state.json` for menubar indicator

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hooks/event` | POST | Receives Claude Code hook events |
| `/status` | GET | Returns current state as JSON |
| `/health` | GET | Liveness check |
| `/control/visibility` | POST | Toggle widget show/hide |
| `/control/renderer` | POST | Switch renderer (`{"type":"orb"}` or `{"type":"pixel-character"}`) |
| `/control/quit` | POST | Graceful shutdown |
| `/config` | GET | Returns current renderer preference |

## License

MIT
