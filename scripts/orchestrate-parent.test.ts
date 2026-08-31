import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DENY_REASON,
  ORCHESTRATOR_LOGS_DIR,
  STOP_REASONS,
  isAllowedParentGruntJob,
} from "../.grok/hooks/orchestrate-parent.js";
import { VALID_HANDOFF } from "./persist-handoff.test.ts";
import { VALID_THINKER } from "./persist-plan.test.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const orchParent = path.join(root, ".grok/hooks/orchestrate-parent.js");

function runHook(
  payload: unknown,
  env: NodeJS.ProcessEnv = {},
) {
  return spawnSync(process.execPath, [orchParent], {
    encoding: "utf8",
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd: root,
    env: { ...process.env, ...env },
    timeout: 10_000,
  });
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-parent-"));
  tmpDirs.push(dir);
  return dir;
}

const implMsg = "```js\nconst x = 1;\n```\nwrite file src/x.ts";

describe("orchestrate-parent Stop", () => {
  it("blocks cheap trivia", () => {
    const ws = workspace();
    for (const [sid, msg] of [
      ["s1", "Yes. HTTP is a request/response protocol."],
      ["s1b", "4"],
    ] as const) {
      const result = runHook(
        {
          hookEventName: "Stop",
          reason: "end_turn",
          lastAssistantMessage: msg,
          workspaceRoot: ws,
          sessionId: sid,
        },
        { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).decision).toBe("block");
    }
  });

  it("blocks 2+2 and long definitions that are not recap", () => {
    const ws = workspace();
    const msg =
      "An orchestrator is the parent session. It answers trivia, does tiny lookups, and spawns children. It does not implement features in-session even when the user asks for a multi-file change, because that work belongs to implementer.";
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: msg,
        workspaceRoot: ws,
        sessionId: "s2",
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "s2" },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("blocks implementation-like messages until MAX_STOP=3 then fail-open", () => {
    const ws = workspace();
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "s3",
    };
    const payload = {
      hookEventName: "Stop",
      reason: "end_turn",
      lastAssistantMessage: implMsg,
      workspaceRoot: ws,
      sessionId: "s3",
    };
    for (let i = 0; i < 3; i++) {
      const blocked = runHook(payload, env);
      expect(blocked.status).toBe(0);
      const json = JSON.parse(blocked.stdout);
      expect(json.decision).toBe("block");
    }
    const open = runHook(payload, env);
    expect(open.status).toBe(0);
    expect(open.stdout).toBe("");
  });

  it("blocks fenced implementation even when a spawn stamp exists", () => {
    const ws = workspace();
    fs.mkdirSync(path.join(ws, ORCHESTRATOR_LOGS_DIR), { recursive: true });
    fs.writeFileSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "tools-used-s4"), "1");
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: implMsg,
        workspaceRoot: ws,
        sessionId: "s4",
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "s4" },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("allows recap prefix even with a fence", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[implementer]: shipped\n```js\nconst x = 1;\n```\n",
        workspaceRoot: ws,
        sessionId: "s-recap",
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "s-recap" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("allows a [handoff]: recap", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage:
          "[handoff]: serial=1 path=.tmp/grunt/handoffs/1-x-20260827T143000Z.md\nnext: start a new session; first action = spawn grunt|implementer with abs path=.tmp/grunt/handoffs/1-x-20260827T143000Z.md\n",
        workspaceRoot: ws,
        sessionId: "s-handoff",
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "s-handoff" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("allows [orchestrator]: recap", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: child done",
        workspaceRoot: ws,
        sessionId: "s-orch-recap",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-orch-recap",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("allows role tags [grunt]: [implementer]: [thinker]: [handoff]:", () => {
    const ws = workspace();
    for (const tag of ["grunt", "implementer", "thinker", "handoff"] as const) {
      const sid = `s-role-${tag}`;
      const result = runHook(
        {
          hookEventName: "Stop",
          reason: "end_turn",
          lastAssistantMessage: `[${tag}]: ok`,
          workspaceRoot: ws,
          sessionId: sid,
        },
        { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
    }
  });

  it("blocks [agent]: recap", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[agent]: child done",
        workspaceRoot: ws,
        sessionId: "s-agent-recap",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-agent-recap",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("blocks illegal recap tags and wait-prose", () => {
    const ws = workspace();
    const msgs = [
      "[agent]: child done",
      "[grunt done]",
      "[implementer done]",
      "[[agent] done]",
      "waiting for grunt",
      "wait grunt",
    ];
    msgs.forEach((msg, i) => {
      const sid = `s-illegal-recap-${i}`;
      const result = runHook(
        {
          hookEventName: "Stop",
          reason: "end_turn",
          lastAssistantMessage: msg,
          workspaceRoot: ws,
          sessionId: sid,
        },
        { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).decision).toBe("block");
    });
  });

  it("blocks recap when the tag is not the first line", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "shipped the change\n[orchestrator]: done",
        workspaceRoot: ws,
        sessionId: "s-recap-later",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        SESSION_ID: "s-recap-later",
        GROK_SESSION_ID: "s-recap-later",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("allows last_assistant_message snake_case recap", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        last_assistant_message: "[orchestrator]: snake",
        workspaceRoot: ws,
        sessionId: "s-snake-msg",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-snake-msg",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("transcript-only [orchestrator]: allows when payload is empty", () => {
    const ws = workspace();
    const tp = path.join(ws, "transcript.jsonl");
    fs.writeFileSync(
      tp,
      [
        JSON.stringify({
          type: "user",
          message: { role: "user", content: "hi" },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [{ type: "tool_use", id: "1", name: "Agent", input: {} }],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "[orchestrator]: from transcript" }] },
        }),
      ].join("\n") + "\n",
    );
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        workspaceRoot: ws,
        sessionId: "s-tr-only",
        transcript_path: tp,
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-tr-only",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("payload [agent]: wins over transcript [orchestrator]:", () => {
    const ws = workspace();
    const tp = path.join(ws, "transcript.jsonl");
    fs.writeFileSync(
      tp,
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "[orchestrator]: from transcript" }] },
      }) + "\n",
    );
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[agent]: payload",
        workspaceRoot: ws,
        sessionId: "s-payload-wins",
        transcriptPath: tp,
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-payload-wins",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("STOP_REASONS are 3 unique strings without /handoff or [agent]:", () => {
    const ws = workspace();
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "s-reasons",
    };
    const payload = {
      hookEventName: "Stop",
      reason: "end_turn",
      lastAssistantMessage: implMsg,
      workspaceRoot: ws,
      sessionId: "s-reasons",
    };
    const reasons: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = runHook(payload, env);
      const json = JSON.parse(result.stdout);
      expect(json.decision).toBe("block");
      expect(json.reason.length).toBeLessThan(600);
      expect(json.reason).not.toMatch(/\/handoff/);
      expect(json.reason).not.toMatch(/\[agent\]:/);
      expect(json.reason).not.toMatch(/XOR/);
      expect(json.reason).toMatch(/⚠/);
      expect(json.reason).toMatch(/validate/);
      expect(json.reason).toMatch(/sim/);
      expect(json.reason).toMatch(/spawn implementer/);
      expect(json.reason).toMatch(/writes remain/);
      expect(json.reason).toMatch(/\[orchestrator\]:/);
      expect(json.reason).not.toMatch(/do not recap done/);
      expect(json.reason).not.toMatch(/do not recap; spawn/);
      expect(json.reason).not.toMatch(/do not glue done into the tag/);
      expect(json.reason).not.toMatch(/Violation:/);
      expect(json.reason).not.toMatch(/DO NOT stop/);
      expect(json.reason).not.toMatch(/\[grunt done\]/);
      expect(json.reason).not.toMatch(/\[\[agent\] done\]/);
      expect(json.reason).not.toMatch(/Illegal:/);
      expect(json.reason).not.toMatch(
        /`\[grunt\]:`[\s\S]*`\[implementer\]:`[\s\S]*`\[thinker\]:`[\s\S]*`\[handoff\]:`/,
      );
      reasons.push(json.reason);
    }
    expect(new Set(reasons).size).toBe(3);
    expect(reasons[0]).toMatch(/^Spawn:/);
    expect(reasons[1]).toMatch(/^Still spawn:/);
    expect(reasons[2]).toMatch(/^Last spawn:/);
  });

  it("allows tagged recap plus advise leftover numbered pick", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage:
          "[orchestrator]: advise stop\n1. Implement\n2. Tweak",
        workspaceRoot: ws,
        sessionId: "s-advise-leftover",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-advise-leftover",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("blocks [orchestrator]: wait grunt with leftover lines", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage:
          "[orchestrator]: wait grunt\n1. Implement\n2. Tweak",
        workspaceRoot: ws,
        sessionId: "s-wait-leftover",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-wait-leftover",
      },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe("block");
  });

  it("parent SSOT un-cramps advise 1./2. onto own lines", () => {
    const files = [
      ".rulesync/reference/output.md",
      ".rulesync/reference/cascade.md",
      ".rulesync/subagents/orchestrator.md",
      ".rulesync/rules/overview.md",
      ".rulesync/rules/CLAUDE.md",
    ];
    for (const rel of files) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      expect(text).not.toMatch(/Advise finals: 1\. Implement 2\. Tweak/);
      expect(text).not.toMatch(
        /Advise finals end with numbered pick: 1\. Implement 2\. Tweak/,
      );
      expect(text).toMatch(/1\. Implement\n2\. Tweak/);
    }
  });

  it("allows [orchestrator]: wait grunt", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: wait grunt",
        workspaceRoot: ws,
        sessionId: "s-wait-grunt",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-wait-grunt",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("STOP_REASONS and parent SSOT omit Illegal anti-example strings", () => {
    const files = [
      path.join(root, ".rulesync/reference/cascade.md"),
      path.join(root, ".rulesync/reference/hooks.md"),
      path.join(root, ".rulesync/subagents/orchestrator.md"),
      path.join(root, ".rulesync/rules/overview.md"),
      path.join(root, ".rulesync/rules/CLAUDE.md"),
    ];
    const text = [
      STOP_REASONS.join("\n"),
      ...files.map((f) => fs.readFileSync(f, "utf8")),
    ].join("\n");
    expect(text).not.toMatch(/Illegal:.*\[grunt done\]/);
    expect(text).not.toMatch(/\[grunt done\]/);
    expect(text).not.toMatch(/\[\[agent\] done\]/);
    const recapSsot = [
      STOP_REASONS.join("\n"),
      fs.readFileSync(path.join(root, ".rulesync/reference/cascade.md"), "utf8"),
      fs.readFileSync(path.join(root, ".rulesync/reference/hooks.md"), "utf8"),
    ].join("\n");
    expect(recapSsot).not.toMatch(/Illegal:/);
  });

  function fmTools(text: string): string[] {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return [];
    const fm = m[1];
    const yamlList = fm.match(/^tools:\r?\n((?:[ \t]*-[ \t]+\S+\r?\n?)+)/m);
    if (yamlList) {
      return [...yamlList[1].matchAll(/-[ \t]+(\S+)/g)].map((x) => x[1]);
    }
    const inline = fm.match(/^tools:\s*\[([^\]]*)\]/m);
    if (inline) {
      return inline[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const csv = fm.match(/^tools:\s*(.+)$/m);
    if (!csv) return [];
    return csv[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const FIRST_TOKEN =
    "You do not talk. First token = spawn. Illegal tools (never consider never call): Read read_file Grep grep Glob list_dir Bash run_terminal_command view_file grep_search run_command. Not in toolkit. Hook deny = backstop not UX. Next=spawn not retry.";

  it("orchestrator host YAML is spawn/write/todo/peek allowlist only", () => {
    const claude = fs.readFileSync(
      path.join(root, ".claude/agents/orchestrator.md"),
      "utf8",
    );
    expect(fmTools(claude)).toEqual(["Write", "Agent"]);
    expect(claude).not.toMatch(/^- (Read|Grep|Glob|Bash)$/m);

    const grok = fs.readFileSync(path.join(root, ".grok/agents/orchestrator.md"), "utf8");
    const grokTools = fmTools(grok);
    expect(grokTools).toEqual([
      "spawn_subagent",
      "write",
      "todo_write",
      "get_command_or_subagent_output",
      "kill_command_or_subagent",
    ]);
    for (const banned of ["read_file", "grep", "list_dir", "run_terminal_command"]) {
      expect(grokTools).not.toContain(banned);
    }

    const ag = fs.readFileSync(path.join(root, ".agents/agents/orchestrator.md"), "utf8");
    const agTools = fmTools(ag);
    for (const banned of ["view_file", "grep_search", "run_command"]) {
      expect(agTools).not.toContain(banned);
    }
  });

  it("parent prompts drop deny-expected-if-forgotten; keep first-token + screenshot explain", () => {
    for (const rel of [
      ".rulesync/subagents/orchestrator.md",
      ".rulesync/rules/overview.md",
      ".rulesync/rules/CLAUDE.md",
    ]) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      expect(text).toContain(FIRST_TOKEN);
      expect(text).not.toMatch(/deny expected if forgotten/);
      expect(text).toMatch(
        /`\/explain` \| spawn if facts\/work; then human recap of child output; screenshot\/visible=context no Read/,
      );
      expect(text).toMatch(
        /`\/pickup` \| spawn-first; grunt resolve if needed; never parent Read; not a mode/,
      );
      expect(text).not.toMatch(/resume-handoff/);
    }
    const explain = fs.readFileSync(
      path.join(root, ".rulesync/skills/explain/SKILL.md"),
      "utf8",
    );
    expect(explain).toMatch(
      /First action = spawn grunt\|implementer\|thinker\s+if facts\/work/,
    );
    expect(explain).not.toMatch(/Deny `First action=spawn/);
    expect(explain).toMatch(/Screenshot\/image is already in the prompt/);
    expect(explain).not.toMatch(/if you Read first/);
  });

  it("Stop hook feedback does not unlink stop-block; normal prompt does", () => {
    const ws = workspace();
    const sid = "s-stop-fb";
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: sid,
    };
    const payload = {
      hookEventName: "Stop",
      reason: "end_turn",
      lastAssistantMessage: implMsg,
      workspaceRoot: ws,
      sessionId: sid,
    };
    const first = runHook(payload, env);
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout).reason).toMatch(/^Spawn:/);
    const stopStamp = path.join(ws, ORCHESTRATOR_LOGS_DIR, `stop-block-${sid}`);
    expect(fs.existsSync(stopStamp)).toBe(true);
    const toolsUsed = path.join(ws, ORCHESTRATOR_LOGS_DIR, `tools-used-${sid}`);
    fs.mkdirSync(path.dirname(toolsUsed), { recursive: true });
    fs.writeFileSync(toolsUsed, "1");
    const feedback = runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "Stop hook feedback: spawn implementer",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    expect(feedback.status).toBe(0);
    expect(fs.existsSync(stopStamp)).toBe(true);
    expect(fs.existsSync(toolsUsed)).toBe(false);
    const blockedBanner = runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt:
          "Blocked by stop hook 'project/settings:subagent_stop[0].hooks[0]'",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    expect(blockedBanner.status).toBe(0);
    expect(fs.existsSync(stopStamp)).toBe(true);
    const second = runHook(payload, env);
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout).reason).toMatch(/^Still spawn:/);
    const last = runHook(payload, env);
    expect(last.status).toBe(0);
    expect(JSON.parse(last.stdout).reason).toMatch(/^Last spawn:/);
    const later = runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "keep going",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    expect(later.status).toBe(0);
    expect(fs.existsSync(stopStamp)).toBe(false);
    const again = runHook(payload, env);
    expect(again.status).toBe(0);
    expect(JSON.parse(again.stdout).reason).toMatch(/^Spawn:/);
  });

  it("parent-stop recap allows; missing recap blocks; stop_hook_active fail-open", () => {
    const ws = workspace();
    const ok = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: ok",
        workspaceRoot: ws,
        sessionId: "s-stop-ok",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-stop-ok",
      },
    );
    expect(ok.status).toBe(0);
    expect(ok.stdout).toBe("");
    const blocked = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "no recap here",
        workspaceRoot: ws,
        sessionId: "s-stop-block",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-stop-block",
      },
    );
    expect(blocked.status).toBe(0);
    expect(JSON.parse(blocked.stdout).decision).toBe("block");
    const sha = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        stop_hook_active: true,
        lastAssistantMessage: "no recap here",
        workspaceRoot: ws,
        sessionId: "s-stop-sha",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-stop-sha",
      },
    );
    expect(sha.status).toBe(0);
    expect(sha.stdout).toBe("");
  });

  it("handoff skill ships to every host from one SSOT", () => {
    const ssot = fs.readFileSync(
      path.join(root, ".rulesync/skills/handoff/SKILL.md"),
      "utf8",
    );
    expect(ssot).toMatch(/\.tmp\/grunt\/handoffs\//);
    expect(ssot).toMatch(/\[handoff\]: serial=/);
    for (const rel of [
      ".grok/skills/handoff/SKILL.md",
      ".claude/skills/handoff/SKILL.md",
      ".agents/skills/handoff/SKILL.md",
    ]) {
      expect(fs.readFileSync(path.join(root, rel), "utf8")).toBe(ssot);
    }
    expect(ssot).toMatch(/`\/pickup \{serial\}`/);
    expect(ssot).not.toMatch(/resume-handoff/);
  });

  it("pickup skill ships to every host from one SSOT", () => {
    const ssot = fs.readFileSync(
      path.join(root, ".rulesync/skills/pickup/SKILL.md"),
      "utf8",
    );
    expect(ssot).toMatch(/^name: pickup$/m);
    expect(ssot).toMatch(/\/pickup/);
    expect(ssot).toMatch(/Inverse of \/handoff/);
    expect(ssot).not.toMatch(/resume-handoff/);
    for (const rel of [
      ".grok/skills/pickup/SKILL.md",
      ".claude/skills/pickup/SKILL.md",
      ".agents/skills/pickup/SKILL.md",
    ]) {
      expect(fs.readFileSync(path.join(root, rel), "utf8")).toBe(ssot);
    }
  });

  it("parent skill documents one-turn escape", () => {
    const ssot = fs.readFileSync(
      path.join(root, ".rulesync/skills/parent/SKILL.md"),
      "utf8",
    );
    const grok = fs.readFileSync(
      path.join(root, ".grok/skills/parent/SKILL.md"),
      "utf8",
    );
    expect(ssot).toMatch(/\/parent/);
    expect(ssot).toMatch(/parent-escape-\{sid\}/);
    expect(ssot).toMatch(/Never parent Read\/Bash/);
    expect(ssot).toMatch(/last-ditch/);
    expect(ssot).not.toMatch(/must complete in-parent/);
    expect(ssot).not.toMatch(/parent may finish in-session/);
    expect(grok).toBe(ssot);
  });

  it("parent-escape stamp allows once then blocks", () => {
    const ws = workspace();
    const submit = runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "/parent ship it",
        workspaceRoot: ws,
        sessionId: "pe1",
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "pe1",
      },
    );
    expect(submit.status).toBe(0);
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "parent-escape-pe1")),
    ).toBe(true);
    const payload = {
      hookEventName: "Stop",
      reason: "end_turn",
      lastAssistantMessage: implMsg,
      workspaceRoot: ws,
      sessionId: "pe1",
    };
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "pe1",
    };
    const allowed = runHook(payload, env);
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toBe("");
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "parent-escape-pe1")),
    ).toBe(false);
    const blocked = runHook(payload, env);
    expect(JSON.parse(blocked.stdout).decision).toBe("block");
  });

  it("no-ops child Stop", () => {
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        subagentType: "implementer",
        lastAssistantMessage: implMsg,
      },
      { GROK_HOOK_EVENT: "stop" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("orchestrate-parent regression: defects 1-5", () => {
  it("stampPath resolves via data.cwd when workspaceRoot/GROK_WORKSPACE_ROOT are absent (defect 1)", () => {
    const ws = workspace();
    const env: NodeJS.ProcessEnv = { GROK_HOOK_EVENT: "post_tool_use", GROK_SESSION_ID: "cwd-only" };
    const result = runHook(
      {
        hookEventName: "PostToolUse",
        cwd: ws,
        sessionId: "cwd-only",
      },
      env,
    );
    expect(result.status).toBe(0);
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "tools-used-cwd-only")),
    ).toBe(true);
  });

  it("stop_hook_active short-circuits before any stamp write (defect 2)", () => {
    const ws = workspace();
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "sha1",
    };
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        stop_hook_active: true,
        lastAssistantMessage: implMsg,
        workspaceRoot: ws,
        sessionId: "sha1",
      },
      env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "stop-block-sha1")),
    ).toBe(false);
  });

  it("recap matches with leading backtick, asterisk, blockquote, or leading blank line (defect 3)", () => {
    const ws = workspace();
    const variants = [
      "`[implementer]: shipped",
      "*[grunt]: done",
      "> [thinker]: planned",
      "\n\n[handoff]: serial=1 path=.tmp/grunt/handoffs/1-x-20260827T143000Z.md",
    ];
    variants.forEach((msg, i) => {
      const sid = `recap-variant-${i}`;
      const result = runHook(
        {
          hookEventName: "Stop",
          reason: "end_turn",
          lastAssistantMessage: msg,
          workspaceRoot: ws,
          sessionId: sid,
        },
        { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
    });
  });

  it("STOP_REASON differs across attempts 1/2/3 (defect 4)", () => {
    const ws = workspace();
    const env = {
      GROK_HOOK_EVENT: "stop",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "escalate",
    };
    const payload = {
      hookEventName: "Stop",
      reason: "end_turn",
      lastAssistantMessage: implMsg,
      workspaceRoot: ws,
      sessionId: "escalate",
    };
    const reasons: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = runHook(payload, env);
      expect(result.status).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.decision).toBe("block");
      expect(json.reason.length).toBeLessThan(600);
      reasons.push(json.reason);
    }
    expect(new Set(reasons).size).toBe(3);
  });

  it("interceptNeed output contains the payload exactly once (defect 5)", () => {
    const ws = workspace();
    fs.writeFileSync(path.join(ws, "hit.txt"), "single-emit-token-abc\n");
    const need =
      'need: [{"job":"search","query":"single-emit-token-abc"}]';
    const result = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "implementer",
        lastAssistantMessage: need,
        workspaceRoot: ws,
        sessionId: "single-emit",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "single-emit",
      },
    );
    expect(result.status).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.reason).toBeUndefined();
    expect(json.hookSpecificOutput.additionalContext).toContain(
      "single-emit-token-abc",
    );
    const occurrences = (
      result.stdout.match(/single-emit-token-abc/g) || []
    ).length;
    expect(occurrences).toBe(1);
  });
});

