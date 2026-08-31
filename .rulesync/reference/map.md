---
tags: [map]
---

# Map

Cheap outline. Not a file dump.

## Protocol
- `.rulesync/reference/cascade.md` — spawn / need / resume
- `.rulesync/reference/rtk.md` — shell compression
- `.rulesync/reference/browser.md` — Lightpanda-first session CLI (`nav|snap|click|fill|shot|pdf|stop`); not MCP
- `.rulesync/reference/hooks.md` — hook policy
- `.rulesync/reference/map.md` — this file
- `.rulesync/reference/output.md` — default voice

## Agent SSOT
- `.rulesync/subagents/{orchestrator,implementer,thinker,grunt}.md`
- `.rulesync/rules/overview.md` → `AGENTS.md`
- `.rulesync/rules/CLAUDE.md` → `CLAUDE.md`
- Default output: `.rulesync/reference/output.md` (overview.md → AGENTS.md; also agent bodies + CLAUDE.md, not auto-injected)

## Grok hand files
- `.grok/hooks/orchestrate-parent.js` + `orchestrate-parent.json` — parent spawn/fat/stop/plan-write / SubagentStop intercept
- `.grok/hooks/rtk.json` — RTK
- `.grok/skills/{write-plan,implement-plan,shared}/` — hand-only (no rulesync SSOT); point to cascade, do not paste
- `.grok/skills/{parent,explain,handoff,pickup,solo,cascade,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release}/` — generated from `.rulesync/skills/`; do not hand-edit
- `.grok/parent.md` — 1-line pointer to orchestrator agent; not SessionStart
- `.grok/roles/*.toml`
- `.grok/global-settings.toml` — merged into `~/.grok/config.toml` by `scripts/sync-global-settings.mjs` (not auto-loaded; project config cannot set `[features]`)
- `.rulesync/global-settings/` — host manifest and reserved noop payloads
- `.rulesync/mcp-policy.jsonc` — MCP deny-default SSOT (`default: deny`, `allow: []`)
- `.rulesync/skills/{parent,explain,handoff,pickup,solo,cascade,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release,browser}/` — skill SSOT; `rulesync -f skills` emits `.grok/skills/`, `.claude/skills/`, `.agents/skills/` byte-equal. `/cascade` = exit solo / restore cascade (not a sticky second mode)

## Scripts
- `scripts/check-globals.mjs` — `$HOME/.grok/config.toml` `[agent].name==orchestrator` + `[features].two_pass_compaction==true`; project `.grok/config.toml` must not have `[features]`/`[agent]`; wired as `sync:globals:check` (also after emit-mcp in `rulesync:check`)
- `scripts/gate-fat-tools.mjs`
- `scripts/scrub-spawn-prompt.mjs`
- `scripts/grunt-job.mjs` — flags `--job` `--query` `--path` `--glob` (repeatable) `--cwd`; regex in `--query` OK; never `cd &&`; unknown flags / exec shell-meta → FALLBACK
- `scripts/parse-need.mjs`
- `scripts/persist-handoff.mjs` — `.tmp/grunt/handoffs/{serial}-{slug}-{stamp}.md`; `HANDOFF_NAME:` → slug; H2 `Goal|State|Context|Next|Watch-outs`; `status` `open|resumed|done`
- `scripts/persist-plan.mjs`
- `scripts/sync-global-settings.mjs` — dry-run-by-default merge of `.grok/global-settings.toml` into `$HOME/.grok/config.toml`; manifest in `.rulesync/global-settings/`; `skipKeyPattern` skips MCP; never copies project MCP into `$HOME/.grok`
- `scripts/purge-global-mcps.mjs` — dry-run-by-default purge of stubborn global MCP sources (`$HOME/.grok/config.toml` plugins + `disabled_mcp_servers`, `$HOME/.cursor/mcp.json` `MCP_DOCKER`); `--apply` writes; never project MCP
- `scripts/emit-mcp-policy.mjs` — emit project MCP deny-default from `.rulesync/mcp-policy.jsonc` (not `rulesync -f mcp`); owns `.gemini/settings.json` `mcpServers` (merge extra keys)
- `scripts/emit-gemini.mjs` — `GEMINI.md` (`@AGENTS.md`) + `.gemini/agents/{id}/agent.md` from `.rulesync/subagents` (not `rulesync -t geminicli`); no prune; does not touch settings
- `scripts/emit-agent-shell-tools.mjs` — after rulesync subagents: rewrite `.claude/agents/grunt.md` body `Bash`; grok/codex/gemini/generic keep `run_terminal_command`
- `scripts/telemetry.mjs` — append-only `.tmp/orchestrator-logs/telemetry.ndjson` from hooks / grunt-job CLI; fail-open; never stdout
- `scripts/browser.mjs` — session browser rail `nav|snap|click|fill|shot|pdf|stop`; Lightpanda default; Chromium on verb/OS/probe/paint-host/one-escalate; `.tmp/grunt/browser/`

## Tmp
- `.tmp/plans/` — persist-plan / parent / implementer
- `.tmp/orchestrator-logs/` — hooks + grunt-job telemetry (shared; not grunt scratch)
- `.tmp/grunt/` — grunt scratch/tmp only
- `.tmp/grunt/browser/` — browser session/profile/shot/pdf (not MCP)
- `.tmp/grunt/handoffs/` — persist-handoff / `/handoff`; own serial counter (not plan serials)

## Stamps (`.tmp/orchestrator-logs/`)
- `tools-used` / `stop-block` / `need-intercept` / `parent-escape` — Stop does not waive impl finals for `tools-used`; `/parent` writes `parent-escape-{sid}` once
- `grunt-off-{sid}` — `/solo` session mode. Sticky: only `/solo` / `/cascade` move it. Requires a real sid (never the `default` fallback). Read fail-closed — an unreadable stamp keeps grunt on

## Generated (do not hand-edit; committed, not gitignored)
- `AGENTS.md`, `CLAUDE.md`
- `.claude/skills/*`, `.agents/skills/*`, `.grok/skills/{parent,explain,handoff,pickup,solo,cascade,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release}/` (from `.rulesync/skills/`)
- `.grok/agents/*`
- `.claude/agents/*`
- `.codex/agents/*`
- `.agents/agents/*`
- `.grok/config.toml` — project MCP `[[permissions]]` + `[plugins] deny_default`; no `[features]`
- `.mcp.json` — `mcpServers` from policy allow only
- `.claude/settings.json` MCP keys (`enableAllProjectMcpServers`, `enabledMcpjsonServers`, `permissions.deny` `mcp__*`); Agent denies/hooks stay
- `.codex/config.toml` `mcp_servers` (absent when allow empty); keep `[agents] max_depth`
- `.agents/mcp_config.json` — `mcpServers` from policy allow only
- `GEMINI.md` — `@AGENTS.md` pointer (`emit-gemini.mjs`)
- `.gemini/agents/{orchestrator,implementer,thinker,grunt}/agent.md` — `name` `description` `model` only (`emit-gemini.mjs`)
- `.gemini/settings.json` — `mcpServers` from policy allow only (`emit-mcp-policy.mjs`; extra keys preserved)
