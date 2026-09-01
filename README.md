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
- Package: `@lovrozagar/grunt` `0.4.2` MIT · https://github.com/lovrozagar/grunt

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

Rulesync schema doctor is separate: `npm run grunt:rulesync:doctor`.

## Usage

- TTY no command → menu (init default; generate check sync-globals purge-mcps doctor help quit)
- Piped / CI / `--yes` / `-y` / `--non-interactive` no command → still `init`
- Bin: `grunt` → `./bin/grunt.js` (`type: module`)

## CLI

### Commands

- `init` → `init()` — merge SoT, `npm install`, `grunt:rulesync:generate`, `grunt:sync:globals:apply`, `grunt:rulesync:check`
- `generate` → `npm run grunt:rulesync:generate`
- `check` → `npm run grunt:rulesync:check`
- `sync-globals` → `npm run grunt:sync:globals` (dry-run); `--apply` → `grunt:sync:globals:apply`
- `purge-mcps` → `npm run grunt:purge:global-mcps` (dry-run); `--apply` → `grunt:purge:global-mcps:apply`
- `doctor` → `npm run grunt:doctor` (`npx grunt doctor` / `node scripts/doctor.mjs` stay). Rulesync schema: `npm run grunt:rulesync:doctor`
- `help`
- `version`

### Flags

- `--skip-globals` — skip `sync:globals:apply` on init
- `--yes` / `-y` / `--non-interactive` — no TTY menu; default command still `init`. Not `--apply`
- `--apply` — write for `sync-globals` / `purge-mcps`
- `--host <id>` — `sync-globals --host <id>`

## Init

- Merge SoT `npm install` `grunt:rulesync:generate` `grunt:sync:globals:apply` `grunt:rulesync:check`
- `--skip-globals` skips apply
- Re-init auto-skips globals when `<!-- grunt:begin -->` in `AGENTS.md`/`CLAUDE.md`
- First init (no sentinel) applies globals unless flagged
- Owned trees/scripts refresh; extra `.rulesync` files kept; patches to grunt-owned files lost
- Breaking: consumer npm scripts are `grunt:<SoT-key>` (`grunt:rulesync:generate`, `grunt:doctor`). Re-init migrates `package.json` (owned unprefixed keys + suffixes; `npm run` refs in other dest scripts). CI/husky/`npm run rulesync:*` / `npm run doctor` must switch. No aliases. SoT repo scripts stay unprefixed (`npm run rulesync:generate`).

## Version bump

```
npm i -D @lovrozagar/grunt@latest && npx @lovrozagar/grunt init
```

- Same re-init / globals rules as Init

## Agents

SoT: `.rulesync/subagents/{orchestrator grunt implementer thinker}.md`

Emit: `.claude/` `.grok/` `.agents/` `.gemini/`

- **orchestrator** (parent) — always spawn+prompt; user-facing `[orchestrator]:` (or child role tag) one-line recap; advise leftover numbered pick each on own line after that recap; one empty blank line immediately before leftover 1. (leftover last; not adjacent to recap/body) — do not cram `1. Implementer with verbal plan 2. Implementer with file plan 3. Tweak` onto the recap line. `/parent` one-turn; `/handoff` writes `.tmp/grunt/handoffs/{serial}-{slug}-{stamp}.md`; `/tmp` writes `.tmp/grunt/{serial}-{slug}-{stamp}.{ext}`; `/pickup` spawn-first pickup (inverse of `/handoff`; not a mode). `/solo` session escape; `/cascade` restores it. Small/low router. First token spawn. No parent Read/Bash/Grep. Does not implement, plan, or fetch world facts
- **grunt** — tools: facts/search/exec/git/web/test/low-reason mechanical write. Isolation `verdict:`. Never feature solution. Never spawn. Snippet/cite/"what is X"/world fact: `job: web`. URL/browse/click/fill/snap/live DOM: browser rail (`node scripts/browser.mjs`; Lightpanda default); child prompt includes `.rulesync/skills/browser/SKILL.md` + `.rulesync/reference/browser.md`; never websearch that page. URL-in-a-cite ≠ browse. No `job:browse`; parent does not Skill-invoke `browser`
- **implementer** — write already-defined solution on allowlisted paths. TDD when spec/plan says tests. Validate + sim after write. Fat dumps via `need:`. Never spawn. Never plan. Id is **implementer** (not Implementor)
- **thinker** — think/plan/advise/recommend/how/why/explain; unsure→thinker; cheap false+; edge cases. Read-only named-file Read of prompt SSOT; trees/search/exec/web/test → `need:`. Never spawn. No bash. Never implement

