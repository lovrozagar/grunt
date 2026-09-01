---
name: solo
description: >
  Session mode. /solo disables the grunt cascade for this session — one normal
  agent, no spawn, no orchestrator. /cascade restores it. Unlike /parent and
  /explain this IS a mode: it persists until /cascade or session end.
---
Session mode, not one-turn. Persists until `/cascade` or session end.

This session: cascade suspended. You are one normal agent.

- Do not spawn. No grunt|implementer|thinker.
- No recap tags. Do not recap `[orchestrator]:`. Answer the user directly.
- No spawn-first rule. No `need:`/`verdict:` grammar.
- Voice unchanged: `.rulesync/reference/output.md`. `/explain` is still the voice escape.

Fat-tool caps stay on — token guards, not cascade.

Effective spawn: stamp body `solo`|`cascade` > one-release `grunt-off-{sid}` presence as solo > `.rulesync/grunt.config.jsonc` `spawnMode` > `cascade`. Fail-closed `cascade`. Unreadable/bad stamp body ignored (dual-read grunt-off else config). Never fail-closed solo.

Claude/Codex/Grok: `/solo` via submit hook. If slash token equals committed config `spawnMode`, unlink `.tmp/grunt/orchestrator-logs/spawn-mode-{sid}`; else write stamp body `solo`. Always unlink `grunt-off-{sid}` (new+legacy). Requires real sid (never `default`). Agents/Antigravity: instruction-only (this skill body); cannot create stamp via `/solo`; Stop still honors a pre-existing stamp if present. Session-scoped, never global.

This is the only session-wide spawn-workflow escape. /explain /parent /handoff /pickup /write-plan /implement-plan still spawn-first unless this session’s effective spawn is solo.

Spawn-escape only. Not advisory/design routing. Leftover-gate `/auto`/`/ask` is not spawn-escape.