describe("orchestrate-parent parent write", () => {
  it("allows .tmp/plans/ write and rewrites serial path", () => {
    const ws = workspace();
    const dest = path.join(ws, ".tmp/plans/draft.md");
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: { file_path: dest, content: VALID_THINKER },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.hookSpecificOutput.updatedInput.file_path).toMatch(
      new RegExp(
        `${path.join(ws, ".tmp/plans/1-add-tmp-ignore-").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{8}T\\d{6}Z\\.md$`,
      ),
    );
    expect(out.hookSpecificOutput.updatedInput.content).toMatch(/^---\nserial: 1\n/);
    expect(out.hookSpecificOutput.updatedInput.content).toMatch(
      /^created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m,
    );
    expect(out.decision).toBeUndefined();
  });

  it("denies src/ write", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: path.join(ws, "src/index.ts"),
          content: "export {}\n",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
  });

  it("allows .tmp/grunt/handoffs/ write and rewrites serial path", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: path.join(ws, ".tmp/grunt/handoffs/draft.md"),
          content: VALID_HANDOFF,
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.hookSpecificOutput.updatedInput.file_path).toMatch(
      new RegExp(
        `${path
          .join(ws, ".tmp/grunt/handoffs/1-sync-skills-to-hosts-")
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{8}T\\d{6}Z\\.md$`,
      ),
    );
    expect(out.hookSpecificOutput.updatedInput.content).toMatch(
      /^---\nserial: 1\nname: sync-skills-to-hosts\nstatus: open\n/,
    );
    expect(out.decision).toBeUndefined();
  });

  it("denies invalid handoff under .tmp/grunt/handoffs/", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: path.join(ws, ".tmp/grunt/handoffs/bad.md"),
          content: "HANDOFF_NAME: bad\n\n# bad\n\nnope\n",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
  });

  it("denies grunt scratch write outside handoffs", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: path.join(ws, ".tmp/grunt/notes.md"),
          content: VALID_HANDOFF,
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
  });

  it("rewrites outside-ws scratch Write into workspace before handoff/plans check", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: "/tmp/host/.tmp/grunt/handoffs/draft.md",
          content: VALID_HANDOFF,
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBeUndefined();
    expect(out.hookSpecificOutput.updatedInput.file_path).toMatch(
      new RegExp(
        `${path
          .join(ws, ".tmp/grunt/handoffs/1-sync-skills-to-hosts-")
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{8}T\\d{6}Z\\.md$`,
      ),
    );
  });

  it("does not rewrite escaping scratch into workspace", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: "/tmp/host/.tmp/grunt/../../etc/passwd",
          content: VALID_HANDOFF,
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
  });

  it("Claude-style Edit is not parent-allowed", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "Edit",
        toolInput: {
          file_path: path.join(ws, "src/index.ts"),
          old_string: "a",
          new_string: "b",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
  });

  it("denies invalid plan under .tmp/plans/", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "write",
        toolInput: {
          file_path: path.join(ws, ".tmp/plans/bad.md"),
          content: "PLAN_NAME: bad\n\n# bad\n\nnope\n",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
  });
});

