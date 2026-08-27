---
name: commit-and-push
description: >
  Commit like /commit, then push to the current branch's upstream. Use for
  /commit-and-push, "commit and push", "commit this and push".
---

Run commit skill rules first (`.rulesync/skills/commit/SKILL.md`). Then push.

If on default branch, create/switch to a feature branch first — never push default directly.

Push upstream; if no upstream `git push -u origin <current-branch>`.

Never force-push.

Protocol: `.rulesync/reference/cascade.md`. Do not paste cascade.
