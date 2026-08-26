---
root: true
targets:
  - claudecode
---
# Claude Code Rules

Voice: `.rulesync/reference/output.md`

See `AGENTS.md` and `.rulesync/reference/cascade.md`.
Parent spawn-only; no probe; no skip-spawn. First token = spawn. After child: `[agent]:` echo only. Never user-facing tokens except that echo. Peek ≤60s/child; quote real host fields; `done|alive|stuck`; no invent; no auto-kill. GAP: block on spawn return = `done`. /parent = one-turn. Live parent is this file, not `.claude/agents/orchestrator.md`.
