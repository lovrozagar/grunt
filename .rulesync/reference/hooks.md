---
tags: [hooks]
---

# Hooks

SessionStart: keep empty (token baseline). Do not inject context. Do not register a SessionStart hook on `orchestrate-parent.json`.

Grok PostToolUse / UserPromptSubmit / SessionStart are observe-only — do not attempt output scrub; compress via RTK / spawn / isolation verdict only. Do not add PostToolUse scrub hooks.

Claude / Codex / Antigravity PreToolUse still run `scripts/scrub-spawn-prompt.mjs` and `scripts/gate-fat-tools.mjs`. Grok does not — spawn/fat rewrite is `orchestrate-parent.js` only. RTK stays `rtk.json`.

Parent `run_terminal_command` is deny-by-default except `node` (optional leading `rtk`) invoking `{workspace}/scripts/grunt-job.mjs` with `--job search|exec` and `--query`. Optional `--path` `--glob` (repeatable) `--cwd`. Not `web|test`, not other scripts. META strips `--query` value first so `|` inside query is allowed; pipes/`&&` outside query still deny. Never `cd &&`. Exec shell-meta in query is grunt-job FALLBACK (exit 2), not a parent-bash allow. Unknown flags → FALLBACK.

SubagentStop (and child Stop with `subagentType`) intercepts a parseable `need:` whose jobs are all `search|exec` (cap 4): runs grunt-job in-hook and continues the child with concatenated `verdict:` blobs. Mixed/web/test, parse fail, FALLBACK, `stopHookActive`, or more than 3 intercepts per child session → empty stdout (allow stop; parent LLM path). Parent Stop (`MAX_STOP=3`): do not waive impl finals for `tools-used`. Allow cheap, `[grunt|implementer|thinker]:` recap prefix, or consume `parent-escape-{sid}` once (`/parent`). Stamps: `tools-used` / `stop-block` / `need-intercept` / `parent-escape`. Skills point to cascade; do not paste protocol here.

Stop and SubagentStop timeout is 30s (grunt-job cap is 20s). PreToolUse / PostToolUse / UserPromptSubmit stay at 5s. If the intercept times out, the hook fail-opens and the child stops without verdicts.

`[features] two_pass_compaction` must live in `~/.grok/config.toml` (from `.grok/global-settings.toml` via `npm run sync:globals` / `npm run sync:globals:apply`). Project `.grok/config.toml` cannot set `[features]`.
