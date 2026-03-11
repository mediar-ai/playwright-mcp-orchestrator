# playwright-mcp-orchestrator

Multi-agent orchestrator for Playwright MCP — multiple AI agents sharing one Chrome browser with tab isolation. Local-first, preserving your real browser state (cookies, logins, extensions, localStorage).

## The Problem

The official [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) only supports a single agent per browser. When multiple Claude Code agents (or any MCP clients) try to use it simultaneously, they fight over the same tabs and interfere with each other.

Existing workarounds all sacrifice something:
- `--isolated` mode gives each agent a fresh profile (no saved logins/cookies)
- Separate `--user-data-dir` per agent means separate profiles (no shared state)
- Community alternatives (`ultimate-playwright-mcp`, `concurrent-browser-mcp`) are unmaintained or don't share profiles

## The Approach

Use a single Chrome instance with CDP (Chrome DevTools Protocol) as the shared backend, and orchestrate multiple `@playwright/mcp` sessions on top — each scoped to its own tabs.

```
┌─────────────────────────────────────────────┐
│              Chrome (one instance)           │
│         --remote-debugging-port=9222        │
│         --user-data-dir=<profile>           │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Agent 1 │ │ Agent 2 │ │ Agent 3 │ tabs  │
│  │  tabs   │ │  tabs   │ │  tabs   │       │
│  └────┬────┘ └────┬────┘ └────┬────┘       │
└───────┼──────────┼──────────┼───────────────┘
        │          │          │  CDP (ws://127.0.0.1:9222)
┌───────┼──────────┼──────────┼───────────────┐
│       ▼          ▼          ▼               │
│   ┌────────────────────────────────┐        │
│   │   playwright-mcp-orchestrator  │        │
│   │                                │        │
│   │  - Tab group isolation         │        │
│   │  - Session routing             │        │
│   │  - Uses official @playwright/mcp│       │
│   └────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

### Key design decisions

1. **Delegates to official `@playwright/mcp`** — not a reimplementation. New tools and features from Microsoft are available automatically.
2. **Shared user profile** — all agents see the same cookies, logins, localStorage.
3. **Tab isolation** — each agent operates on its own tabs, no interference.
4. **CDP connection** — connects to a running Chrome instance via `--remote-debugging-port`.

## Status

**Early development.** The CDP foundation has been validated:

- Chrome 145 with `--remote-debugging-port=9222` + `--user-data-dir` works
- Multiple `playwright-core` connections via `connectOverCDP` to the same browser work
- Each connection can create and manage its own tabs independently
- All connections share the same BrowserContext (cookies, logins, storage)

## Chrome Setup

Chrome 136+ silently ignores `--remote-debugging-port` on the default profile directory. You must use `--user-data-dir` pointing to a non-default path.

### Copy your profile (preserves all logins)

```bash
# Quit Chrome first
osascript -e 'tell application "Google Chrome" to quit'

# Copy profile
cp -r ~/Library/Application\ Support/Google/Chrome /tmp/chrome-cdp-profile

# Launch with CDP
open -a "Google Chrome" --args \
  --user-data-dir=/tmp/chrome-cdp-profile \
  --remote-debugging-port=9222
```

### Verify CDP is working

```bash
curl -s http://127.0.0.1:9222/json/version
```

## Research

### Why not existing solutions?

| Project | Stars | Issue |
|---------|-------|-------|
| `@playwright/mcp` (official) | — | Single agent only. Issues [#893](https://github.com/microsoft/playwright-mcp/issues/893), [#1294](https://github.com/microsoft/playwright-mcp/issues/1294) open. |
| `ultimate-playwright-mcp` | 1 | Full reimplementation, abandoned after 1 day. Can't track official updates. |
| `concurrent-browser-mcp` | — | Isolated ephemeral instances, no shared profile. |
| `playwright-parallel-mcp` | — | Separate processes, separate profiles. |
| `mcp-playwright-cdp` | 47 | CDP but no tab isolation. Abandoned. |

### Why not other browser frameworks?

| Framework | Stars | Issue for our use case |
|-----------|-------|----------------------|
| Browser Use | 80k | Single-session locally. Cloud for concurrency. |
| Stagehand/Browserbase | 21k | Cloud-only shared state. Not local. |
| Agent Browser (Vercel) | 21k | CLI, not MCP. No tab isolation. CDP still maturing. |
| Dev Browser | 3.8k | Skill, not MCP. Same multi-agent gap ([#33](https://github.com/SawyerHood/dev-browser/issues/33)). |
| Skyvern | 21k | Vision-first, different paradigm. |

### The multi-agent shared-profile problem is unsolved

No well-maintained project provides: real user profile + multiple concurrent agents + tab isolation + MCP interface. This project aims to be the first.

## License

MIT
