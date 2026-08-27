---
name: implement-plan
description: >
  Implementer executes a local .tmp/plans checklist by serial, marks [x],
  skips completed leaves. Use to implement/continue a written local plan
  or /implement-plan. Not /implement review-loop, not /execute-plan PR DAG.
when-to-use: >
  Use when asked to "implement plan", "run plan N", "continue plan",
  "execute the checklist", or "/implement-plan".
argument-hint: "<plan_id_serial>"
---

# implement-plan

Resolve serial (cheap-in-parent) → spawn implementer → parent verifies boxes. Format: `../shared/plan-format.md` — read it; do not paste.

## Invocation

`/implement-plan <serial>`

Todos: `resolve` → `implement` → `verify`. One serial per run. Partial progress is ok; re-run continues.

## Resolve serial (no spawn)

Arg = `$ARGUMENTS` stripped.

| input | action |
|---|---|
| empty | list `.tmp/plans/*.md` as `serial slug status` (read frontmatter `status` if cheap; else filename). Stop: `need serial. have: ...` |
| int (`1`, `0001`) | files whose leading number == that int |
| `{serial}-slug` or `*.md` or path | that file if under `.tmp/plans/` |
| slug only (`add-auth`) | unique match `*-{slug}-*.md` or `*-{slug}.md` |
| `.tmp/plans` missing / no files | `no plans. /write-plan first` stop |
| 0 matches | `no plan serial={n}. have: {list}` stop |
| >1 matches | `ambiguous: {paths}` stop |
| all boxes already `[x]` / `status: done` | `[implementer]: already done path=...` **no spawn** |

Lookup: integer equality so `1` matches canonical `1-foo-20260826T143000Z.md` and legacy `1-foo.md`. `0001-foo.md` may still resolve if an old padded file exists. Normalize to abs path + int serial.

Gather listed plan-leaf absolute paths plus prefetch `verdict:` blobs before the up-spawn (search|exec via parent grunt-job). Do not `resume_from` for dumps already listed in the plan leaves. Do not add a repo-wide explore. Then spawn.

## Read format

`read_file` `{repo}/.grok/skills/shared/plan-format.md`.

## Spawn implementer

`subagent_type: implementer`, `background: true`, omit `model`, `isolation: none`, `description: "implement plan {serial}"`.

Prompt:

```
You are implementer subagent. Do not spawn.

Read {abs}/.grok/skills/shared/plan-format.md and the plan at {abs_plan_path}.

Implement remaining `[ ]` leaves in numeric order. Skip `[x]`.
Write-allowlist = paths listed in this plan only. Do not add README/docs/examples unless listed in the plan. Missing path → blocker/`need:`; do not invent.
After each leaf: flip that line to `[x]` in the plan file (only the box).
When a phase's children are all `[x]`, mark the phase `[x]`.
Frontmatter status: in-progress at start; done when all boxes `[x]`; blocked if you cannot finish.
Do not expand scope, add steps, or start a review loop.
If blocked: leave remaining `[ ]`, status: blocked, report reason + leftover ids.
Run Verify leaves. Report abs paths you changed.
```

Wait. Spawn fail → `[implementer]: failed: {err}` stop.

## Parent verify (cheap 1-file)

Grep plan for `\[ \]` vs `\[x\]` (and `[X]`).

```
[implementer]: serial={int} path=.tmp/plans/{file} status={status} done={x}/{total}
files: {abs paths}
{if leftover:}
leftover:
{up to 10 open leaf lines}
{if blocked:} blocked: {reason}
```

## Rules

- Skip `[x]`; only flip boxes; no renumber/rewrite leaf text.
- No review-fix loop. Not bundled `/implement`.
- No auto `/write-plan` chain. Escalation → tell user to `/write-plan` a follow-up.
- Omit `model`. `subagent_type: implementer` only for this skill.
- First prompt sentence: `You are implementer subagent.`
- Child prompt = task + abs paths + verdicts only (no pasted transcripts).
- Resume prompt = `You are implementer subagent.` + new verdicts only. Do not re-send the original task. Max 3 `resume_from` per child id; then report blocked/partial.
- Tool-call first for spawn claims.
- Do not re-plan. Partial = skill success (plan file is SoT).
