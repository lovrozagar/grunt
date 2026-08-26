---
name: write-plan
description: >
  Thinker drafts a local implementer-ready checklist plan; parent Write
  persists .tmp/plans/{serial}-{slug}-{YYYYMMDDTHHMMSSZ}.md. Use for a numbered local plan, checklist
  for implementer, "write a plan", or /write-plan. Not a design doc or PR stack.
when-to-use: >
  Use when asked to "write a plan", "make a checklist plan",
  "plan this for implementer", or "/write-plan".
argument-hint: "<task or context>"
---

# write-plan

Parent orchestrates thinker then persists via Write under `.tmp/plans/`. Parent does not author the plan body. Format: `../shared/plan-format.md` — read it; do not paste.

## Invocation

`/write-plan <task>`

Optional todos: `think` → `write` → `report`. Always a new serial.

## Cheap-in-parent (no spawn)

Empty `$ARGUMENTS` **and** no task in conversation → `need task` and stop. Do not list the repo.

## Read format

`read_file` `{repo}/.grok/skills/shared/plan-format.md` (`dirname(SKILL.md)/../shared/plan-format.md`).

Gather the listed plan-format/SSOT absolute paths before the up-spawn. Prefetch search|exec via parent `node scripts/grunt-job.mjs` (not LLM grunt spawn). Do not `need:` for paths already listed.

## Step 1 — thinker

Spawn `subagent_type: thinker`, `background: true`, omit `model`, `description: "write plan"`.

Prompt:

```
You are thinker subagent. Read-only. Do not write files. Do not spawn.

Read {abs}/.grok/skills/shared/plan-format.md. Produce a plan that matches it.

Task:
{full $ARGUMENTS + relevant conversation context}

Cite absolute paths. Use only listed abs paths plus prefetch `verdict:` blobs. Do not explore the repo. Narrowest change that solves the task.

Output rules:
- Line 1: PLAN_NAME: <3-6 word name>
- Then the plan body only: # heading, Goal, Context, Constraints, Watch-outs, Steps, Verify
- All boxes [ ]
- No preamble, no summary, no extra sections
- Final message IS the plan (parent persists it verbatim)
```

Wait. Fail → `[thinker]: failed: {err}` stop.

**Truncation:** if output lacks `PLAN_NAME:` or has no `N.M [ ]` leaf, resume once (`resume_from`). Resume prompt = `You are thinker subagent.` plus the new instruction only (do not re-send the original task). Still bad → stop, no write. Max 3 `resume_from` per child id.

## Step 2 — persist (parent Write)

No grunt spawn. Parent `write`s the thinker final message under `{repo}/.tmp/plans/` (any filename in that dir). `orchestrate-parent.js` runs `scripts/persist-plan.mjs`: serial/slug from `PLAN_NAME:` / heading, inject YAML, rewrite path+content. Deny invalid plans and any write outside `.tmp/plans/`.

Report serial/path from the tool result (`updatedInput.file_path`). Fail/deny → `[write-plan]: failed: {err}` stop.

## Report

```
[thinker]: {one-line goal}; {N} leaves
[write-plan]: serial={int} path=.tmp/plans/{serial}-{slug}-{YYYYMMDDTHHMMSSZ}.md
next: /implement-plan {int}
```

Do not dump the plan.

## Rules

- Omit `model`. `subagent_type` ∈ {grunt, implementer, thinker} only (thinker for draft).
- First prompt sentence: `You are {agent} subagent.`
- Child prompt = task + abs paths + verdicts only (no pasted transcripts).
- Parent coordinates; parent Write under `.tmp/plans/` only; thinker never writes.
- Not `/design`, not `/execute-plan`, not a design doc.
- Tool-call first: emit `spawn_subagent` in the same turn as any spawn claim. Past tense after the tool result.
