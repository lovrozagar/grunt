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
- `.rulesync/reference/law.md` — domain law (stub; protocol stays cascade/overview)
- Generated catalogs: `.rulesync/reference/INDEX.md` — aggregate catalog composed from slices (law.md, skills-map.md, refs-map.md). Maps/law = slices for deep dive. INDEX always. Not if-maps-else.

## Agent SSOT
- Docs SoT: `.rulesync/skills` + `.rulesync/reference`. Generate maps anything placed there. `.agents` / `.claude` (and other host trees) are mirrors, not SoT; no mirror scan
- `.rulesync/subagents/{orchestrator,implementer,thinker,grunt}.md`
- `.rulesync/rules/overview.md` → `AGENTS.md`
- `.rulesync/rules/CLAUDE.md` → `CLAUDE.md`
- Default output: `.rulesync/reference/output.md` (overview.md → AGENTS.md; also agent bodies + CLAUDE.md, not auto-injected)

## Grok hand files
- `.grok/hooks/orchestrate-parent.js` + `.grok/hooks/orchestrate-parent.json` — parent spawn/fat/stop/plan-write / SubagentStop intercept
- `.grok/hooks/rtk.json` — RTK
- `.grok/skills/{parent,explain,handoff,pickup,solo,cascade,auto,ask,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release,write-plan,implement-plan}/` — generated from `.rulesync/skills/`; do not hand-edit
- `.grok/parent.md` — 1-line pointer to orchestrator agent; not SessionStart
- `.grok/roles/*.toml`
- `.grok/global-settings.toml` — merged into `~/.grok/config.toml` by `scripts/sync-global-settings.mjs` (not auto-loaded; project config cannot set `[features]`)
- `.rulesync/global-settings/` — host manifest and reserved noop payloads
- `.rulesync/mcp-policy.jsonc` — MCP deny-default SSOT (`default: deny`, `allow: []`)
- `.rulesync/grunt.config.jsonc` — leftover-gate + spawnMode SSOT (`version` `1`, `leftoverGate` `ask`|`auto` committed default `ask`, `spawnMode` `solo`|`cascade` committed default `cascade`; overlay may be solo). Gitignored overlay `.rulesync/grunt.config.local.jsonc` (example committed) merges leftoverGate/spawnMode over committed for hook/Stop/UserPromptSubmit. Never rewrite committed AGENTS. Hook effective spawn: stamp `spawn-mode-{sid}` > one-release `grunt-off` > config > `cascade`. Fail-closed cascade. LLM keys solo off effective spawnMode via UserPromptSubmit additionalContext. Keys independent.
- `.rulesync/skills/{parent,explain,handoff,pickup,solo,cascade,auto,ask,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release,browser,write-plan,implement-plan}/` — skill SSOT; `rulesync -f skills` emits `.grok/skills/`, `.claude/skills/`, `.agents/skills/` byte-equal. `/cascade` = exit solo / restore cascade (not a sticky second mode). `/auto` `/ask` = session leftover-gate (not spawn-escape)

