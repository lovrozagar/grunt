# Grunt

Multi-agent orchestrator SoT — deep-merge rulesync trees product scripts and generate pipeline into a consumer repo

OSS drop-in; merges existing configs; switches default provider flow to Grunt.

- [Install](#install)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [CLI](#cli)
- [Init](#init)
- [Version bump](#version-bump)
- [Agents](#agents)
- [Skills](#skills)
- [Generate](#generate)
- [Config](#config)
- [Architecture](#architecture)
- [Layout](#layout)
- [Develop](#develop)
- [Examples](#examples)
- [License](#license)

## Install

- Node.js 22+
- Consumer:

```
npm i -D @lovrozagar/grunt
npx @lovrozagar/grunt
```

- Same as `npx @lovrozagar/grunt init` when no command
- Do not `npm test` as a consumer
- Package: `@lovrozagar/grunt` `0.3.9` MIT · https://github.com/lovrozagar/grunt

## Prerequisites

All OS. Print-only. Never auto-install.

```
npx grunt doctor
node scripts/doctor.mjs
```

Exit 1 if any required missing; 0 if all required ok. Optional `gh` reported only.

| tool | required | install |
| --- | --- | --- |
| node ≥22 + npm | yes | https://nodejs.org (≥22) · nvm / OS pkg · win `winget install OpenJS.NodeJS.LTS` |
| git | yes | linux `sudo apt install git` · mac `brew install git` · win `winget install Git.Git` |
| rtk | yes | linux/mac `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh \| sh` or `brew install rtk` · win release zip `rtk.exe` on PATH or WSL curl ([docs](https://www.rtk-ai.app/docs/getting-started/installation/)) |
| rulesync | yes | `npm i -D rulesync` / npx (PATH or npx-able) |
| lightpanda | yes | `curl -fsSL https://pkg.lightpanda.io/install.sh \| bash` · mac `brew tap lightpanda-io/browser` · win WSL only |
| chromium-family | yes | linux `sudo apt install chromium` · mac `brew install --cask chromium` or `google-chrome` · win `winget install Google.Chrome` / `Microsoft.Edge` + PATH |
| gh | no | report only |

Rulesync schema doctor is separate: `npm run rulesync:doctor`.

## Usage

- TTY no command → menu (init default; generate check sync-globals purge-mcps doctor help quit)
- Piped / CI / `--yes` / `-y` / `--non-interactive` no command → still `init`
- Bin: `grunt` → `./bin/grunt.js` (`type: module`)

## CLI

### Commands

- `init` → `init()` — merge SoT, `npm install`, `rulesync:generate`, `sync:globals:apply`, `rulesync:check`
- `generate` → `npm run rulesync:generate`
- `check` → `npm run rulesync:check`
- `sync-globals` → `npm run sync:globals` (dry-run); `--apply` → `sync:globals:apply`
- `purge-mcps` → `npm run purge:global-mcps` (dry-run); `--apply` → `purge:global-mcps:apply`
- `doctor` → `npm run doctor` (`node scripts/doctor.mjs`). Rulesync schema: `npm run rulesync:doctor`
- `help`
- `version`

### Flags

- `--skip-globals` — skip `sync:globals:apply` on init
- `--yes` / `-y` / `--non-interactive` — no TTY menu; default command still `init`. Not `--apply`
- `--apply` — write for `sync-globals` / `purge-mcps`
- `--host <id>` — `sync-globals --host <id>`

## Init

- Merge SoT `npm install` `rulesync:generate` `sync:globals:apply` `rulesync:check`
- `--skip-globals` skips apply
- Re-init auto-skips globals when `<!-- grunt:begin -->` in `AGENTS.md`/`CLAUDE.md` **or** `scripts/telemetry.mjs` exists
- First init (no sentinel no telemetry) applies globals unless flagged
- Owned trees/scripts refresh; extra `.rulesync` files kept; patches to grunt-owned files lost

## Version bump

```
npm i -D @lovrozagar/grunt@latest && npx @lovrozagar/grunt init
```

- Same re-init / globals rules as Init

## Agents

SoT: `.rulesync/subagents/{orchestrator grunt implementer thinker}.md`

Emit: `.claude/` `.grok/` `.agents/` `.gemini/`

- **orchestrator** (parent) — always spawn+prompt; user-facing only `[orchestrator]:` (or child role tag) one-line echo. `/parent` one-turn; `/handoff` writes `.tmp/grunt/handoffs/{serial}-{slug}-{stamp}.md`; `/pickup` spawn-first pickup (inverse of `/handoff`; not a mode). `/solo` session escape; `/cascade` restores it. Small/low router. First token spawn. No parent Read/Bash/Grep. Does not implement, plan, or fetch world facts
- **grunt** — tools: facts/search/exec/git/web/test/low-reason mechanical write. Isolation `verdict:`. Never feature solution. Never spawn. World fact: `job: web`
- **implementer** — write already-defined solution on allowlisted paths. TDD when spec/plan says tests. Validate + sim after write. Fat dumps via `need:`. Never spawn. Never plan. Id is **implementer** (not Implementor)
- **thinker** — plan/deep reason; edge cases. Read-only named-file Read of prompt SSOT; trees/search/exec/web/test → `need:`. Never spawn. No bash. Never implement

Children never spawn. Spawn only grunt|implementer|thinker. Omit model on spawn; frontmatter on agent files picks haiku/sonnet/opus vs grok-4.5 / grok-4.6 / other hosts. Voice: `.rulesync/reference/output.md`. Protocol: `.rulesync/reference/cascade.md`. `AGENTS.md`/`CLAUDE.md` spawn-first. `GEMINI.md` → `@AGENTS.md`. Goals: synced configs across grok build claude code codex gemini cli antigravity; max situational speed; superterse token savings; max/min reasoning by role.

## Browser

Lightpanda-first session CLI: `node scripts/browser.mjs nav|snap|click|fill|shot|pdf|stop|doctor|ensure`. Zero MCP. Zero env knobs. Chromium only for `shot`/`pdf`/`trace`, Windows, missing Lightpanda, one probe-fail replay, or paint hosts. Session: `.tmp/grunt/browser/`. Spec: [`.rulesync/reference/browser.md`](.rulesync/reference/browser.md).

`node scripts/browser.mjs doctor` (alias `ensure`) runs the unified doctor (`scripts/doctor.mjs`). Install engines: [Prerequisites](#prerequisites).

## Skills

Present under `.claude` / `.rulesync` / `.agents`:

- `browser` `cascade` `commit` `commit-and-push` `commit-push` `commit-push-deploy` `commit-push-release` `explain` `handoff` `pickup` `parent` `solo`
- Grok-only: `write-plan` `implement-plan` (`/write-plan` plan-only → `next: /implement-plan`)

## Generate

Pipeline (no `-t geminicli`):

1. `rulesync generate` — emit grok / claude / codex / antigravity
2. `emit-mcp-policy.mjs`
3. `emit-gemini.mjs` — `GEMINI.md` `.gemini/agents/{id}/agent.md` MCP `.gemini/settings.json`
4. `emit-agent-shell-tools` — Claude grunt body `Bash`; other hosts `run_terminal_command` (hooks-union)

`check` = rulesync check. `doctor` = unified prereqs. Schema: `npm run rulesync:doctor`.

Emit writes other-CLI trees from `.rulesync` for the **next** process of that CLI. Not a live hop into another host.

## Config

- SoT merge into consumer repo; existing configs kept where not grunt-owned
- Globals: first init apply; re-init auto-skip (sentinel / telemetry) or `--skip-globals`
- `sync-globals` / `purge-mcps`: dry-run default; `--apply` writes
- Hosts: grok claude codex gemini antigravity

## Architecture

Protocol picture: one CLI host process, parent-only orchestrator in that session, three sibling spawn types (`grunt` | `implementer` | `thinker`), local workspace tools with RTK on Bash stdout only, one vendor Model API outside the host bubble. Not a product walkthrough. `@lovrozagar/grunt` = protocol SoT + CLI (init/generate/check); not a model runtime. Do not paste `.rulesync/reference/cascade.md` here — boxes and edges only.

### Containment

Draw **one** CLI host bubble. That bubble is **this** session’s CLI: Grok Build, Claude Code, Codex, Gemini CLI, or Antigravity. The CLI **is** the host — not a peer router beside another CLI. Parent lives **inside** that host session. Children spawn **inside the same process**. Other CLIs = emit/config on disk only; no runtime hop; no shared spawn/peek line.

User-visible conversation attaches only to the parent. Children never talk to the user. Children never spawn.

### Nested diagram

Same topology as the session recap; every legal edge labeled.

```
 USER
  │
  │  session in/out  (parent only; tagged one-line recap)
  │  TUI local; completion tokens from Model API (mixed)
  ▼
┌──────────────────────── CLI HOST (this process) ────────────────────────┐
│  TUI · hooks · emit/generate · RTK PreToolUse · fs workspace            │
│                                                                         │
│  Parent orchestrator  (only spawner; spawn-first; no parent Read/Bash)  │
│    legal spawn types: grunt | implementer | thinker                     │
│    omit model on spawn; FM on agent files picks haiku/sonnet/opus       │
│    vs grok-4.5 / grok-4.6 / etc.                                        │
│                                                                         │
│         spawn / peek / resume_from                                      │
│                    │                                                    │
│                    ▼                                                    │
│         siblings (never spawn; no child→child)                          │
│    ┌───────────┬───────────────┬──────────────┐                         │
│    │   grunt   │  implementer  │   thinker    │                         │
│    │ facts/    │ specified     │ plan/deep    │                         │
│    │ tools     │ writes + TDD  │ reason       │                         │
│    │ Bash+fs   │ Write/Bash/   │ Read / need: │                         │
│    │ web/test  │ fs            │ no Bash      │                         │
│    └─────┬─────┴───────┬───────┴───────┬──────┘                         │
│          │             │               │                                │
│          └──────── tool call ──────────┘                                │
│                        │                                                │
│                        ▼                                                │
│          host tools (same process)                                      │
│            fs: Read / Grep / Glob / Write                               │
│            Bash / run_terminal_command                                  │
│                 │                                                       │
│                 └──RTK (PreToolUse; Bash/shell stdout only)──► compress │
│                                                                         │
│          local (not Model API):                                         │
│            spawn_subagent / Agent · peek                                │
│            workspace tools · RTK                                        │
│            scrub-spawn-prompt · parse-need · grunt-job                  │
│            emit / generate                                              │
│                                                                         │
│          WebSearch / web_fetch = remote-not-LLM (not a second model)    │
│          MCP = denied in-tree; do not draw as a main path               │
│                                                                         │
│          parent + children  ──completion─────────────────────────────┐  │
└──────────────────────────────────────────────────────────────────────┼──┘
                                                                       │
                                                                       ▼
                                                         Model API
                                                         (this host’s SDK
                                                         only; one box)
                                                                       ..
                                                         emit/config
                                                         (no runtime line)
                                                                       ..
                                                         other CLIs
                                                         Gemini spawn/peek
                                                         = GAP
                                                         (no fake peeks)
```

### `need:` / `resume_from`

Implementer or thinker that still needs a fat dump **stops** on a `need:` JSON line. Parent fans those jobs as **parallel grunt** siblings, then one `resume_from` with **new** `verdict:` blobs only. Max **3** `resume_from` per child id. Thinker has no Bash; facts go through this loop. Grunt does not emit `need:` for its own tool use.

```
 implementer | thinker
      │
      │  stop on JSON only (≤4 jobs/batch)
      ▼
 need: [{"job":"search|exec|web|test","query":"..."}]
      │
      │  parent parse-need  (or SubagentStop intercept
      │  when every job is search|exec)
      ▼
 parallel grunt spawns  (same host; not a new CLI)
      │
      │  isolation
      ▼
 verdict: ok|fail|empty
      │
      │  one resume_from:<child id>  + new verdicts only
      │  do not re-send original task; max 3
      ▼
 same child continues  (transcript already on resume_from)
```

### Node table

| node | inside host? | local vs AI-server | notes |
| --- | --- | --- | --- |
| User | no | mixed | Speaks only to parent session. Never a child edge. |
| Session in/out / TUI | yes | mixed | TUI is local; recap tokens come from the model. Legal `[role]:` one-line echo only. |
| CLI host process | yes (is the box) | local process | Grok Build / Claude Code / Codex / Gemini / Antigravity. Not a peer of another CLI. |
| Parent orchestrator | yes | AI-server **turn** | Spawn-first low router. No parent Read/Bash/Grep. Lives in this session, not a sidecar. |
| `grunt` sibling | yes | AI-server **turn** | Facts/tools/mechanical write. Never spawn. Never feature solution. |
| `implementer` sibling | yes | AI-server **turn** | Specified writes + TDD when tests are in the spec. Agent id is **implementer**. Never spawn. |
| `thinker` sibling | yes | AI-server **turn** | Plan/deep reason. Read-only. Named-file Read of prompt SSOT; investigate → `need:`. No Bash. Never spawn. |
| Host spawn / peek / `resume_from` | yes | **local** | `spawn_subagent` / `Agent` and host peek tools. Gemini spawn/peek = GAP; block on return, classify `done`; no fake peeks. |
| Workspace fs tools | yes | **local** | Read/Grep/Glob/Write (and host aliases). Parent is denied these except documented persist paths / `/solo`. |
| Bash / `run_terminal_command` | yes | **local** | RTK wraps stdout on PreToolUse. Thinker has no Bash. |
| RTK | yes | **local** | Bash/shell stdout compression only. Not Read/Grep/Glob/prompts/images. |
| `scrub-spawn-prompt` / `parse-need` / `grunt-job` | yes | **local** | Hooks and scripts. Isolation `verdict:` is grunt output, not a model hop. |
| emit / generate / init | yes (this repo / install) | **local** | Writes other-CLI configs. Not a runtime line to those CLIs. |
| WebSearch / web_fetch | tool from host | **remote-not-LLM** | Network search/fetch. Not a second Model API box. World facts: grunt `job: web`. |
| MCP | policy deny | n/a | Denied by policy in-tree. Do not draw as a main path. |
| Model API | **no** (one box outside) | AI-server | This host’s vendor SDK only. Parent and child **turns** complete here. Spawn omits model; frontmatter on `.rulesync/subagents/*.md` picks the model. |
| Other CLIs | no (not this process) | emit/config only | Same protocol files emitted elsewhere. No hop, no shared peek. |
| `@lovrozagar/grunt` | package / CLI | local install | Protocol SoT + CLI. Not a model runtime. |

### Edge labels

Use these labels. Do not revive “prompt input” or “agent to use”.

| edge | meaning |
| --- | --- |
| **session in/out** | User ↔ parent only. Children have no user edge. |
| **spawn** | Parent → `grunt` \| `implementer` \| `thinker`. First sentence: `You are {agent} subagent.` Omit model. |
| **peek** | Parent reads host status on the child id. Real host fields. `timeout_ms=60000`. GAP hosts: no fake peeks; block on spawn return = `done`. |
| **resume_from** | Parent continues the **same** child id with new `verdict:` blobs only. Max 3. Not a fresh spawn. |
| **need:** | Child stop line: fat dump jobs for parent to fan as grunt. Cap 4 jobs per batch. |
| **verdict:** | Grunt isolation result back onto `resume_from`. `ok\|fail\|empty`. Short facts, not dumps. |
| **tool call** | Child (or, illegally if parent, denied) → host tools. |
| **RTK** | PreToolUse Bash/shell → compressed stdout. No other tools. |
| **completion** | Parent and children → **one** Model API (this host’s SDK). |
| **emit/config** | Disk write to other CLI trees. Drawn with a broken line or footnote, **not** a session arrow. |

### What not to draw

- A **CLI Provider** box as a peer of the host, or a router that hops between CLIs at runtime
- **Thinker ↔ CLI** as a special extra channel — thinker is a sibling; tools/`need:` like the protocol
- The spelling **Implementor** — id is **implementer**
- **Per-agent Model API** boxes — one Model API outside the host, this SDK only
- **Child → child spawn** — isolation is parent fan-out of grunt siblings (or in-hook grunt-job for interceptable `search|exec` batches)
- **MCP** as a happy-path tool rail
- **RTK** on Read/Grep/Glob/prompts/images
- **User** arrows into grunt/implementer/thinker
- Gemini **fake peek** loops. GAP: no invented status API; block on return

### Emit footnote and Gemini GAP

**Emit.** `rulesync generate` plus in-tree emit scripts write Claude/Codex/Antigravity/Gemini/Grok trees from `.rulesync`. Config on disk for the **next** process of that CLI. Not a live message into another host. Multi-CLI in a diagram = footnote or a second, disconnected host bubble — never an arrow from this session.

**Gemini GAP.** Gemini is not emitted as a spawn/peek host in the cascade table. Do not invent peek or kill APIs. If a Gemini session is the host, treat spawn/peek as GAP: no fake peeks, no auto-kill; block on the host call returning and classify `done`. Other GAP rows (cascade host mapping): Claude Code unless an in-tree schema names a status/output tool; Codex peek/kill; Antigravity peek/kill.

### Protocol pointers

Repo-relative (repository root):

- `.rulesync/reference/cascade.md` — parent-only spawn, peek/kill table, `need:` / `resume_from`, isolation `verdict:`
- `.rulesync/reference/rtk.md` — Bash/shell stdout compression
- `.rulesync/reference/map.md` — cheap outline of protocol, scripts, generated trees
- `.rulesync/subagents/orchestrator.md`
- `.rulesync/subagents/grunt.md`
- `.rulesync/subagents/implementer.md`
- `.rulesync/subagents/thinker.md`

## Layout

Published (`package.json` `files`): `bin/grunt.js` `cli` `scripts/check-globals.mjs` `scripts/emit-agent-shell-tools.mjs` `scripts/emit-gemini.mjs` `scripts/emit-mcp-policy.mjs` `scripts/gate-fat-tools.mjs` `scripts/hooks-union.mjs` `scripts/grunt-job.mjs` `scripts/parse-need.mjs` `scripts/persist-handoff.mjs` `scripts/persist-plan.mjs` `scripts/purge-global-mcps.mjs` `scripts/scrub-spawn-prompt.mjs` `scripts/scrub-text-lib.mjs` `scripts/sync-global-settings.mjs` `scripts/telemetry.mjs` `scripts/browser.mjs` `scripts/doctor.mjs` `scripts/scrub-text` `.rulesync` `.grok` `.codex` `.claude` `.agents` `AGENTS.md` `CLAUDE.md` `.mcp.json` `README.md` `LICENSE`

No `scripts/*.test.ts` `scripts/fixtures/` `docs/` `coverage/` `vitest.config.ts` in `files`.

Repo root (also): `coverage/` `.gemini/` — no `src/` no `CONTRIBUTING` no `docs/`

- `bin/grunt.js` — CLI bin
- `cli/grunt.mjs` — commands
- `scripts/` — generate emits `telemetry.mjs` (re-init sentinel) `scrub-text`
- `.rulesync/` — SoT (subagents skills reference)
- `.claude/` `.grok/` `.codex/` `.agents/` `.gemini/` — host emit
- `coverage/` — vitest local not published

## Develop

Contributors to this repo only:

```
npm i && npm test
```

- Test: `vitest run --coverage`
- Test include: `scripts/**/*.test.ts` `cli/**/*.test.ts`
- Coverage include: `cli/**`
- Coverage thresholds: 100% lines / functions / branches / statements
- Dev deps include rulesync vitest typescript

## Examples

Keep these four flows only:

1. “Create me a react weather app” → thinker plan → implementer write → orchestrator recap
2. “What is 2+2” → grunt → `[grunt]:` echo
3. Marvel theatrical next → grunt `job:web` → recap
4. `.logs` 3/6/2021 tag `framework bug` → grunt local search → recap

## License

MIT © 2026 lovrozagar
