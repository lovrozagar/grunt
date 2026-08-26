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

- synced configs across all 4/5 major cli providers (grok build, claude code, codex, gemini cli, antigravity)! Emit matrix: grok/claude/codex/antigravity (`rulesync generate`). Gemini CLI is a tracked gap (not in generate).
- max situational speed relative to task intensity
- max free token savings:
    maximally superterse without loosing value - sacrifice grammar for sake of concision
    compression - RTK AI
    subagent re-prompt scrub - script
    cache
    context engineering
- max reasoning and effort where needed and minimal reasoning and effort where not needed
- agents:
    - orchestrator (low model, low effort) -> always spawn+prompt; never user-facing tokens except `[agent]:` echo. `/parent` one-turn only.
- subagents:
    - grunt (low model, low effort) -> spawned for gruntwork where speed important but reasoning not - local or web search, monitor, poll, cron, file system operations, low-reason writes (mechanical/repetitive/obvious; volume OK), dependency management and operations, test running (run & respond superterse, instructions for raw text, rtk compression for tool calls)
    - implementor (medium model, medium effort) -> spawned for mid-reason work: feature logic, API design, non-obvious refactors, edge cases, architecture-aware code
    - thinker (high model, high effort) -> spawned for planning, reasoning, advising, weighting pros & cons, comparing alternatives. never mutates disk data only outputs instructions

# Examples

1. User - "Create me a react weather app"
    Orchestrator spawns and prompts thinker
    Tinker outputs plan to Orchestrator
    Orchestrator spawns and prompts implementor
    Implementor writes to disk, implements the app & outputs to orchestrator
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