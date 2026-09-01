# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-09-01

### Added

- `/tmp` skill (host mirrors) + `scripts/persist-tmp.mjs` (+ tests): one-off convo artifacts under `.tmp/grunt/tmp/`; Grok `orchestrate-parent.js` persist rewrite; Stop tag `[tmp]:`
- Typed advise leftover triple: `{Implement|Write} with verbal|file plan` + `Tweak` — Implement pick1/pick2 still spawn implementer; Write pick1 = `/tmp` persist (no implementer); Write pick2 = write-plan inspect-pause then `/implement-plan {n}` (no implementer this turn); type-mismatch / bare `implement` on Write-typed = no spawn
- Owned-defect after grunt: in-tree/package defect → thinker `Fix {path}` leftover (not fact-stop); workaround stays why-clause

### Changed

- Consumer npm scripts prefixed `grunt:<SoT-key>` (`grunt:rulesync:generate`, `grunt:doctor`, …); init migrates owned unprefixed keys + `npm run` refs; SoT repo scripts stay unprefixed; no aliases — CI/husky must switch
- `package.json` `files` publishes `persist-tmp.mjs`; README documents `/tmp`, typed leftover, and consumer script rename
- Cascade/output/write-plan/implement-plan/orchestrator/thinker (and host mirrors) aligned to typed leftover + `/tmp`

## [0.5.0] - 2026-09-01

### Added

- Advise leftover picks after thinker recap: (1) Implementer with verbal plan (2) Implementer with file plan (3) Tweak — pick1 = implementer + last thinker recap as spec; pick2 = write-plan persist then implement-plan one-shot (`plan=/abs/...`); `/write-plan` ≠ pick2; `/implement-plan {n}` disk/file ≠ verbal
- Thinker recap shape `{decided}. {how-capsule}. {why-clause}`
- rulesync SSOT skills `write-plan` + `implement-plan` (host mirrors under `.agents` / `.claude` / `.grok` as applicable)
- `.rulesync/reference/` maps/index: `INDEX.md` `law.md` `plan-format.md` `refs-map.md` `skills-map.md`
- `scripts/pipeline.mjs` `emit-maps.mjs` `skill-conflicts.mjs` (+ tests/fixtures); doctor `REQUIRED_MAP_FILES` + skill-conflicts warn; `cli/init.mjs` `PRODUCT_SCRIPTS` for those scripts + skill conflict warn

### Changed

- Public `rulesync:generate|check|watch` via guarded-roots → pipeline (drop consumer-facing `:raw` scripts)
- `package.json` `files` publishes `emit-maps` `pipeline` `skill-conflicts`
- README: advise picks; `.rulesync` SoT / host mirrors; maps on generate
- `plan-format` moved to `.rulesync/reference/plan-format.md` (was `.grok/skills/shared/plan-format.md`)
- `commit-and-push` thin alias; explain skill updates as in tree

### Removed

- Tracked `.grok/skills/shared/plan-format.md`
- npm scripts `rulesync:generate:raw` / `rulesync:watch:raw` / `rulesync:check:raw`

## [0.4.2] - 2026-08-31

### Added

- Keep a Changelog history in `CHANGELOG.md` (this file); publish it via `package.json` `files`
- `scripts/guarded-roots.test.ts` for generate/check/watch snapshot-remerge
- README host-support GAP table (Grok/Claude/Codex/Antigravity/Gemini spawn-peek-kill; no invented peek/kill APIs)
- scrub-text tests for remaining mid-intent phrases and blank/ws/fence helpers
- init tests: sentinel auto-skip without a telemetry file; `.grok/hooks/orchestrate-parent.js` means inited, not auto-skip

### Changed

- Parent SoT: `Parent = orchestrator (this file)` in `AGENTS.md` / `CLAUDE.md` / rulesync rules
- `.rulesync/reference/hooks.md` and `map.md`: repo-relative hook/script paths; drop `scripts/telemetry.mjs` from the map
- README package version `0.4.2`; re-init sentinels no longer mention telemetry; Grok-only `write-plan` `implement-plan` `shared` noted as hand files (not rulesync SSOT); published `files` list documents `guarded-roots.mjs` + `CHANGELOG.md` and drops telemetry
- `cli/init.mjs`: drop `telemetry.mjs` from `PRODUCT_SCRIPTS`; `shouldAutoSkipGlobals` no longer treats `scripts/telemetry.mjs` as a sentinel
- `scripts/grunt-job.mjs` and `.grok/hooks/orchestrate-parent.js`: strip `logTelemetry`; `ORCHESTRATOR_LOGS_DIR` inlined on the hook
- Tests drop NDJSON telemetry assertions (`cli/init.test.ts`, `scripts/orchestrate-parent.test.ts`, `scripts/gate-fat-tools.test.ts`)

