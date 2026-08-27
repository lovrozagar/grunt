# GRUNT

Building Grunt - a multi agent orchestrator workflow

# Install

Node.js 22+.

```
npm i -D @lovrozagar/grunt
npx @lovrozagar/grunt
```

Same as `npx @lovrozagar/grunt init`. Merge SoT, `npm install`, `rulesync:generate`, `sync:globals:apply`, `rulesync:check`. Do not `npm test` as a consumer.

Contributors to this repo only: local `npm i && npm test`.

# GOAL

- synced configs across all 4/5 major cli providers (grok build, claude code, codex, gemini cli, antigravity)! Emit matrix: grok/claude/codex/antigravity (`rulesync generate`) then `emit-mcp-policy` + `emit-gemini` (`GEMINI.md`, `.gemini/agents/{id}/agent.md`; MCP `.gemini/settings.json`) + `emit-agent-shell-tools` (Claude grunt body `Bash`; other hosts `run_terminal_command`). No `-t geminicli`.
- max situational speed relative to task intensity
- max free token savings:
    maximally superterse without loosing value - sacrifice grammar for sake of concision
    compression - RTK AI
    subagent re-prompt scrub - script
    cache
    context engineering
- max reasoning and effort where needed and minimal reasoning and effort where not needed
- agents:
    - orchestrator (low model, low effort) -> always spawn+prompt; never user-facing tokens except `[orchestrator]:` (or child role tag) echo. `/parent` one-turn only; `/handoff` writes `.tmp/grunt/handoffs/{serial}-{slug}-{stamp}.md` and hands the session to a fresh one.
- subagents:
    - grunt (low model, low effort) -> tools. facts/search/exec/git/web/test/low-reason mechanical write. never feature solution. never spawn.
    - implementer (medium model, medium effort) -> write already-defined solution. does not plan or invent design. never spawn.
    - thinker (high model, high effort) -> plan/deep reason. flags edge cases/pitfalls. read-only. never spawn. no bash.

# Examples

1. User - "Create me a react weather app"
    Orchestrator spawns and prompts thinker
    Thinker outputs plan to Orchestrator
    Orchestrator spawns and prompts implementer
    Implementer writes to disk, implements the app & outputs to orchestrator
    Orchestrator outputs to user

2. User - "What is 2+2"
    Orchestrator spawns and prompts Grunt
    Grunt outputs 4
    Orchestrator echoes `[grunt]:` to user

3. User - "What is the next movie Marvel cinematic universe will release to theaters"
    Orchestrator spawns and prompts Grunt
    Grunt runs a web search & outputs to orchestrator
    Orchestrator outputs to user

4. User - "In .logs folder find the log or logs on 3/6/2021 with tag 'framework bug'"
    Orchestrator spawns and prompts Grunt
    Grunt searches local folder & outputs to orchestrator
    Orchestrator outputs to user