function plantGruntJob(ws: string) {
  fs.mkdirSync(path.join(ws, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(ws, "scripts/grunt-job.mjs"), "");
}

describe("orchestrate-parent parent grunt-job bash", () => {
  it("denies parent grunt-job --job search and --job exec", () => {
    const ws = workspace();
    plantGruntJob(ws);
    for (const job of ["search", "exec"] as const) {
      const result = runHook(
        {
          hookEventName: "PreToolUse",
          toolName: "run_terminal_command",
          toolInput: {
            command: `node scripts/grunt-job.mjs --job ${job} --query foo`,
          },
          workspaceRoot: ws,
        },
        { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        decision: "allow",
      });
    }
    const rtk = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "rtk node ./scripts/grunt-job.mjs --job search --query foo",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(rtk.stdout)).toMatchObject({ decision: "allow" });
  });

  it("denies ls; /parent then ls allowed that turn", () => {
    const ws = workspace();
    const lsPayload = {
      hookEventName: "PreToolUse",
      toolName: "run_terminal_command",
      toolInput: { command: "ls" },
      workspaceRoot: ws,
      sessionId: "pe-ls",
    };
    const env = {
      GROK_HOOK_EVENT: "pre_tool_use",
      GROK_WORKSPACE_ROOT: ws,
      GROK_SESSION_ID: "pe-ls",
    };
    const denied = runHook(lsPayload, env);
    expect(JSON.parse(denied.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const submit = runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "/parent",
        workspaceRoot: ws,
        sessionId: "pe-ls",
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "pe-ls",
      },
    );
    expect(submit.status).toBe(0);
    const allowed = runHook(lsPayload, env);
    expect(allowed.status).toBe(0);
    expect(JSON.parse(allowed.stdout)).toMatchObject({ decision: "allow" });
  });

  it("denies ls and grunt-job --job web", () => {
    const ws = workspace();
    plantGruntJob(ws);
    const ls = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: { command: "ls" },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(ls.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const web = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "node scripts/grunt-job.mjs --job web --query x",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(web.stdout).decision).toBe("deny");
    const pipe = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command:
            "node scripts/grunt-job.mjs --job search --query foo | cat",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(pipe.stdout).decision).toBe("deny");
    const testJob = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "node scripts/grunt-job.mjs --job test --query true",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(testJob.stdout).decision).toBe("deny");
  });

  it("allows regex query and --path/--glob/--cwd; denies pipe and cd &&", () => {
    const ws = workspace();
    plantGruntJob(ws);
    const regex = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "node scripts/grunt-job.mjs --job search --query foo|bar --path src --glob *.md --cwd .",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(regex.stdout)).toMatchObject({ decision: "allow" });
    const quoted = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "node scripts/grunt-job.mjs --job search --query 'foo|bar'",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(quoted.stdout)).toMatchObject({ decision: "allow" });
    const pipe = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "node scripts/grunt-job.mjs --job search --query foo | cat",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(pipe.stdout).decision).toBe("deny");
    const and = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "run_terminal_command",
        toolInput: {
          command: "cd && node scripts/grunt-job.mjs --job search --query foo",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(and.stdout).decision).toBe("deny");
  });

  it("isAllowedParentGruntJob strips query; allows path glob cwd", () => {
    const ws = "/tmp/parent-gj-ws";
    const gj = "node scripts/grunt-job.mjs";
    expect(
      isAllowedParentGruntJob(
        `${gj} --job search --query foo|bar --path src --glob *.md --cwd .`,
        ws,
      ),
    ).toBe(true);
    expect(isAllowedParentGruntJob(`${gj} --job search --query 'foo|bar'`, ws)).toBe(
      true,
    );
    expect(isAllowedParentGruntJob(`${gj} --job search --query foo | cat`, ws)).toBe(
      false,
    );
    expect(
      isAllowedParentGruntJob(`cd && ${gj} --job search --query foo`, ws),
    ).toBe(false);
  });
});