Children never spawn. Spawn only grunt|implementer|thinker. Omit model on spawn; frontmatter on agent files picks haiku/sonnet/opus vs grok-4.5 / grok-4.6 / other hosts. Voice: `.rulesync/reference/output.md`. Protocol: `.rulesync/reference/cascade.md`. `AGENTS.md`/`CLAUDE.md` spawn-first. `GEMINI.md` → `@AGENTS.md`. Goals: synced configs across grok build claude code codex gemini cli antigravity; max situational speed; superterse token savings; max/min reasoning by role.

## Browser

Lightpanda-first session CLI: `node scripts/browser.mjs nav|snap|click|fill|shot|pdf|stop|doctor|ensure`. Zero MCP. Zero env knobs. Chromium only for `shot`/`pdf`/`trace`, Windows, missing Lightpanda, one probe-fail replay, or paint hosts. Session: `.tmp/grunt/browser/`. Spec: [`.rulesync/reference/browser.md`](.rulesync/reference/browser.md). Parent routes URL/browse/click/fill/snap/live DOM to grunt (paste skill+browser.md abs paths; never Skill-invoke `browser`; no `job:browse`). URL-in-a-cite ≠ browse.

`node scripts/browser.mjs doctor` (alias `ensure`) runs the unified doctor (`scripts/doctor.mjs`). Install engines: [Prerequisites](#prerequisites).

## Skills

Present under `.claude` / `.rulesync` / `.agents` / `.grok` (`rulesync -f skills` mirrors SSOT):

- `browser` `cascade` `commit` `commit-and-push` (1-release alias → `commit-push`) `commit-push` `commit-push-deploy` `commit-push-release` `explain` `handoff` `pickup` `parent` `solo` `tmp` `write-plan` `implement-plan`

Reserved names: do not reuse those stems for consumer custom skills. Same name → one SSOT under `.rulesync/skills/<name>/`; re-init force-refresh overwrites grunt-owned names; extras kept; maps `origin` badge ≠ content picker. See `.rulesync/reference/law.md` (flows into INDEX).

`/write-plan` and `/implement-plan` SSOT: `.rulesync/skills/{write-plan,implement-plan}/`; format SSOT `.rulesync/reference/plan-format.md`. `/write-plan` plan-only inspect-pause → `next: /implement-plan {n}`; empty `/implement-plan` resumes unique in-progress or starts unique ready, else lists (need serial); leftover pick **2. Implementer with file plan** = persist then implement one-shot skip pause; leftover pick **1. Implementer with verbal plan** / explicit implement = verbal spec no plan file; slash `/implement-plan {n}` disk/file ≠ verbal; not `ok`/`yes`/`go`

## Generate

SoT: `.rulesync/skills` + `.rulesync/reference`. Generate maps anything placed there. `.agents` / `.claude` (and other host trees) are mirrors, not SoT; no mirror scan.

Pipeline (no `-t geminicli`):

1. `rulesync generate` — emit grok / claude / codex / antigravity
2. `emit-mcp-policy.mjs`
3. `emit-gemini.mjs` — `GEMINI.md` `.gemini/agents/{id}/agent.md` MCP `.gemini/settings.json`
4. `emit-agent-shell-tools` — Claude grunt body `Bash`; other hosts `run_terminal_command` (hooks-union)

`check` = rulesync check. `doctor` = unified prereqs. Schema: `npm run rulesync:doctor`.

Emit writes other-CLI trees from `.rulesync` for the **next** process of that CLI. Not a live hop into another host.

## Config

- SoT merge into consumer repo; existing configs kept where not grunt-owned
- Globals: first init apply; re-init auto-skip (sentinel) or `--skip-globals`
- `sync-globals` / `purge-mcps`: dry-run default; `--apply` writes
- Hosts: grok claude codex gemini antigravity

## Architecture

Protocol picture: one CLI host process, parent-only orchestrator in that session, three sibling spawn types (`grunt` | `implementer` | `thinker`), local workspace tools with RTK on Bash stdout only, one vendor Model API outside the host bubble. Not a product walkthrough. `@lovrozagar/grunt` = protocol SoT + CLI (init/generate/check); not a model runtime. Do not paste `.rulesync/reference/cascade.md` here — boxes and edges only.

### Containment

Draw **one** CLI host bubble. That bubble is **this** session’s CLI: Grok Build, Claude Code, Codex, Gemini CLI, or Antigravity. The CLI **is** the host — not a peer router beside another CLI. Parent lives **inside** that host session. Children spawn **inside the same process**. Other CLIs = emit/config on disk only; no runtime hop; no shared spawn/peek line.

User-visible conversation attaches only to the parent. Children never talk to the user. Children never spawn.

### Host support (GAP)

Not feature-parity across hosts. In-tree mapping only; do not invent peek/kill APIs. GAP rows: no fake peeks, no auto-kill; block on spawn return and classify `done`.

| Host | Spawn | Peek | Kill |
| --- | --- | --- | --- |
| Grok | `spawn_subagent` `background:true` → `task_id` | `get_command_or_subagent_output` + `timeout_ms=60000` | `kill_command_or_subagent` (user-ask only) |
| Claude Code | `Agent` if the parent session exposes it | GAP unless an in-tree schema names a status/output tool on that id (do not invent `TaskOutput`); else block on Agent return and classify `done`. Agent launch ≠ child done; in-flight host Stop → only `[orchestrator]: wait grunt`; no SendMessage | GAP unless in-tree; no auto-kill |
| Codex | host agent/call | GAP; block on host agent/call return; classify `done` | GAP; no auto-kill |
| Antigravity | main-session parent | GAP peek/kill; main-session parent | GAP; no auto-kill |
| Gemini | not emitted; tracked gap | GAP; no fake peeks | GAP; no auto-kill |

### Nested diagram

Same topology as the session recap; every legal edge labeled.

```
 USER
  │
  │  session in/out  (parent only; tagged one-line recap; advise leftover blank then 1./2./3. own lines)
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
| Session in/out / TUI | yes | mixed | TUI is local; recap tokens come from the model. Legal `[role]:` one-line recap; advise leftover numbered pick each on own line after; one empty blank line immediately before leftover 1. (not crammed onto the recap line). |
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
| WebSearch / web_fetch | tool from host | **remote-not-LLM** | Network search/fetch. Not a second Model API box. Snippet/cite/"what is X"/world fact: grunt `job: web`. Live URL/DOM: grunt browser rail, not this box. |
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

- `.rulesync/reference/INDEX.md` — aggregate catalog composed from slices (law.md, skills-map.md, refs-map.md). Maps/law = slices for deep dive. Always. Not if-maps-else
- `.rulesync/reference/law.md` — domain law stub (protocol stays cascade/overview)
- `.rulesync/reference/cascade.md` — parent-only spawn, peek/kill table, `need:` / `resume_from`, isolation `verdict:`
- `.rulesync/reference/rtk.md` — Bash/shell stdout compression
- `.rulesync/reference/map.md` — cheap outline of protocol, scripts, generated trees
- `.rulesync/subagents/orchestrator.md`
- `.rulesync/subagents/grunt.md`
- `.rulesync/subagents/implementer.md`
- `.rulesync/subagents/thinker.md`

## Layout

Published (`package.json` `files`): `bin/grunt.js` `cli` `scripts/check-globals.mjs` `scripts/emit-agent-shell-tools.mjs` `scripts/emit-gemini.mjs` `scripts/guarded-roots.mjs` `scripts/emit-mcp-policy.mjs` `scripts/gate-fat-tools.mjs` `scripts/hooks-union.mjs` `scripts/pipeline.mjs` `scripts/grunt-job.mjs` `scripts/parse-need.mjs` `scripts/persist-handoff.mjs` `scripts/persist-tmp.mjs` `scripts/persist-plan.mjs` `scripts/purge-global-mcps.mjs` `scripts/scrub-spawn-prompt.mjs` `scripts/scrub-text-lib.mjs` `scripts/sync-global-settings.mjs` `scripts/browser.mjs` `scripts/doctor.mjs` `scripts/scrub-text` `.rulesync` `.grok` `.codex` `.claude` `.agents` `AGENTS.md` `CLAUDE.md` `.mcp.json` `README.md` `LICENSE` `CHANGELOG.md`

No `scripts/*.test.ts` `scripts/fixtures/` `docs/` `coverage/` `vitest.config.ts` in `files`. `cli` dir ships whole (includes `cli/*.test.ts`).

Not packed: `GEMINI.md` `.gemini/` — `emit-gemini.mjs` writes them on `generate` / `init` (`GEMINI.md` → `@AGENTS.md`). Not in `files`.

Repo root (also): `coverage/` `.gemini/` `GEMINI.md` — no `src/` no `CONTRIBUTING` no `docs/`

- `bin/grunt.js` — CLI bin
- `cli/grunt.mjs` — commands
- `scripts/` — init copies product scripts (`grunt-job.mjs` `scrub-text` …). Re-init sentinels: `.grok/hooks/orchestrate-parent.js` `.rulesync` `<!-- grunt:begin -->`
- `.rulesync/` — SoT (subagents skills reference). Skills + reference maps on generate; host trees are mirrors
- `.claude/` `.grok/` `.codex/` `.agents/` `.gemini/` — host emit; not SoT; no mirror scan
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

1. “Create me a react weather app” → thinker plan/recap-stop + pick 1.Implementer with verbal plan 2.Implementer with file plan 3.Tweak → user picks 1 (verbal spec) or 2 (file plan one-shot) or `/implement-plan {n}` → implementer write → recap
2. “What is 2+2” → grunt → `[grunt]:` echo
3. Marvel theatrical next → grunt `job:web` → recap
4. `.logs` 3/6/2021 tag `framework bug` → grunt local search → recap

## License

MIT © 2026 lovrozagar