### Removed

- Product telemetry: `scripts/telemetry.mjs` (append-only `.tmp/orchestrator-logs/telemetry.ndjson` from hooks / grunt-job; fail-open)
- Telemetry as a re-init / globals auto-skip sentinel
- `scripts/telemetry.mjs` from the published `files` list (`scripts/telemetry.test.ts` already absent)

## [0.4.1] - 2026-08-31

### Added

- Init snapshot/remerge of guarded roots `AGENTS.md` `CLAUDE.md` `GEMINI.md` around generate/check/watch
- Orchestrator advise-first Implement picks; `ok` / `yes` / `continue` ≠ implement after conversational advise

## [0.4.0] - 2026-08-31

### Added

- Lightpanda-first session browser rail `nav|snap|click|fill|shot|pdf|stop` plus unified doctor
- Browser skill shipped to host trees
- `/pickup` spawn-first handoff counterpart (not a mode)

## [0.3.11] - 2026-08-28

### Added

- Prompt-is-spec implementer write allowlist (gate)

## [0.3.10] - 2026-08-28

### Added

- `commit-push` release and deploy skills

### Changed

- README rewritten as a full product guide

### Removed

- Architecture Excalidraw diagram

## [0.3.9] - 2026-08-28

### Changed

- Clack CLI prompts

### Fixed

- Orchestrator spawn-first deny Read; clarify `DENY_REASON`

## [0.3.8] - 2026-08-27

### Added

- `/cascade` exit-solo skill

## [0.3.7] - 2026-08-27

### Fixed

- Consumer hook permissions deny without `Write(platform)`

## [0.3.6] - 2026-08-27

### Fixed

- Deny parent Write; voice Stop

## [0.3.5] - 2026-08-27

### Fixed

- Hook `package.json` `"type": "module"` so Stop ESM loads
- Positive-only Stop; thinker offload

## [0.3.4] - 2026-08-27

### Fixed

- Recap tags; stop-block reset

## [0.3.3] - 2026-08-27

### Added

- Stop walls with always-do XOR map

## [0.3.2] - 2026-08-27

### Added

- `--skip-globals` and smarter init merge

## [0.3.1] - 2026-08-27

### Added

- CI publish `@lovrozagar/grunt` to GitHub Packages

### Fixed

- Stop recap, spawn cap, scratch rewrite

## [0.3.0] - 2026-08-27

### Added

- Skills: `handoff`, `solo`, `commit`, `commit-and-push`, `explain`, `parent` (rulesync + host trees)
- Larger init pipeline: `emit-gemini`, `emit-agent-shell-tools`, `emit-mcp-policy`, `hooks-union`, `persist-handoff`
- Gemini CLI agent shells + settings emit
- Orchestrate-parent expansion; host `hooks.json`

### Changed

- Cascade/map/rules sync; package `0.3.0`

## [0.2.0] - 2026-08-27

### Added

- Agents context

### Changed

- Slim agent prompts; max permissions

## [0.1.0] - 2026-08-26

First published tag. No `v0.0.x`.

### Added

- `@lovrozagar/grunt` npm package: deep-merge rulesync trees, product scripts, and generate pipeline into a consumer repo (`npx @lovrozagar/grunt` / `init`)
- Host emit matrix: Grok, Claude Code, Codex, Antigravity; Gemini CLI tracked as a generate gap
- Agents: orchestrator (parent) plus grunt / implementer / thinker
- Product scripts including `grunt-job`, persist-plan, emit-mcp-policy, gate-fat-tools, scrub-spawn-prompt, scrub-text, check-globals, sync-global-settings, purge-global-mcps, and `scripts/telemetry.mjs` NDJSON (present from the first commit)
- Skills: `explain`, `parent`, `terse`; Grok-only `write-plan` / `implement-plan`
- GitHub Actions CI and npm `0.1.0` release

### Fixed

- Terse and spawn rules

[0.4.2]: https://github.com/lovrozagar/grunt/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/lovrozagar/grunt/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/lovrozagar/grunt/compare/v0.3.11...v0.4.0
[0.3.11]: https://github.com/lovrozagar/grunt/compare/v0.3.10...v0.3.11
[0.3.10]: https://github.com/lovrozagar/grunt/compare/v0.3.9...v0.3.10
[0.3.9]: https://github.com/lovrozagar/grunt/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/lovrozagar/grunt/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/lovrozagar/grunt/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/lovrozagar/grunt/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/lovrozagar/grunt/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/lovrozagar/grunt/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/lovrozagar/grunt/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/lovrozagar/grunt/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/lovrozagar/grunt/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/lovrozagar/grunt/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lovrozagar/grunt/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lovrozagar/grunt/releases/tag/v0.1.0
