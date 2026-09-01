---
name: implement-plan
description: >
  Implementer executes a local .tmp/grunt/plans checklist: continue, resume, or
  pick among plans. Empty /implement-plan resumes a unique in-progress or starts
  a unique ready plan; else lists and needs serial. Marks [x], skips completed
  leaves. Not /implement review-loop, not /execute-plan PR DAG, not /pickup, not
  /run-plan.
---
# implement-plan

Parent: spawn grunt to list/validate `.tmp/grunt/plans/` when the target is unknown or empty-arg; then spawn implementer with abs plan path + `{repo}/.rulesync/reference/plan-format.md` + first open leaf. Recap from implementer output only. No parent Read/Grep/Bash. Agent-agnostic (grunt then implementer). Not `/pickup` (handoffs only). Not `/run-plan`. Not `/execute-plan` (PR DAG).

Format SSOT: `.rulesync/reference/plan-format.md`.

## Invocation

`/implement-plan`
`/implement-plan {serial|path}`

Todos: `resolve` → `implement` → `verify`. One serial per run. Partial progress is ok; re-run continues. Skip `[x]`. Remaining leaves only.

## Resolve

Arg = `$ARGUMENTS` stripped. Listing/validate: spawn grunt (`job:search|exec`) on `.tmp/grunt/plans/`. Do not parent Read/Grep/Bash.

Eligible auto = valid plan-format checkbox grammar (`N [ ]` / `N.M [ ]`; not `- [ ]`; not `1. [ ]`). Invalid grammar: exclude from auto. Drop `done` (all `[x]` or FM `status: done`) from auto. Never silent latest. Never auto-pick among many.

**In-progress:** some `[x]` and remaining `[ ]`, or FM `status: in-progress` with open leaves.

**Ready / none started:** FM `ready` or all boxes `[ ]`.

**Blocked + open:** list/tag `blocked`; empty-arg never auto-runs. Explicit `{n|path}` still runs (skip `[x]`).

### Empty arg (`/implement-plan`)

Grunt lists/validates `.tmp/grunt/plans/*.md`. Then:

| condition | action |
|---|---|
| exactly 1 in-progress | resume it (implementer; skip `[x]`; start first open leaf) |
| exactly 1 plan total, none started (ready / all open) | start it |
| 0 plans (dir missing / no files) | blocker; remainder `/write-plan` |
| N>1 in-progress | list those (`serial name status first-open-leaf`); `need serial`. No silent latest |
| 0 in-progress, N>1 eligible (ready / blocked-open) | list eligible (`serial name status first-open-leaf`; tag `blocked`); `need serial` |
| only `done` / only invalid | blocker; remainder `/write-plan` |

Unique in-progress wins even if other ready/done files exist. Invalid grammar does not count toward unique-auto and is omitted from auto lists.

### Arg `{n|path}`

That file only; skip `[x]`; remaining leaves. Write-plan remainder stays `/implement-plan {n}` (that serial). Never auto-pick among many.

| input | action |
|---|---|
| int (`1`, `0001`) | files whose leading number == that int |
| `{serial}-slug` or `*.md` or path | that file if under `.tmp/grunt/plans/` |
| slug only (`add-auth`) | unique match `*-{slug}-*.md` or `*-{slug}.md` |
| `.tmp/grunt/plans` missing / no files | `no plans. /write-plan first` stop |
| 0 matches | `no plan serial={n}. have: {list}` stop |
| >1 matches | `ambiguous: {paths}` stop |
| all boxes already `[x]` / `status: done` | `[implementer]: already done path=...` **no implementer spawn** |

Lookup: integer equality so `1` matches canonical `1-foo-20260826T143000Z.md` and legacy `1-foo.md`. `0001-foo.md` may still resolve if an old padded file exists. Normalize to abs path + int serial.

If prefetch needed: spawn grunt `job:search|exec`. Do not `resume_from` for dumps already listed in the plan leaves. Do not add a repo-wide explore. Then spawn implementer.

## Spawn implementer

`subagent_type: implementer`, `background: true`, omit `model`, `isolation: none`, `description: "implement plan {serial}"`.

Prompt:

```
You are implementer subagent. Do not spawn.

Read {abs}/.rulesync/reference/plan-format.md and the plan at {abs_plan_path}.

Implement remaining `[ ]` leaves in numeric order. Skip `[x]`. Start at the first open leaf.
Write-allowlist = paths listed in this plan only. Do not add README/docs/examples unless listed in the plan. Missing path → blocker/`need:`; do not invent.
After each leaf: flip that line to `[x]` in the plan file (only the box).
When a phase's children are all `[x]`, mark the phase `[x]`.
Frontmatter status: in-progress at start; done when all boxes `[x]`; blocked if you cannot finish.
Do not expand scope, add steps, or start a review loop.
If blocked: leave remaining `[ ]`, status: blocked, report reason + leftover ids.
Run Verify leaves. Report abs paths you changed.
```

Wait. Spawn fail → `[implementer]: failed: {err}` stop.

## Recap

Recap from implementer output only. No parent Read/Grep/Bash.

```
[implementer]: serial={int} path=.tmp/grunt/plans/{file} status={status} done={x}/{total}
files: {abs paths}
{if leftover:}
leftover:
{up to 10 open leaf lines}
{if blocked:} blocked: {reason}
```

## Rules

- Skip `[x]`; only flip boxes; no renumber/rewrite leaf text.
- No review-fix loop. Not bundled `/implement`. Implement leftover pick 1 (`Implement with verbal plan`) ≠ this skill (no `.tmp/grunt/plans`; no write-plan; no implement-plan). Bare `implement`/`implementer` → pick1 iff Implement-typed, not this skill; else recap “no implementer this remainder”.
- Slash `/implement-plan {n}` = disk/file run. Empty `/implement-plan` = unique-resume / unique-start / else list. Implement leftover pick 2 may invoke this sequencing without user slash (after write-plan persist; `plan=/abs/...` only). Write leftover pick 2 does not spawn implementer this turn. Always-do leftover match; leftover `2` ≠ Skill-name. Verbal leftover ≠ implement-plan.
- effective=auto + Implement-typed may chain this sequencing without user slash after write-plan persist (`plan=/abs/...`). Write-typed under auto: no implementer this turn; leftover wait.
- No auto `/write-plan` chain. Escalation → tell user to `/write-plan` a follow-up.
- Omit `model`. `subagent_type: implementer` only for this skill.
- First prompt sentence: `You are implementer subagent.`
- Child prompt = task + abs paths + verdicts only (no pasted transcripts).
- Resume prompt = `You are implementer subagent.` + new verdicts only. Do not re-send the original task. Max 3 `resume_from` per child id; then report blocked/partial.
- Tool-call first for spawn claims.
- Do not re-plan. Partial = skill success (plan file is SoT).
- `/pickup` stays handoffs only. Do not merge.
