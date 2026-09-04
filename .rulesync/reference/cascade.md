---
tags: [cascade]
---

# Cascade

Shipped protocol: **parent-only spawn**. Only the parent **orchestrator** session calls `spawn_subagent`. Implementer and thinker never spawn. Isolation is a **grunt sibling**. See [map](map.md).

## Parent orchestrator

Always-do lives in orchestrator/overview (do not open this file first). Peek/kill/`need:` stay here as reference.
⚠ / validate / sim → spawn implementer; not stop.
Child prompt first sentence only: `You are {agent} subagent.` Then task + abs paths + facts. Browse tags match → prompt must include abs `.rulesync/skills/browser/SKILL.md` and `.rulesync/reference/browser.md`.

Always spawn + prompt unless effective spawnMode is solo. First token = spawn unless effective spawnMode is solo. Parent Read/Bash deny expected if forgotten (cascade). Only effective spawnMode=solo (slash/history or jsonc/overlay/stamp) escapes spawn-first. Not parent Read jsonc. Hosts with no UserPromptSubmit additionalContext stay fail-closed cascade until `/solo`. `/cascade` restores spawn-first even if jsonc stays solo. Solo + user asks spawn → spawn (do not deny). `/parent` is last-ditch hook stamp not skill-instructed Read/Bash. No try-then-spawn. No parent probe. No tiny-read/grep/list_dir/bash/grunt-job for the user. No skip-spawn.
Create/change product files → grunt facts first; then thinker advise/plan/stop unless small/simple or prompt-is-spec → implementer. Default without detailed spec = grunt check → thinker advise/plan → stop. Advise-first stop wins until unlock. Unlock implementer only on: Implement-typed numbered/label pick1 or pick2 or `/implement-plan {n}` or explicit implement (=pick1 iff Implement-typed). Write-typed leftover never spawns implementer. `ok`/`yes`/`y`/`continue` ≠ either pick (`continue` = write-plan file gate only). Thinker recap alone ≠ spec-ready; do not auto-implement. Conversational advise recap = stop.
Advise leftover: numbered pick each on own line after tagged recap (not same-line); one empty blank line immediately before leftover 1. (leftover last; not adjacent to recap/body). Always-print typed leftover triple (advise-class final recap only) unless effective leftover-gate=auto and Implement-typed (pick2 chains write-plan persist → implement-plan `{n}`; skip leftover wait). Write-typed under auto still leftover wait; never spawn implementer. One verb per recap; never jammed Implement/write. No leftover on `need:` JSON wait-grunt grunt/implementer recaps slash-only turns. Effective leftover-gate: stamp `auto-ask-{sid}` > `.rulesync/grunt.config.jsonc` `leftoverGate` > `ask`. Hook effective spawn: stamp `spawn-mode-{sid}` body `solo`|`cascade` > one-release `grunt-off` presence as solo > jsonc `spawnMode` (committed + gitignored local overlay) > `cascade`. Fail-closed cascade. LLM keys solo off effective spawnMode via UserPromptSubmit additionalContext. `/auto` `/ask` session leftover-gate, not spawn-escape.
1. {Implement|Write} with verbal plan
2. {same verb} with file plan
3. Tweak
Type Implement = in-repo product writes. Type Write = persist-only/implementer-nonsense (SCA/advise-only/`/tmp`/inspect-pause). Recap remainder still names the human gate; leftover is not `4. Contact bank`. `/handoff` stays slash not Write pick1. No omit 1/2. No frozen 4. Do not relabel 3. Parent echoes printed leftover. Match number or full leftover label (or unique tail `verbal plan` / `file plan`). Always-do leftover match printed lines; not Skill-name (`2` ≠ write-plan). Implement pick1 = spawn implementer; paste last [thinker] recap as spec (how+why; implementer must not paste why into code comments); no `.tmp/grunt/plans`; no write-plan; no implement-plan. Implement pick2 = persist `.tmp/grunt/plans/{n}` then spawn implementer `plan=/abs/...` one-shot skip pause. Write pick1 = `/tmp` persist recap/body under `.tmp/grunt/`; no implementer. Write pick2 = write-plan persist inspect-pause; remainder `/implement-plan {n}`; no implementer this turn. Parent still no Write — existing write-plan/`/tmp` path/skill sequencing. 3 / Tweak → stay advise; extra text → thinker; bare 3/Tweak = stop wait notes. Bare `implement`/`implementer` → pick1 iff Implement-typed; else recap “no implementer this remainder”; no spawn. Bare `write` → pick1 iff Write-typed; else not a match. Type-mismatch → that recap no spawn. Alias `Implementer with …` → pick1/pick2 iff Implement-typed. `/write-plan` persist-only inspect-pause; remainder ask `/implement-plan {n}`. Not leftover pick 2. `/implement-plan {n}` stays disk/file run; ≠ conversational verbal pick. Disk leftover may invoke without user slash; verbal ≠ implement-plan.
Owned-defect after grunt: check/see-if = grunt first. Facts name a defect in a path we control (in-tree or package we publish) → writes remain → spawn thinker; not fact-stop; not implementer yet unless user already said fix / prompt-is-spec / small. Not ours → fact-stop/workaround OK; no Implement pick1. Unsure ownership → thinker. Control ≠ cwd; human-owned package still Fix {path} from consumer session; can't write → remainder `fix in {checkout path}` + ask switch. Recap `Fix {path+bug}` as prose; leftover always-print typed triple (Implement when in-repo writes; 3=tweak); do not relabel 3. Workaround = why rejected-alt never remainder. Grunt no leftover.
Never parent Write/Edit/Bash/Skill-that-writes. Child returned is not terminal if writes remain after that gate or spawn count is 0 on a pick1/pick2/`/implement-plan {n}`/spec/small file-change turn. plan/spec ready + writes remain → spawn implementer only on Implement-typed pick1/pick2 or `/implement-plan {n}`/spec/small; else recap-stop. plan-only `/write-plan` → recap + remainder `/implement-plan` (ask).

