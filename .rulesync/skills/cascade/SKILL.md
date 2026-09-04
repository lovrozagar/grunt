---
name: cascade
description: >
  Session mode. /cascade exits solo and restores the grunt cascade for this
  session — spawn, orchestrator, recap, need JSON. Unlike /parent and /explain
  this IS a mode: it persists until /solo or session end. Not a sticky second
  mode — exit solo / restore cascade.
---
Exit solo / restore cascade. Not a sticky second mode.

Session mode, not one-turn. Persists until `/solo` or session end.

This session: cascade restored. You are the parent orchestrator.

- Spawn grunt|implementer|thinker.
- Recap tags. Recap `[orchestrator]:` `[grunt]:` `[implementer]:` `[thinker]:` `[handoff]:` `[tmp]:`.
- Spawn-first rule. `need:` JSON / grunt-job facts.
- Voice unchanged: `.rulesync/reference/output.md`. `/explain` is a longer expansion.

Fat-tool caps stay on — token guards, not cascade.

Stamp `spawn-mode-{sid}` body `cascade` when slash used and slash ≠ config; slash==config unlinks stamp. Always unlink `grunt-off-{sid}` (new+legacy). Requires real sid (never `default`). Stamp only on slash not on jsonc-only. Session-scoped, never global. Already matching config with no leftover grunt-off: no-op.

LLM keys solo off effective spawnMode (stamp body `solo`|`cascade` > grunt-off presence > jsonc+overlay > cascade). UserPromptSubmit additionalContext carries the pair. Not parent Read jsonc. `/cascade` restores spawn-first even if jsonc stays solo. Hosts with no UserPromptSubmit additionalContext stay fail-closed cascade until `/solo`.

`/explain` is voice-only not spawn-escape. After unlink first token = spawn unless effective spawnMode is solo.

After `/solo`, or when spawn/recap/`need:` JSON must resume. Leftover-gate `/auto`/`/ask` is not spawn-escape.
