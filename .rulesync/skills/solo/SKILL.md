---
name: solo
description: >
  Session mode. /solo suspends the grunt cascade for this session — one normal
  agent; spawn-if-asked. /cascade restores it. Unlike /parent and /explain this
  IS a mode: it persists until /cascade or session end.
---
Session mode, not one-turn. Persists until `/cascade` or session end.

This session: cascade suspended. You are one normal agent.

- No spawn-first. No recap tags. Do not recap `[orchestrator]:`. Answer the user directly.
- No `need:` JSON unless the user asks spawn.
- User asks spawn → spawn grunt|implementer|thinker (do not deny).
- Voice unchanged: `.rulesync/reference/output.md`. Solo may omit the tag. `/explain` is a longer expansion, not the only complete-sentence path.

Fat-tool caps stay on — token guards, not cascade.

Stamp `spawn-mode-{sid}` body `solo` when slash used and slash ≠ config; slash==config unlinks stamp. Always unlink `grunt-off-{sid}` (new+legacy). Requires real sid (never `default`). Stamp only on slash not on jsonc-only. Session-scoped, never global.

`/cascade` inverse: slash==config unlinks stamp; else write body `cascade`. Always unlink `grunt-off`. Restores spawn-first even if jsonc stays solo.

LLM keys solo off effective spawnMode (stamp body `solo`|`cascade` > grunt-off presence > jsonc+overlay > cascade). UserPromptSubmit additionalContext carries the pair. Not parent Read jsonc. Hosts with no UserPromptSubmit additionalContext stay fail-closed cascade until `/solo`.

When effective spawnMode is solo: no spawn-first; spawn-if-asked; recap tags optional; parent tools on; fat gate still on.

This is the only session-wide spawn-workflow escape. /explain /parent /handoff /pickup /write-plan /implement-plan still spawn-first unless effective spawnMode is solo.

Spawn-escape only. Not advisory/design routing. Leftover-gate `/auto`/`/ask` is not spawn-escape.
