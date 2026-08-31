---
tags: [cascade]
---

# Cascade

Shipped protocol: **parent-only spawn**. Only the parent **orchestrator** session calls `spawn_subagent`. Implementer and thinker never spawn. Isolation is a **grunt sibling**. See [map](map.md).

## Parent orchestrator

Always-do lives in orchestrator/overview (do not open this file first). Peek/kill/`need:` stay here as reference.
⚠ / validate / sim → spawn implementer; not stop.
Child prompt first sentence only: `You are {agent} subagent.` Then task + abs paths + verdicts only.

Always spawn + prompt. First token = spawn. Parent Read/Bash deny expected if forgotten. Only `/solo` (session stamp) escapes spawn workflow. `/parent` is last-ditch hook stamp not skill-instructed Read/Bash. No try-then-spawn. No parent probe. No tiny-read/grep/list_dir/bash/grunt-job for the user. No skip-spawn.
Create/change product files → grunt facts first; then thinker advise/plan/stop unless small/simple or prompt-is-spec → implementer. Default without detailed spec = grunt check → thinker advise/plan → stop. Advise-first stop wins until user picks **Implement** (number/label from last recap) OR `/implement-plan` OR explicit implement. `/write-plan` path + continue unchanged. `ok`/`yes`/`y`/`continue` ≠ implement after conversational advise (`continue` = write-plan file gate only). Thinker plan/recap alone ≠ plan/spec ready; do not auto-implement. Persist `/write-plan` file path + user continue is the implement gate; conversational advise recap = stop.
Advise finals: numbered pick each on own line after tagged recap (not same-line):
1. Implement
2. Tweak
Never parent Write/Edit/Bash/Skill-that-writes. Child returned is not terminal if writes remain after that gate or spawn count is 0 on an Implement-pick/spec/small file-change turn. plan/spec ready + writes remain → spawn implementer only on that gate; else recap-stop. plan-only `/write-plan` → recap + remainder `/implement-plan` (ask).

Precedence: slash → obvious fact/false+/reuse → advise-class row → prompt-is-spec → write.
1. Tools (facts / search / exec / git / web / test / low-reason mechanical write) → grunt. Facts/search → grunt, never thinker.
2. Write defined solution (prompt-is-spec or small/simple) → implementer. **Blocked if advise-class stems present** unless prompt-is-spec / obvious comment-spec false+. Advise-class + write-class → thinker first; implementer only after spec / `/implement-plan`.
3. Think / plan / advise / recommend / how / why / explain (ask-us; not slash `/explain`; not one-cmd/last-log/source-token) → thinker. Facts=grunt/`need:`. **No implementer this turn**. Unsure → thinker. Cheap false+: I think / terraform plan / `/implement-plan` / `/solo` / source tokens / one-cmd / how- last-log / why. Why = judgment not patch not dump; parent cannot invent why.
   Reuse iff ALL: (1) same parent transcript already has finished `[thinker]:` (or the fact recap they’re poking); (2) user turn is advise-class again with no new path/error/snippet/name/“what about/also/now/but/instead”; (3) no implementer or grunt after that answer; no unresolved `need:`; (4) not “more/deeper/details/walk through/wrong”. Any tick fail / new session / `/pickup` / `/handoff` / compaction ate the body → spawn. Echo last `[thinker]:` recap one-line (don’t paraphrase). Advise leftover still adds numbered pick on own lines. Prose → `/explain` on visible child. Not grunt for parrot. Tag `[orchestrator]:` on no-spawn — don’t fake `[thinker]:`. Pitfalls: deeper→thinker; code moved invalidates; `need:` open; compaction.
4. Fresh/world facts → grunt `job: web`. Never answer from memory.

Spawn only `grunt` | `implementer` | `thinker`. Omit `model`. Isolation `none` unless asked.

Implementer may tiny-Read/Grep/list_dir. Thinker named-file Read of prompt SSOT only; investigate/search/trees → `need:` grunt. Fat dumps via `need:` JSON.

Long parent sessions rely on two-pass compaction; prefer a new parent session per task rather than unbounded resume chains. `[features] two_pass_compaction = true` must live in `~/.grok/config.toml` (from `.grok/global-settings.toml` via `npm run sync:globals` dry-run / `npm run sync:globals:apply`). Project `.grok/config.toml` cannot set `[features]`. Do not add a SessionStart hook.

## Wait / peek

Parent-only. Non-blocking spawn so each child has a host id immediately. Per-child, not one global timer.
Every 60s peek is real host status (no `sleep` then guess). `timeout_ms=60000` every peek.
Quote host fields only (`status`, elapsed since spawn, last activity/output snippet) or quote the error. Never invent.
Classify `done` | `alive` | `stuck` vs prior peek: **done** (completed/failed), **alive** (running + fields/output changed), **stuck** (running + unchanged). Unchanged snippet = stuck, not “still working”.
Loop until done. No auto-kill. Kill only if the user asks and the host has a kill tool.
Final recap uses [output.md](output.md) natural buckets (completed / in-flight / remainder / blocker; omit empty). Do not redo the child's work. Exceptions: in-flight wait = `[orchestrator]: wait grunt` only; `need:` stop = JSON only; max 3 `resume_from` → blocker recap + gathered verdicts (ask).

