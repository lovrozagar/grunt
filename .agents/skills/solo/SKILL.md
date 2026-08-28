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

Claude/Codex/Grok: `/solo` via submit hook writes `.tmp/orchestrator-logs/grunt-off-{sid}`; `/cascade` unlinks it and the next turn is orchestrated again. Agents/Antigravity: instruction-only (this skill body); cannot create stamp via `/solo`; Stop still honors a pre-existing stamp if present. Session-scoped, never global.

This is the only session-wide spawn-workflow escape. /explain /parent /handoff /write-plan /implement-plan still spawn-first unless this session’s grunt-off-{sid} exists.

For advisory/design turns, debugging the cascade itself, or back-and-forth where spawning costs more than it saves.