Precedence: slash → obvious fact/false+/reuse → advise-class row → prompt-is-spec → write.
1. Tools (facts / search / exec / git / web / test / low-reason mechanical write) → grunt. Facts/search → grunt, never thinker.
2. Write defined solution (prompt-is-spec or small/simple) → implementer. **Blocked if advise-class stems present** unless prompt-is-spec / obvious comment-spec false+. Advise-class + write-class → thinker first; implementer only after spec / pick1 / pick2 / `/implement-plan {n}`.
3. Think / plan / advise / recommend / how / why / explain (ask-us; not slash `/explain`; not one-cmd/last-log/source-token) → thinker. Facts=grunt/`need:`. **No implementer this turn**. Unsure → thinker. Cheap false+: I think / terraform plan / `/implement-plan` / `/solo` / source tokens / one-cmd / how- last-log / why. Why = judgment not patch not dump; parent cannot invent why; **parent cannot drop why**. Thinker recap without why = incomplete (leftover 3 / re-spawn; not silent; not invent). One re-spawn max then recap-as-is + flag.
   Reuse iff ALL: (1) same parent transcript already has finished `[thinker]:` (or the fact recap they’re poking); (2) user turn is advise-class again with no new path/error/snippet/name/“what about/also/now/but/instead”; (3) no implementer or grunt after that answer; no unresolved `need:`; (4) not “more/deeper/details/walk through/wrong”. Any tick fail / new session / `/pickup` / `/handoff` / compaction ate the body → spawn. Echo last `[thinker]:` recap (don’t paraphrase; no-strip why; no compress-to-one-line). Reuse echo: reprint last thinker’s leftover triple. Type-mismatch / bare implement on Write-typed → recap “no implementer this remainder”; ≠ spawn. Prose → `/explain` on visible child. Always-why recap ≠ `/explain`. Not grunt for parrot. Tag `[orchestrator]:` on no-spawn — don’t fake `[thinker]:`. Pitfalls: deeper→thinker; code moved invalidates; `need:` open; compaction.
4. Snippet / cite / "what is X" / world fact → grunt `job: web`. URL-in-a-cite ≠ browse. URL / browse / click / fill / snap / live DOM → grunt; child prompt must include abs `.rulesync/skills/browser/SKILL.md` and `.rulesync/reference/browser.md`; Read then `node scripts/browser.mjs`; Lightpanda default; never websearch that page. Never answer from memory. No `job:browse`.

Spawn only `grunt` | `implementer` | `thinker`. Omit `model`. Isolation `none` unless asked.

Implementer may tiny-Read/Grep/list_dir. Thinker named-file Read of prompt SSOT only; investigate/search/trees → `need:` grunt. Fat dumps via `need:` JSON.

Long parent sessions rely on two-pass compaction; prefer a new parent session per task rather than unbounded resume chains. `[features] two_pass_compaction = true` must live in `~/.grok/config.toml` (from `.grok/global-settings.toml` via `npm run sync:globals` dry-run / `npm run sync:globals:apply`). Project `.grok/config.toml` cannot set `[features]`. Do not add a SessionStart hook.

## Wait / peek

Parent-only. Non-blocking spawn so each child has a host id immediately. Per-child, not one global timer.
Every 60s peek is real host status (no `sleep` then guess). `timeout_ms=60000` every peek.
Quote host fields only (`status`, elapsed since spawn, last activity/output snippet) or quote the error. Never invent.
Classify `done` | `alive` | `stuck` vs prior peek: **done** (completed/failed), **alive** (running + fields/output changed), **stuck** (running + unchanged). Unchanged snippet = stuck, not “still working”.
Loop until done. No auto-kill. Kill only if the user asks and the host has a kill tool.
Final recap uses [output.md](output.md). Do not redo the child's work. Parent copies the child's recap (drop child tag; legal `[role]:` first line); no-strip; no compress-to-one-line; no body dump; no inventing files from logs. Multi-child: one recap; union paths in the sentences; worst remainder/blocker wins. Exceptions: in-flight wait = `[orchestrator]: wait grunt` only; `need:` stop = JSON only; max 3 `resume_from` → blocker recap + gathered facts (ask).

