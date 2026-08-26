---
tags: [cascade]
---

# Cascade

Shipped protocol: **parent-only spawn**. Only the parent **orchestrator** session calls `spawn_subagent`. Implementer and thinker never spawn. Isolation is a **grunt sibling**. See [map](map.md).

## Parent orchestrator

1. Super-trivial / yes-no / definition-from-prompt with zero tools **and absolutely sure** → parent answers; no grunt/child. Parent does not web_search. `2+2` → answer.
2. Not absolutely sure / fresh or world facts → spawn grunt `job: web`. Do not answer from memory.
3. Cheap reply already in context: answer. No tools.
4. Tiny lookup (one file, ≤10-hit grep, list_dir): do it here. No bash. Do not spawn. Limits auto-injected; denylist / file>200KB / head_limit>500 → spawn grunt.
5. Fat dump: `spawn_subagent` type=grunt with `job: search|exec|web|test`. Isolated window. Expect `verdict:`.
6. Low-reason write (mechanical/repetitive/obvious; volume OK): spawn grunt. Mid reason / feature judgment: spawn implementer. Design / architecture / hard debug: spawn thinker.
7. Unsure → implementer.

Spawn only `grunt` | `implementer` | `thinker`. Omit `model`. Isolation `none` unless asked.

Implementer/thinker may tiny-Read/Grep/list_dir themselves. `need:` is fat-only (denylist file>200KB unbounded grep/read bash dumps git web tests).

Long parent sessions rely on two-pass compaction; prefer a new parent session per task rather than unbounded resume chains. `[features] two_pass_compaction = true` must live in `~/.grok/config.toml` (from `.grok/global-settings.toml` via `npm run sync:globals` dry-run / `npm run sync:globals:apply`). Project `.grok/config.toml` cannot set `[features]`. Do not add a SessionStart hook.

## Pre-spawn

If dumps are known (paths, rg, test cmd): parent and implementer run `node scripts/grunt-job.mjs --job search|exec --query …` in-session and pass those `verdict:` blobs into the child prompt. Optional `--path` `--glob` (repeatable) `--cwd`. `--query` is one argv; regex `|` OK. Never `cd &&`. Unknown flags or exec shell-meta in query → FALLBACK (exit 2). Do not start the child and `need:` for a dump already known. Thinker stays read-only (no bash): fat search|exec via `need:` + SubagentStop intercept.

For spawned grunt `job: search|exec`, first action is still `node scripts/grunt-job.mjs --job search|exec --query …` and echo stdout as the whole reply. Bounded `job: test` may try the same script (`--job test`); `job: web` and messy `job: test` stay LLM grunt. If the script prints `FALLBACK` (exit 2), LLM grunt may use tools.

## Wait / peek

Parent-only. Non-blocking spawn so each child has a host id immediately. Per-child, not one global timer.
Every ≤60s peek is real host status (no `sleep` then guess). First return ≤60s is the peek (earlier if the child finishes).
Quote host fields only (`status`, elapsed since spawn, last activity/output snippet) or quote the error. Never invent.
Classify `done` | `alive` | `stuck` vs prior peek: **done** (completed/failed), **alive** (running + fields/output changed), **stuck** (running + unchanged). Unchanged snippet = stuck, not “still working”.
Loop until done. No auto-kill. Kill only if the user asks and the host has a kill tool.
Then print recap as `[agent]: …` with real child output. Do not redo the child's work.

Parent Stop (`MAX_STOP=3`): do not waive fenced/impl finals for `tools-used` stamp. Allow cheap trivia, `[grunt|implementer|thinker]:` recap prefix, or consume `parent-escape-{sid}` once. Else block.
`/parent` is one-turn (not a mode): UserPromptSubmit writes `.tmp/orchestrator-logs/parent-escape-{sid}`; Stop consumes+unlinks once. Next Stop resumes spawn/cheap/recap rules. Skills point here; do not paste this file.

Host mapping (in-tree only; do not invent peek/kill APIs). GAP rows: no fake peeks, no auto-kill.

| Host | Spawn | Peek | Kill |
| --- | --- | --- | --- |
| Grok | `spawn_subagent` `background:true` → `task_id` | `get_command_or_subagent_output` + `timeout_ms=60000` | `kill_command_or_subagent` (user-ask only) |
| Claude Code | `Agent` if the parent session exposes it | GAP unless an in-tree schema names a status/output tool on that id (do not invent `TaskOutput`); else block on Agent return and classify `done` | GAP unless in-tree; no auto-kill |
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

Parent: parse with `scripts/parse-need.mjs` (same grammar). If parse succeeds, fan out those jobs as parallel grunt spawns; do not interpret surrounding prose. Wait; one `resume_from: <child id>` with **new** `verdict:` blobs only. Do not fresh-spawn. Max 3 `resume_from` for one child id; then parent reports blocked/partial with the verdicts already gathered.

Resume prompt = `You are {agent} subagent.` plus the new verdicts. Do not re-send the original task, cascade, or prior verdicts (`resume_from` already has the transcript).

Superterse does not change need:/verdict:/plan grammar.

## Isolation grunt `verdict:`

```
verdict: ok|fail|empty
n: <count>
- path:line — fact
```

Fail: first 3 error lines. ≤8 lines. No dumps, recap, HTML, JSON, full logs.

Implementer/thinker: fat dumps via `need:` JSON. Implementer shell via rtk; cat/rg/curl/tests without rtk → fat `need:`. For search|exec that already fits 8-line `verdict:`, implementer runs `node scripts/grunt-job.mjs` in-session instead of `need:` (`--path`/`--glob`/`--cwd` OK; never `cd &&`).

Child prompt = `You are {agent} subagent.` + task + abs paths + verdicts only.

Grok PostToolUse is observe-only. SessionStart stays empty (token baseline). See [hooks](hooks.md).
