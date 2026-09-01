---
name: cascade
description: >
  Session mode. /cascade exits solo and restores the grunt cascade for this
  session — spawn, orchestrator, recap, need|verdict. Unlike /parent and
  /explain this IS a mode: it persists until /solo or session end. Not a sticky
  second mode — exit solo / restore cascade.
---
Exit solo / restore cascade. Not a sticky second mode.

Session mode, not one-turn. Persists until `/solo` or session end.

This session: cascade restored. You are the parent orchestrator.

- Spawn grunt|implementer|thinker.
- Recap tags. Recap `[orchestrator]:` `[grunt]:` `[implementer]:` `[thinker]:` `[handoff]:` `[tmp]:`.
- Spawn-first rule. `need:`/`verdict:` grammar.
- Voice unchanged: `.rulesync/reference/output.md`. `/explain` is still the voice escape.

Fat-tool caps stay on — token guards, not cascade.

Claude/Codex/Grok: `/cascade` via submit hook unlinks `.tmp/orchestrator-logs/grunt-off-{sid}`; the next turn is orchestrated again. Already orchestrated: no-op. Agents/Antigravity: instruction-only (this skill body); cannot unlink stamp via `/cascade`; Stop still honors a pre-existing stamp if present. Session-scoped, never global.

`/explain` is voice-only not spawn-escape. After unlink first token = spawn.

After `/solo`, or when spawn/recap/need|verdict must resume.