Parent Stop (`MAX_STOP=3`): do not waive fenced/impl finals for `tools-used` stamp. Parent `end_turn` is tagged recap (advise leftover numbered pick on own lines after one empty blank line) or `[orchestrator]: wait grunt`. First non-empty line must match legal `[orchestrator|grunt|implementer|thinker|handoff|tmp]:`. Advise leftover numbered pick may follow the tagged recap after one empty blank line (echo printed leftover; format only; hook does not map leftover numbers → skills; no leftover-label parser). Siblings still run → role tag + tagged recap. In-flight wait recap is `[orchestrator]: wait grunt` only. Mid-turn stays exactly `[orchestrator]: wait grunt`. Or consume `parent-escape-{sid}` once. Else block. No `isCheap` / trivia / long definitions.
`/handoff` is the other in-parent turn: context large + work unfinished → parent writes one `.tmp/grunt/handoffs/` file from its own transcript (no child sees the session), recaps `[handoff]: serial=… path=…`, tells the user to continue in a new session. No spawn, one write, not a mode.
`/tmp` is in-parent dump: parent writes one `.tmp/grunt/` root artifact from this session, recaps `[tmp]: serial=… path=…`. No spawn, one write, not a handoff, not a plan, no pickup.
`/pickup` is spawn-first pickup, not in-parent write; parent never Read. Inverse of `/handoff`.
`/solo` `/cascade` are session mode (not one-turn): `beforeSubmitPrompt` write-or-unlink `.tmp/grunt/orchestrator-logs/spawn-mode-{sid}` vs config (`solo`|`cascade`); slash==config unlinks; slash≠config writes body token; **always** unlink `grunt-off` (new+legacy). Hook effective stamp>one-release `grunt-off`>config>`cascade`. Fail-closed cascade. Unreadable/bad stamp body ignored. While hook-solo: skip parent-deny and spawn rewrite; Stop returns 0 before parent-escape consume. After stamp writes, UserPromptSubmit emits one-line additionalContext from spawnModeOf leftoverGateOf (skip host Stop banners). Hosts with no UserPromptSubmit additionalContext stay fail-closed cascade until `/solo`. `/auto` `/ask` session leftover-gate (not spawn-escape): stamp `.tmp/grunt/orchestrator-logs/auto-ask-{sid}` body `auto`|`ask` when slash ≠ config; slash==config unlinks. Effective stamp>config>ask. auto+Implement-typed pick2 chain skip leftover wait; Write-typed leftover wait. `/parent` is last-ditch hook stamp (not a mode, not skill-instructed Read/Bash): UserPromptSubmit writes `.tmp/grunt/orchestrator-logs/parent-escape-{sid}`; Stop consumes+unlinks once. Next Stop resumes spawn/recap rules. `/explain` is human recap after children; never parent Read; not a mode; not spawn-escape. Skills point here; do not paste this file. Never parent-Read protocol files.

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

If a child still emits `need:` and every job is `search|exec`, SubagentStop (and child `Stop` with `subagentType`) runs grunt-job in-hook and continues the child with concatenated grunt-job facts (`decision: "block"` + `additionalContext`). Mixed / web / test batches are not intercepted: parent `scripts/parse-need.mjs` + LLM grunt. Thinker has no bash; intercept still applies.

Parent: parse with `scripts/parse-need.mjs` (same grammar). If parse succeeds, fan out those jobs as parallel grunt spawns; do not interpret surrounding prose. Wait; one `resume_from: <child id>` with **new** facts only. Do not fresh-spawn. Max 3 `resume_from` for one child id; then parent blocker recap + the facts already gathered (ask).

Resume prompt = `You are {agent} subagent.` plus the new facts. Do not re-send the original task, cascade, or prior facts (`resume_from` already has the transcript). Do not wrap the facts in `[role]:`.

Voice: [output](output.md). Does not change need: JSON or plan grammar.

## Isolation grunt facts

Sentence plus up to 6 dash facts (fail: first 3 errors). Cap 8 lines. Size cap, not a recap cipher. No dumps, recap, HTML, JSON, full logs. No `verdict:`/`n:` wrappers.

Implementer/thinker: fat dumps via `need:` JSON. Implementer shell via rtk; cat/rg/curl/tests without rtk → fat `need:`.

Child prompt first sentence only: `You are {agent} subagent.` Then task + abs paths + facts. Browse tags match → prompt must include abs `.rulesync/skills/browser/SKILL.md` and `.rulesync/reference/browser.md`.

Grok PostToolUse is observe-only. SessionStart stays empty (token baseline). See [hooks](hooks.md).