## Scripts
- `scripts/pipeline.mjs` — inner generate/check/watch chain (rulesync + emit-* + hooks-union / check-globals). Called by `guarded-roots`; not a public npm script (`rulesync:generate` `rulesync:check` `rulesync:watch` only)
- `scripts/guarded-roots.mjs` — snapshot/remerge `AGENTS.md` `CLAUDE.md` `GEMINI.md` around pipeline; check interiors wrapper
- `scripts/check-globals.mjs` — `$HOME/.grok/config.toml` `[agent].name==orchestrator` + `[features].two_pass_compaction==true`; project `.grok/config.toml` must not have `[features]`/`[agent]`; wired as `sync:globals:check` (also after emit-mcp in `rulesync:check`)
- `scripts/gate-fat-tools.mjs`
- `scripts/scrub-spawn-prompt.mjs`
- `scripts/grunt-job.mjs` — flags `--job` `--query` `--path` `--glob` (repeatable) `--cwd`; regex in `--query` OK; never `cd &&`; unknown flags / exec shell-meta → FALLBACK
- `scripts/parse-need.mjs`
- `scripts/persist-handoff.mjs` — `.tmp/grunt/handoffs/{serial}-{slug}-{stamp}.md`; `HANDOFF_NAME:` → slug; H2 `Goal|State|Context|Next|Watch-outs`; `status` `open|resumed|done`
- `scripts/persist-tmp.mjs` — `.tmp/grunt/{serial}-{slug}-{stamp}.{ext}` root files; `TMP_NAME:` / `TMP_EXT:`; own serial; skip reserved dirs
- `scripts/persist-plan.mjs`
- `scripts/sync-global-settings.mjs` — dry-run-by-default merge of `.grok/global-settings.toml` into `$HOME/.grok/config.toml`; manifest in `.rulesync/global-settings/`; `skipKeyPattern` skips MCP; never copies project MCP into `$HOME/.grok`
- `scripts/purge-global-mcps.mjs` — dry-run-by-default purge of stubborn global MCP sources (`$HOME/.grok/config.toml` plugins + `disabled_mcp_servers`, `$HOME/.cursor/mcp.json` `MCP_DOCKER`); `--apply` writes; never project MCP
- `scripts/emit-mcp-policy.mjs` — emit project MCP deny-default from `.rulesync/mcp-policy.jsonc` (not `rulesync -f mcp`); owns `.gemini/settings.json` `mcpServers` (merge extra keys)
- `scripts/emit-gemini.mjs` — `GEMINI.md` (`@AGENTS.md`) + `.gemini/agents/{id}/agent.md` from `.rulesync/subagents` (not `rulesync -t geminicli`); no prune; does not touch settings
- `scripts/emit-agent-shell-tools.mjs` — after rulesync subagents: rewrite `.claude/agents/grunt.md` body `Bash`; grok/codex/gemini/generic keep `run_terminal_command`
- `scripts/browser.mjs` — session browser rail `nav|snap|click|fill|shot|pdf|stop`; Lightpanda default; Chromium on verb/OS/probe/paint-host/one-escalate; `.tmp/grunt/browser/`
- `scripts/grunt-config.mjs` — `loadLeftoverGate(workspaceRoot)` fail-closed `ask`; `loadSpawnMode(workspaceRoot)` fail-closed `cascade`; local overlay over committed; keys independent

## Tmp
- `.tmp/grunt/plans/` — persist-plan / parent / implementer; format SSOT = `.rulesync/reference/plan-format.md`
- `.tmp/grunt/orchestrator-logs/` — parent stamps
- `.tmp/grunt/` — grunt scratch + `/tmp` dumps `{serial}-{slug}-{stamp}.{ext}` at root (not nested `tmp/`)
- `.tmp/grunt/browser/` — browser session/profile/shot/pdf (not MCP)
- `.tmp/grunt/handoffs/` — persist-handoff / `/handoff`; own serial counter (not plan serials)

## Stamps (`.tmp/grunt/orchestrator-logs/`)
- `tools-used` / `stop-block` / `need-intercept` / `parent-escape` / `auto-ask` / `spawn-mode` — Stop does not waive impl finals for `tools-used`; `/parent` writes `parent-escape-{sid}` once
- `spawn-mode-{sid}` — spawn session stamp. Body `solo`|`cascade`. Slash==config unlinks. Stamp only on slash not on jsonc-only. Sid-less: no stamp. Unreadable/bad body ignored (dual-read `grunt-off` else config → cascade). `/solo` `/cascade` always unlink `grunt-off`
- `grunt-off-{sid}` — one-release dual-read as solo when spawn-mode stamp missing or body not exact `solo`|`cascade`. `/solo` `/cascade` always unlink. Requires a real sid (never the `default` fallback). Do not write new `grunt-off`
- `auto-ask-{sid}` — leftover-gate session stamp. Body `auto`|`ask`. Slash==config unlinks. Sid-less: no stamp. Unreadable/bad body ignored (fall through config → ask). Not spawn-escape.

## Generated (do not hand-edit; committed, not gitignored)
- `AGENTS.md`, `CLAUDE.md`
- `.rulesync/reference/INDEX.md`, `skills-map.md`, `refs-map.md` (`emit-maps.mjs`)
- `.claude/skills/*`, `.agents/skills/*`, `.grok/skills/{parent,explain,handoff,pickup,solo,cascade,auto,ask,commit,commit-and-push,commit-push,commit-push-deploy,commit-push-release,write-plan,implement-plan}/` (from `.rulesync/skills/`)
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