describe("orchestrate-parent SubagentStop intercept", () => {
  it("child Stop without need: still no-ops", () => {
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        subagentType: "implementer",
        lastAssistantMessage: implMsg,
      },
      { GROK_HOOK_EVENT: "stop" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("SubagentStop and Stop+subagentType with a search need: blocks and contains verdict:", () => {
    const ws = workspace();
    fs.writeFileSync(path.join(ws, "hit.txt"), "unique-intercept-token-xyz\n");
    const need =
      'need: [{"job":"search","query":"unique-intercept-token-xyz"}]';
    for (const [event, hookEvent] of [
      ["SubagentStop", "subagent_stop"],
      ["Stop", "stop"],
    ] as const) {
      const result = runHook(
        {
          hookEventName: event,
          reason: "end_turn",
          subagentType: "implementer",
          lastAssistantMessage: need,
          workspaceRoot: ws,
          sessionId: "i-" + event,
        },
        {
          GROK_HOOK_EVENT: hookEvent,
          GROK_WORKSPACE_ROOT: ws,
          GROK_SESSION_ID: "i-" + event,
        },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("verdict:");
      const json = JSON.parse(result.stdout);
      expect(json.decision).toBe("block");
      expect(json.hookSpecificOutput.additionalContext).toContain("verdict:");
      expect(json.hookSpecificOutput.hookEventName).toBe(event);
    }
  });

  it("need path glob cwd not dropped", () => {
    const ws = workspace();
    fs.mkdirSync(path.join(ws, "keep"));
    fs.mkdirSync(path.join(ws, "skip"));
    fs.writeFileSync(path.join(ws, "keep", "hit.txt"), "extra-token-zzz\n");
    fs.writeFileSync(path.join(ws, "skip", "hit.txt"), "extra-token-zzz\n");
    fs.writeFileSync(path.join(ws, "keep", "hit.md"), "extra-token-zzz\n");
    const result = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "implementer",
        lastAssistantMessage:
          'need: [{"job":"search","query":"extra-token-zzz","path":"keep","glob":"*.txt","cwd":"."}]',
        workspaceRoot: ws,
        sessionId: "extras",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "extras",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("keep/hit.txt");
    expect(result.stdout).not.toContain("skip/hit.txt");
    expect(result.stdout).not.toContain("hit.md");
  });

  it("mixed web need: does not intercept", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "thinker",
        lastAssistantMessage:
          'need: [{"job":"search","query":"x"},{"job":"web","query":"https://example.com"}]',
        workspaceRoot: ws,
        sessionId: "mix",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "mix",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("orchestrate-parent hook config", () => {
  it("spawn rewrite and parent read deny still emit JSON", () => {
    const ws = workspace();
    const file = path.join(ws, "small.txt");
    fs.writeFileSync(file, "abc");
    const spawn = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "spawn_subagent",
        toolInput: {
          subagent_type: "implementer",
          resume_from: "child-1",
          prompt: "You are implementer subagent. ship it",
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(spawn.status).toBe(0);
    const spawnJson = JSON.parse(spawn.stdout);
    expect(spawnJson.decision || spawnJson.hookSpecificOutput).toBeTruthy();
    const read = runHook(
      {
        hookEventName: "PreToolUse",
        toolName: "read_file",
        toolInput: { target_file: file },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(read.status).toBe(0);
    expect(JSON.parse(read.stdout).decision).toBe("deny");
  });

  it("need ok vs fail; intercept FALLBACK", () => {
    const ws = workspace();
    fs.writeFileSync(path.join(ws, "hit.txt"), "ok-token-aaa\n");
    const ok = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "implementer",
        lastAssistantMessage: 'need: [{"job":"search","query":"ok-token-aaa"}]',
        workspaceRoot: ws,
        sessionId: "tok",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "tok",
      },
    );
    expect(ok.stdout).toContain("verdict:");
    expect(() => JSON.parse(ok.stdout)).not.toThrow();
    const fail = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "implementer",
        lastAssistantMessage: "not a need dump",
        workspaceRoot: ws,
        sessionId: "tfail",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "tfail",
      },
    );
    expect(fail.stdout).toBe("");
    const fb = runHook(
      {
        hookEventName: "SubagentStop",
        subagentType: "implementer",
        lastAssistantMessage:
          'need: [{"job":"search","query":"foo node_modules"}]',
        workspaceRoot: ws,
        sessionId: "tfb",
      },
      {
        GROK_HOOK_EVENT: "subagent_stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "tfb",
      },
    );
    expect(fb.stdout).toBe("");
  });

  it("orchestrate-parent.json still has no SessionStart", () => {
    const json = JSON.parse(
      fs.readFileSync(path.join(root, ".grok/hooks/orchestrate-parent.json"), "utf8"),
    );
    expect(json.hooks.SessionStart).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/SessionStart/);
  });

  it("claude settings deny Agent(orchestrator); hooks.jsonc has Stop + UserPromptSubmit", () => {
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"),
    );
    expect(settings.permissions.deny).toContain("Agent(orchestrator)");
    const ssot = fs.readFileSync(path.join(root, ".rulesync/hooks.jsonc"), "utf8");
    expect(ssot).toMatch(/"stop"/);
    expect(ssot).toMatch(/"beforeSubmitPrompt"/);
    expect(ssot).not.toMatch(/"userPromptSubmit"/);
    expect(ssot).toMatch(/orchestrate-parent\.js/);
    const jsonc = JSON.parse(
      ssot.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    );
    expect(Object.keys(jsonc.hooks)).toEqual(
      expect.arrayContaining(["preToolUse", "beforeSubmitPrompt", "stop"]),
    );
    expect(Object.keys(jsonc.hooks)).not.toContain("userPromptSubmit");
    expect(jsonc.hooks.beforeSubmitPrompt[0].command).toMatch(/orchestrate-parent\.js/);
    expect(jsonc.hooks.beforeSubmitPrompt[0].timeout).toBe(5);
    // SubagentStop must be registered on both the flagship Claude target and the
    // hand-authored Grok SSOT, so the `need:` continuation advertised by
    // .rulesync/reference/cascade.md and hooks.md actually exists on Claude.
    expect(JSON.stringify(settings.hooks?.SubagentStop)).toMatch(
      /orchestrate-parent\.js/,
    );
    const grokJson = JSON.parse(
      fs.readFileSync(
        path.join(root, ".grok/hooks/orchestrate-parent.json"),
        "utf8",
      ),
    );
    expect(JSON.stringify(grokJson.hooks?.SubagentStop)).toMatch(
      /orchestrate-parent\.js/,
    );
  });

  it("hooks generate --check loads canonical beforeSubmitPrompt", () => {
    const result = spawnSync(
      path.join(root, "node_modules/.bin/rulesync"),
      ["generate", "-t", "claudecode,codexcli,antigravity-cli", "-f", "hooks", "--check"],
      { cwd: root, encoding: "utf8", timeout: 60_000 },
    );
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(combined).not.toMatch(/Failed to load Rulesync hooks file/);
    expect(combined).not.toMatch(/unknown hook event name\(s\): userPromptSubmit/);
    expect(result.status).toBe(0);
    const claude = JSON.parse(
      fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"),
    ).hooks;
    expect(JSON.stringify(claude.PreToolUse)).toMatch(/scrub-spawn-prompt/);
    expect(JSON.stringify(claude.PreToolUse)).toMatch(/gate-fat-tools/);
    expect(JSON.stringify(claude.UserPromptSubmit)).toMatch(/orchestrate-parent\.js/);
    expect(JSON.stringify(claude.Stop ?? claude.stop)).toMatch(/orchestrate-parent\.js/);
    const codex = JSON.parse(
      fs.readFileSync(path.join(root, ".codex/hooks.json"), "utf8"),
    ).hooks;
    expect(JSON.stringify(codex.PreToolUse)).toMatch(/scrub-spawn-prompt/);
    expect(JSON.stringify(codex.UserPromptSubmit)).toMatch(/orchestrate-parent\.js/);
    expect(JSON.stringify(codex.Stop ?? codex.stop)).toMatch(/orchestrate-parent\.js/);
    const ag = JSON.parse(
      fs.readFileSync(path.join(root, ".agents/hooks.json"), "utf8"),
    ).rulesync;
    expect(JSON.stringify(ag.PreToolUse)).toMatch(/scrub-spawn-prompt/);
    expect(JSON.stringify(ag.PreToolUse)).toMatch(/gate-fat-tools/);
    expect(ag.UserPromptSubmit).toBeUndefined();
    expect(ag.beforeSubmitPrompt).toBeUndefined();
    expect(ag.userPromptSubmit).toBeUndefined();
    expect(JSON.stringify(ag.Stop ?? ag.stop)).toMatch(/orchestrate-parent\.js/);
    expect(fs.existsSync(path.join(root, ".grok/hooks/orchestrate-parent.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, ".grok/hooks/orchestrate-parent.json"))).toBe(
      true,
    );
  }, 60_000);
});

describe("orchestrate-parent spawn Agent + default sid", () => {
  it("treats Agent and spawn_agent as spawn", () => {
    const ws = workspace();
    for (const toolName of ["Agent", "spawn_agent"]) {
      const result = runHook(
        {
          hookEventName: "PreToolUse",
          toolName,
          toolInput: { prompt: "ship it", subagent_type: "grunt" },
          workspaceRoot: ws,
        },
        { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
      );
      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.decision === "allow" || out.hookSpecificOutput).toBeTruthy();
      expect(out.decision).not.toBe("deny");
    }
  });

  it("stampPath falls back to sid default", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: implMsg,
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "" },
    );
    expect(JSON.parse(result.stdout).decision).toBe("block");
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "stop-block-default")),
    ).toBe(true);
  });
});