Parent Stop (`MAX_STOP=3`): do not waive fenced/impl finals for `tools-used` stamp. Parent `end_turn` is tagged recap (advise leftover numbered pick on own lines after) or `[orchestrator]: wait grunt`. First non-empty line must match legal `[orchestrator|grunt|implementer|thinker|handoff]:`. Advise leftover numbered pick may follow the tagged recap. Siblings still run → role tag + one-line echo. In-flight wait recap is `[orchestrator]: wait grunt` only. Mid-turn stays exactly `[orchestrator]: wait grunt`. Or consume `parent-escape-{sid}` once. Else block. No `isCheap` / trivia / long definitions.
`/handoff` is the other in-parent turn: context large + work unfinished → parent writes one `.tmp/grunt/handoffs/` file from its own transcript (no child sees the session), recaps `[handoff]: serial=… path=…`, tells the user to continue in a new session. No spawn, one write, not a mode.
`/pickup` is spawn-first pickup, not in-parent write; parent never Read. Inverse of `/handoff`.
`/solo` is the session mode (not one-turn): `beforeSubmitPrompt` writes `.tmp/orchestrator-logs/grunt-off-{sid}`, every gate short-circuits while it exists, `/cascade` unlinks it. Everything above resumes next turn. Antigravity: skill-only, no stamp create (see hooks.md). `/parent` is last-ditch hook stamp (not a mode, not skill-instructed Read/Bash): UserPromptSubmit writes `.tmp/orchestrator-logs/parent-escape-{sid}`; Stop consumes+unlinks once. Next Stop resumes spawn/recap rules. `/explain` is human recap after children; never parent Read; not a mode; not spawn-escape. Skills point here; do not paste this file. Never parent-Read protocol files.

Host mapping (in-tree only; do not invent peek/kill APIs). GAP rows: no fake peeks, no auto-kill.

| Host | Spawn | Peek | Kill |
| --- | --- | --- | --- |
| Grok | `spawn_subagent` `background:true` → `task_id` | `get_command_or_subagent_output` + `timeout_ms=60000` | `kill_command_or_subagent` (user-ask only) |
| Claude Code | `Agent` if the parent session exposes it | GAP unless an in-tree schema names a status/output tool on that id (do not invent `TaskOutput`); else block on Agent return and classify `done`. Agent launch ≠ child done; in-flight host Stop → only `[orchestrator]: wait grunt`; no SendMessage | GAP unless in-tree; no auto-kill |
| Codex | host agent/call | GAP; block on host agent/call return; classify `done` | GAP; no auto-kill |
| Antigravity | main-session parent | GAP peek/kill; main-session parent | GAP; no auto-kill |
| Gemini | not emitted; tracked gap | GAP; no fake peeks | GAP; no auto-kill |

## Late dump (`need:` + `resume_from`)

If implementer/thinker still needs a fat dump: it **stops**. The stop message for dumps is this JSON line only (no prose):

```
need: [{"job":"search","query":"..."}]
```

`job` ∈ search|exec|web|test. 1–N jobs. Cap one batch at 4 jobs; overflow stays for the next loop. Do not emit N sequential single-job stops for known-parallel dumps.

If a child still emits `need:` and every job is `search|exec`, SubagentStop (and child `Stop` with `subagentType`) runs grunt-job in-hook and continues the child with concatenated `verdict:` blobs (`decision: "block"` + `additionalContext`). Mixed / web / test batches are not intercepted: parent `scripts/parse-need.mjs` + LLM grunt. Thinker has no bash; intercept still applies.

Parent: parse with `scripts/parse-need.mjs` (same grammar). If parse succeeds, fan out those jobs as parallel grunt spawns; do not interpret surrounding prose. Wait; one `resume_from: <child id>` with **new** `verdict:` blobs only. Do not fresh-spawn. Max 3 `resume_from` for one child id; then parent blocker recap + the verdicts already gathered (ask).

Resume prompt = `You are {agent} subagent.` plus the new verdicts. Do not re-send the original task, cascade, or prior verdicts (`resume_from` already has the transcript).

Voice: [output](output.md). Does not change need:/verdict:/plan grammar.

## Isolation grunt `verdict:`

```
verdict: ok|fail|empty
n: <count>
- path:line — fact
```

Fail: first 3 error lines. ≤8 lines. No dumps, recap, HTML, JSON, full logs.

Implementer/thinker: fat dumps via `need:` JSON. Implementer shell via rtk; cat/rg/curl/tests without rtk → fat `need:`.

Child prompt first sentence only: `You are {agent} subagent.` Then task + abs paths + verdicts only.

Grok PostToolUse is observe-only. SessionStart stays empty (token baseline). See [hooks](hooks.md).
