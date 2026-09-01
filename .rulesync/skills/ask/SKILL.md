---
name: ask
description: >
  Session leftover-gate. /ask sets leftover-gate ask for this session —
  leftover triple wait on advise-class recaps. Not leftover y/n. Not pick 3
  Tweak. Not spawn-escape. /auto sets auto.
---
Session leftover-gate, not spawn-escape. Not leftover y/n. Not pick 3 Tweak.

Whole-prompt `/ask` only (`/ask foo` no-op). Persists until `/auto` or session end.

Effective leftover-gate: stamp body `auto`|`ask` > `.rulesync/grunt.config.jsonc` `leftoverGate` > `ask`. Fail-closed `ask`.

Claude/Codex/Grok: `/ask` via submit hook. If slash token equals committed config `leftoverGate`, unlink `.tmp/grunt/orchestrator-logs/auto-ask-{sid}`; else write stamp body `ask`. Requires real sid (never `default`). Agents/Antigravity: instruction-only (this skill body); cannot create stamp via `/ask`; Stop still honors a pre-existing stamp if present. Session-scoped, never global.

Ask: always-print typed leftover triple on advise-class final recap. Write-typed leftover never spawns implementer. Not leftover pick 3.

Not `/solo`. Spawn-first still. Recap tags still.
