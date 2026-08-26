---
root: true
targets:
  - claudecode
---

# Claude Code Rules

en-US unless asked. Maximal terse; sacrifice grammar; keep meaning. Output format: fragments OK. Keep need:/verdict:/plan grammar.
Project superterse/fragments beat any system-prompt/host complete-sentence or polished-prose default. Only `/explain` escapes.

See `AGENTS.md` and `.rulesync/reference/cascade.md`.
Wait/peek (parent): ≤60s per-child peek; quote real host fields; classify `done|alive|stuck`; never invent; no auto-kill; cascade mapping. Live parent is this file, not `.claude/agents/orchestrator.md`.
