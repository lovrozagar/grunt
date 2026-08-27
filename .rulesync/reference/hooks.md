---
tags: [hooks]
---

# Hooks

SessionStart: keep empty (token baseline). Do not inject context. Do not register a SessionStart hook on `orchestrate-parent.json`.

Grok PostToolUse / UserPromptSubmit / SessionStart are observe-only — do not attempt output scrub; compress via RTK / spawn / isolation verdict only. Do not add PostToolUse scrub hooks.

Claude / Codex / Antigravity PreToolUse still run `scripts/scrub-spawn-prompt.mjs` and `scripts/gate-fat-tools.mjs`. Grok does not — spawn/fat rewrite is `orchestrate-parent.js` only. RTK stays `rtk.json`.

Parent `run_terminal_command` is deny-by-default except `node` (optional leading `rtk`) invoking `{workspace}/scripts/grunt-job.mjs` with `--job search|exec` and `--query`. Optional `--path` `--glob` (repeatable) `--cwd`. Not `web|test`, not other scripts. META strips `--query` value first so `|` inside query is allowed; pipes/`&&` outside query still deny. Never `cd &&`. Exec shell-meta in query is grunt-job FALLBACK (exit 2), not a parent-bash allow. Unknown flags → FALLBACK.

SubagentStop (and child Stop with `subagentType`) intercepts a parseable `need:` whose jobs are all `search|exec` (cap 4): runs grunt-job in-hook and continues the child with concatenated `verdict:` blobs. Mixed/web/test, parse fail, FALLBACK, `stopHookActive`, or more than 3 intercepts per child session → empty stdout (allow stop; parent LLM path). Parent `write` is deny-by-default except `.tmp/plans/` (`persist-plan.mjs`) and `.tmp/grunt/handoffs/` (`persist-handoff.mjs`); both validate + rewrite path/content, invalid body denies. Parent Stop (`MAX_STOP=3`): do not waive impl finals for `tools-used`. First non-empty line must match legal `[orchestrator|grunt|implementer|thinker|handoff]:`. Illegal: `[grunt done]` `[[agent] done]` wait-prose. Claude Agent launch ≠ done; in-flight host Stop → wait recap only (`[orchestrator]: wait grunt` or role echo); no SendMessage. Or consume `parent-escape-{sid}` once (`/parent`). No `isCheap` / trivia. Stamps: `tools-used` / `stop-block` / `need-intercept` / `parent-escape`. Skills point to cascade; do not paste protocol here.

`/solo` writes `grunt-off-{sid}`; `/cascade` unlinks it (`beforeSubmitPrompt`, exact-match only). While set: PreToolUse allows parent tools (fat gate still runs) and skips the `defaultGrunt` spawn rewrite; Stop returns 0 **before** the `parent-escape` consume, so solo never burns the one-turn stamp. Session-scoped, fail-closed.

rulesync canonical event is `beforeSubmitPrompt` (→ Claude/Codex `UserPromptSubmit`), not `userPromptSubmit` — an unknown key makes Zod reject the whole `.rulesync/hooks.jsonc`, emitting nothing while `--check` still reports up to date. Antigravity supports neither `beforeSubmitPrompt` nor `subagentStop`; `/solo` degrades there to the skill body alone.

Stop and SubagentStop timeout is 30s (grunt-job cap is 20s). PreToolUse / PostToolUse / UserPromptSubmit stay at 5s. If the intercept times out, the hook fail-opens and the child stops without verdicts.

`[features] two_pass_compaction` must live in `~/.grok/config.toml` (from `.grok/global-settings.toml` via `npm run sync:globals` / `npm run sync:globals:apply`). Project `.grok/config.toml` cannot set `[features]`.