describe("orchestrate-parent /solo", () => {
  const soloStamp = (ws: string, sid: string) =>
    path.join(ws, ORCHESTRATOR_LOGS_DIR, `grunt-off-${sid}`);

  const submit = (ws: string, sid: string, prompt: string) =>
    runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt,
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );

  const stopTurn = (ws: string, sid: string, msg = implMsg) =>
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: msg,
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );

  const preTool = (
    ws: string,
    sid: string,
    toolName: string,
    toolInput: unknown,
  ) =>
    runHook(
      {
        hookEventName: "PreToolUse",
        toolName,
        toolInput,
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "pre_tool_use",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );

  it("/solo sets the stamp and /cascade clears it", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    expect(fs.existsSync(soloStamp(ws, "s"))).toBe(true);
    submit(ws, "s", "/cascade");
    expect(fs.existsSync(soloStamp(ws, "s"))).toBe(false);
  });

  it("/cascade is an idempotent no-op when already orchestrated", () => {
    const ws = workspace();
    const result = submit(ws, "s", "/cascade");
    expect(result.status).toBe(0);
    expect(fs.existsSync(soloStamp(ws, "s"))).toBe(false);
  });

  it("stamp is sticky across ordinary prompts", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    for (const p of ["what is 2+2", "/parent ship it", "/explain", "keep going"]) {
      submit(ws, "s", p);
      expect(fs.existsSync(soloStamp(ws, "s"))).toBe(true);
    }
  });

  it("is session-scoped: one sid soloed leaves another orchestrated", () => {
    const ws = workspace();
    submit(ws, "a", "/solo");
    expect(JSON.parse(stopTurn(ws, "b").stdout).decision).toBe("block");
    expect(stopTurn(ws, "a").stdout).toBe("");
  });

  it("Stop does not block in solo", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    const result = stopTurn(ws, "s");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "stop-block-s")),
    ).toBe(false);
  });

  it("solo never consumes the parent-escape stamp", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    const escape = path.join(ws, ORCHESTRATOR_LOGS_DIR, "parent-escape-s");
    fs.mkdirSync(path.dirname(escape), { recursive: true });
    fs.writeFileSync(escape, "1");
    expect(stopTurn(ws, "s").stdout).toBe("");
    expect(fs.existsSync(escape)).toBe(true);
  });

  it("allows parent Bash in solo", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    const out = JSON.parse(preTool(ws, "s", "bash", { command: "ls" }).stdout);
    expect(out.decision).toBe("allow");
  });

  it("still applies the fat gate in solo", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    const out = JSON.parse(
      preTool(ws, "s", "read", {
        file_path: path.join(ws, "node_modules/a.js"),
      }).stdout,
    );
    expect(out.hookSpecificOutput?.permissionDecision ?? out.decision).toBe(
      "deny",
    );
  });

  it("does not rewrite spawn to grunt in solo", () => {
    const ws = workspace();
    submit(ws, "s", "/solo");
    const out = JSON.parse(
      preTool(ws, "s", "task", { prompt: "do the thing" }).stdout,
    );
    expect(out.decision).toBe("allow");
    expect(out.hookSpecificOutput).toBeUndefined();
  });

  it("refuses the stamp without a real session id", () => {
    const ws = workspace();
    runHook(
      { hookEventName: "UserPromptSubmit", prompt: "/solo", workspaceRoot: ws },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "",
      },
    );
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "grunt-off-default")),
    ).toBe(false);
    expect(fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, "grunt-off-"))).toBe(
      false,
    );
  });

  it("only exact /solo and /cascade toggle the mode", () => {
    const ws = workspace();
    for (const p of ["/solomon", "solo", "/solo now", "// solo", "/cascaded"]) {
      submit(ws, "s", p);
      expect(fs.existsSync(soloStamp(ws, "s"))).toBe(false);
    }
  });

  it("default path is unchanged without the stamp", () => {
    const ws = workspace();
    expect(JSON.parse(stopTurn(ws, "s").stdout).decision).toBe("block");
    expect(
      JSON.parse(preTool(ws, "s", "bash", { command: "ls" }).stdout).decision,
    ).toBe("deny");
    const spawn = JSON.parse(
      preTool(ws, "s", "task", { prompt: "do the thing" }).stdout,
    );
    expect(spawn.hookSpecificOutput.updatedInput.subagent_type).toBe("grunt");
  });

  it("solo skill ships to every host from one SSOT", () => {
    const ssot = fs.readFileSync(
      path.join(root, ".rulesync/skills/solo/SKILL.md"),
      "utf8",
    );
    expect(ssot).toMatch(/grunt-off-\{sid\}/);
    expect(ssot).toMatch(/\/cascade/);
    expect(ssot).toMatch(/Agents\/Antigravity/);
    expect(ssot).toMatch(/instruction-only/);
    expect(ssot).toMatch(/cannot create stamp/);
    for (const rel of [
      ".grok/skills/solo/SKILL.md",
      ".claude/skills/solo/SKILL.md",
      ".agents/skills/solo/SKILL.md",
    ]) {
      expect(fs.readFileSync(path.join(root, rel), "utf8")).toBe(ssot);
    }
  });

  it("cascade skill ships to every host from one SSOT", () => {
    const ssot = fs.readFileSync(
      path.join(root, ".rulesync/skills/cascade/SKILL.md"),
      "utf8",
    );
    expect(ssot).toMatch(/Exit solo \/ restore cascade/);
    expect(ssot).toMatch(/Not a sticky second mode/);
    expect(ssot).toMatch(/grunt-off-\{sid\}/);
    expect(ssot).toMatch(/\/solo/);
    expect(ssot).toMatch(/`need:`\/`verdict:`/);
    expect(ssot).toMatch(/Agents\/Antigravity/);
    expect(ssot).toMatch(/instruction-only/);
    expect(ssot).toMatch(/cannot unlink stamp/);
    expect(ssot).not.toMatch(/multi-agent/);
    for (const rel of [
      ".grok/skills/cascade/SKILL.md",
      ".claude/skills/cascade/SKILL.md",
      ".agents/skills/cascade/SKILL.md",
    ]) {
      expect(fs.readFileSync(path.join(root, rel), "utf8")).toBe(ssot);
    }
  });
});

