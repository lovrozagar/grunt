---
name: auto
description: >
  Session leftover-gate. /auto sets leftover-gate auto for this session —
  Implement-typed pick2 chains write-plan persist then implement-plan {n} and
  skips leftover wait. Not autofix. Not spawn-escape. /ask restores ask.
---
Session leftover-gate, not spawn-escape. Not autofix. Not leftover y/n.

Whole-prompt `/auto` only (`/auto foo` no-op). Persists until `/ask` or session end.

Effective leftover-gate: stamp body `auto`|`ask` > `.rulesync/grunt.config.jsonc` `leftoverGate` > `ask`. Fail-closed `ask`.

Slash==config leftoverGate unlinks `.tmp/grunt/orchestrator-logs/auto-ask-{sid}`; else write stamp body `auto`. Requires real sid (never `default`). Stamp only on slash not on jsonc-only. Session-scoped, never global.

effective=auto + Implement-typed: write-plan persist then implement-plan `{n}`; skip leftover triple wait. Write-typed under auto still leftover wait; never spawn implementer.

Not `/solo`. Spawn-first still. Recap tags still.