describe("parent-deny product Write/Edit/Bash/Skill", () => {
  function pre(
    ws: string,
    extra: Record<string, unknown>,
    env: NodeJS.ProcessEnv = {},
  ) {
    return runHook(
      {
        hookEventName: "PreToolUse",
        workspaceRoot: ws,
        ...extra,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws, ...env },
    );
  }

  it("denies product Write without type or escape; allows escape then deny after Stop", () => {
    const ws = workspace();
    const sid = "deny-write";
    const env = { GROK_SESSION_ID: sid };
    for (const rel of ["apps/testapp/pages/empty-page.xml", "src/index.ts"]) {
      const denied = pre(
        ws,
        {
          toolName: "Write",
          toolInput: {
            file_path: path.join(ws, rel),
            content: "x\n",
          },
          sessionId: sid,
        },
        env,
      );
      expect(JSON.parse(denied.stdout)).toMatchObject({
        decision: "deny",
        reason: DENY_REASON,
      });
    }
    runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "/parent",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    const allowed = pre(
      ws,
      {
        toolName: "Write",
        toolInput: {
          file_path: path.join(ws, "apps/testapp/pages/empty-page.xml"),
          content: "x\n",
        },
        sessionId: sid,
      },
      env,
    );
    expect(JSON.parse(allowed.stdout)).toMatchObject({ decision: "allow" });
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: parent turn",
        workspaceRoot: ws,
        sessionId: sid,
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
    );
    const again = pre(
      ws,
      {
        toolName: "Write",
        toolInput: {
          file_path: path.join(ws, "src/index.ts"),
          content: "x\n",
        },
        sessionId: sid,
      },
      env,
    );
    expect(JSON.parse(again.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
  });

  it("implementer product Write is not parent-deny", () => {
    const ws = workspace();
    const result = pre(ws, {
      toolName: "Write",
      subagentType: "implementer",
      toolInput: {
        file_path: path.join(ws, "src/index.ts"),
        content: "export {}\n",
      },
    });
    const out = result.stdout ? JSON.parse(result.stdout) : {};
    expect(out.decision).not.toBe("deny");
  });

  it("UUID-only agentId product Write is not parent-deny; empty parent Write is", () => {
    const ws = workspace();
    const dest = path.join(ws, "src/index.ts");
    const uuid = "b2c6f0d4-0000-4000-8000-000000000000";
    const child = pre(ws, {
      toolName: "Write",
      agentId: uuid,
      toolInput: { file_path: dest, content: "export {}\n" },
    });
    const childOut = child.stdout ? JSON.parse(child.stdout) : {};
    expect(childOut.decision).not.toBe("deny");
    const snake = pre(ws, {
      toolName: "Write",
      agent_id: uuid,
      toolInput: { file_path: dest, content: "export {}\n" },
    });
    const snakeOut = snake.stdout ? JSON.parse(snake.stdout) : {};
    expect(snakeOut.decision).not.toBe("deny");
    const spawned = pre(ws, {
      toolName: "Write",
      spawnedBy: uuid,
      toolInput: { file_path: dest, content: "export {}\n" },
    });
    const spawnedOut = spawned.stdout ? JSON.parse(spawned.stdout) : {};
    expect(spawnedOut.decision).not.toBe("deny");
    const parent = pre(ws, {
      toolName: "Write",
      toolInput: { file_path: dest, content: "export {}\n" },
    });
    expect(JSON.parse(parent.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
  });

  it("denies Edit, non-grunt Bash, Skill create-page; allows write-plan and grunt-job", () => {
    const ws = workspace();
    plantGruntJob(ws);
    const edit = pre(ws, {
      toolName: "Edit",
      toolInput: { file_path: path.join(ws, "src/index.ts"), old_string: "a", new_string: "b" },
    });
    expect(JSON.parse(edit.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const bash = pre(ws, {
      toolName: "Bash",
      toolInput: { command: "ls" },
    });
    expect(JSON.parse(bash.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const skill = pre(ws, {
      toolName: "Skill",
      toolInput: { skill: "create-page" },
    });
    expect(JSON.parse(skill.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const writePlan = pre(ws, {
      toolName: "Skill",
      toolInput: { skill: "write-plan" },
    });
    expect(JSON.parse(writePlan.stdout)).toMatchObject({ decision: "allow" });
    for (const skill of ["explain", "parent", "pickup", "handoff"]) {
      const allowed = pre(ws, {
        toolName: "Skill",
        toolInput: { skill },
      });
      expect(JSON.parse(allowed.stdout)).toMatchObject({ decision: "allow" });
    }
    const alias = pre(ws, {
      toolName: "Skill",
      toolInput: { skill: "resume-handoff" },
    });
    expect(JSON.parse(alias.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
    const gj = pre(ws, {
      toolName: "Bash",
      toolInput: {
        command: "node scripts/grunt-job.mjs --job search --query foo",
      },
    });
    expect(JSON.parse(gj.stdout)).toMatchObject({ decision: "allow" });
  });

  it("SSOT inlines maximal superterse every turn and create/change-files rows", () => {
    for (const rel of [
      ".rulesync/subagents/orchestrator.md",
      ".rulesync/rules/overview.md",
      ".rulesync/rules/CLAUDE.md",
    ]) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      const body = text.replace(/^---[\s\S]*?---\s*/, "");
      expect(body).toMatch(/maximal superterse/);
      expect(body).toMatch(/every turn/);
      expect(body).toMatch(/create\/change product files/);
      expect(body).toMatch(/file writes remain/);
    }
  });

  it("Claude settings PreToolUse parent-deny + one SubagentStop", () => {
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"),
    );
    const pre = JSON.stringify(settings.hooks?.PreToolUse ?? []);
    expect(pre).toMatch(/orchestrate-parent\.js/);
    expect(pre).toMatch(/Write/);
    expect(pre).toMatch(/Bash/);
    expect(pre).toMatch(/Skill/);
    expect(pre).toMatch(/Read\|read_file\|Grep\|grep\|Glob\|list_dir/);
    const sub = settings.hooks?.SubagentStop ?? [];
    const cmds = JSON.stringify(sub).match(/orchestrate-parent\.js/g) || [];
    expect(cmds.length).toBe(1);
    expect(fs.existsSync(path.join(root, ".claude/hooks/orchestrate-parent.json"))).toBe(
      false,
    );
    const named = Object.keys(settings).filter((k) =>
      /orchestrate-parent/i.test(k),
    );
    expect(named).toEqual([]);
  });

  it("DENY_REASON is spawn-first + deny-expected + /solo only", () => {
    expect(DENY_REASON).toBe(
      "First action=spawn implementer|grunt|thinker. Deny expected. Only /solo this session escapes.",
    );
  });

  it("denies parent read_file/Read unless solo or parent-escape", () => {
    const ws = workspace();
    const sid = "deny-read";
    const env = { GROK_SESSION_ID: sid };
    const filePath = path.join(ws, "src/index.ts");
    for (const [toolName, toolInput] of [
      ["read_file", { target_file: filePath }],
      ["Read", { file_path: filePath }],
    ] as const) {
      const denied = pre(
        ws,
        { toolName, toolInput, sessionId: sid },
        env,
      );
      expect(JSON.parse(denied.stdout)).toMatchObject({
        decision: "deny",
        reason: DENY_REASON,
      });
    }
  });

  it("solo stamp allows parent Read; fat still denies denylist", () => {
    const ws = workspace();
    const sid = "solo-read";
    fs.mkdirSync(path.join(ws, ORCHESTRATOR_LOGS_DIR), { recursive: true });
    fs.writeFileSync(
      path.join(ws, ORCHESTRATOR_LOGS_DIR, `grunt-off-${sid}`),
      "1",
    );
    const allowed = pre(
      ws,
      {
        toolName: "read_file",
        toolInput: { target_file: path.join(ws, "src/index.ts") },
        sessionId: sid,
      },
      { GROK_SESSION_ID: sid },
    );
    const out = allowed.stdout ? JSON.parse(allowed.stdout) : {};
    expect(out.decision).not.toBe("deny");
    expect(out.hookSpecificOutput?.permissionDecision).not.toBe("deny");
    const fat = pre(
      ws,
      {
        toolName: "read_file",
        toolInput: { target_file: path.join(ws, "node_modules/a.js") },
        sessionId: sid,
      },
      { GROK_SESSION_ID: sid },
    );
    const fatOut = JSON.parse(fat.stdout);
    expect(fatOut.hookSpecificOutput?.permissionDecision ?? fatOut.decision).toBe(
      "deny",
    );
  });

  it("/explain does not create solo or parent-escape stamps", () => {
    const ws = workspace();
    const sid = "explain-nostamp";
    runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "/explain",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, `grunt-off-${sid}`)),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(ws, ORCHESTRATOR_LOGS_DIR, `parent-escape-${sid}`)),
    ).toBe(false);
  });

  it("parent-escape allows Read then Stop consumes", () => {
    const ws = workspace();
    const sid = "pe-read";
    const env = { GROK_SESSION_ID: sid };
    runHook(
      {
        hookEventName: "UserPromptSubmit",
        prompt: "/parent",
        workspaceRoot: ws,
        sessionId: sid,
      },
      {
        GROK_HOOK_EVENT: "user_prompt_submit",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: sid,
      },
    );
    const allowed = pre(
      ws,
      {
        toolName: "read_file",
        toolInput: { target_file: path.join(ws, "src/index.ts") },
        sessionId: sid,
      },
      env,
    );
    const allowedOut = JSON.parse(allowed.stdout);
    expect(allowedOut.decision).not.toBe("deny");
    expect(allowedOut.hookSpecificOutput?.permissionDecision).not.toBe("deny");
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: parent turn",
        workspaceRoot: ws,
        sessionId: sid,
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: sid },
    );
    const again = pre(
      ws,
      {
        toolName: "read_file",
        toolInput: { target_file: path.join(ws, "src/index.ts") },
        sessionId: sid,
      },
      env,
    );
    expect(JSON.parse(again.stdout)).toMatchObject({
      decision: "deny",
      reason: DENY_REASON,
    });
  });

  it("hooks.md deny-reason matches DENY_REASON; grok json PreToolUse has no matcher", () => {
    const hooksMd = fs.readFileSync(
      path.join(root, ".rulesync/reference/hooks.md"),
      "utf8",
    );
    expect(hooksMd).toContain(DENY_REASON);
    const grokJson = JSON.parse(
      fs.readFileSync(
        path.join(root, ".grok/hooks/orchestrate-parent.json"),
        "utf8",
      ),
    );
    const pre = grokJson.hooks?.PreToolUse ?? [];
    expect(pre.some((h: { matcher?: string }) => h.matcher)).toBe(false);
    expect(fs.existsSync(path.join(root, ".tmp/orchestrator-logs/grunt-off-fixture"))).toBe(
      false,
    );
  });
});
