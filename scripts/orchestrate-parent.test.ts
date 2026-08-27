import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isAllowedParentGruntJob } from "../.grok/hooks/orchestrate-parent.js";
import { VALID_HANDOFF } from "./persist-handoff.test.ts";
import { VALID_THINKER } from "./persist-plan.test.ts";
import { ORCHESTRATOR_LOGS_DIR, telemetryPath } from "./telemetry.mjs";

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
          "[handoff]: serial=1 path=.tmp/grunt/handoffs/1-x-20260827T143000Z.md\nnext: start a new session; first action = read that path\n",
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
      expect(json.reason).toMatch(/XOR/);
      expect(json.reason).toMatch(/⚠/);
      expect(json.reason).toMatch(/validate/);
      expect(json.reason).toMatch(/sim/);
      expect(json.reason).toMatch(/spawn implementer/);
      expect(json.reason).toMatch(/\[orchestrator\]:/);
      expect(json.reason).not.toMatch(/do not recap done/);
      expect(json.reason).toMatch(/do not recap; spawn/);
      expect(json.reason).toMatch(/do not glue done into the tag/);
      expect(json.reason).toMatch(/\[grunt done\]/);
      expect(json.reason).toMatch(/\[\[agent\] done\]/);
      expect(json.reason).not.toMatch(
        /`\[grunt\]:`[\s\S]*`\[implementer\]:`[\s\S]*`\[thinker\]:`[\s\S]*`\[handoff\]:`/,
      );
      reasons.push(json.reason);
    }
    expect(new Set(reasons).size).toBe(3);
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
    expect(JSON.parse(first.stdout).reason).toMatch(/^Violation:/);
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
    const second = runHook(payload, env);
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout).reason).toMatch(/^Second violation:/);
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
    expect(JSON.parse(again.stdout).reason).toMatch(/^Violation:/);
  });

  it("logs parent-stop telemetry without message body", () => {
    const ws = workspace();
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "[orchestrator]: ok",
        workspaceRoot: ws,
        sessionId: "s-tel-ok",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-tel-ok",
      },
    );
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "no recap here",
        workspaceRoot: ws,
        sessionId: "s-tel-block",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-tel-block",
      },
    );
    runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        stop_hook_active: true,
        lastAssistantMessage: "no recap here",
        workspaceRoot: ws,
        sessionId: "s-tel-sha",
      },
      {
        GROK_HOOK_EVENT: "stop",
        GROK_WORKSPACE_ROOT: ws,
        GROK_SESSION_ID: "s-tel-sha",
      },
    );
    const rows = readTelemetry(ws).filter((r) => r.event === "parent-stop");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const ok = rows.find((r) => r.recap === true);
    expect(ok).toMatchObject({
      recap: true,
      recapSource: "payload",
      failOpen: false,
      stopHookActive: false,
    });
    const blocked = rows.find((r) => r.recap === false && r.stopHookActive === false);
    expect(blocked).toMatchObject({
      recap: false,
      recapSource: "payload",
      failOpen: false,
      stopHookActive: false,
    });
    expect(blocked.attempt).toBe(1);
    const sha = rows.find((r) => r.stopHookActive === true);
    expect(sha).toMatchObject({
      recap: false,
      recapSource: "none",
      failOpen: true,
      stopHookActive: true,
    });
    for (const r of rows) {
      expect(r).not.toHaveProperty("lastAssistantMessage");
      expect(r).not.toHaveProperty("message");
      expect(r).not.toHaveProperty("body");
      expect(r).not.toHaveProperty("msg");
      expect(JSON.stringify(r)).not.toMatch(/no recap here/);
      expect(JSON.stringify(r)).not.toMatch(/\[orchestrator\]: ok/);
    }
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
          file_path: path.join(ws, ".tmp/plans/draft.md"),
          content: VALID_THINKER,
        },
        workspaceRoot: ws,
      },
      { GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: ws },
    );
    expect(JSON.parse(result.stdout).decision).toBe("deny");
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

function readTelemetry(ws: string) {
  const p = telemetryPath(ws);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
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
        decision: "deny",
        reason: "parent is orchestrator; spawn grunt|implementer|thinker",
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
    expect(JSON.parse(rtk.stdout)).toMatchObject({ decision: "deny" });
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
      reason: "parent is orchestrator; spawn grunt|implementer|thinker",
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
      reason: "parent is orchestrator; spawn grunt|implementer|thinker",
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
    expect(JSON.parse(regex.stdout)).toMatchObject({ decision: "deny" });
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
    expect(JSON.parse(quoted.stdout)).toMatchObject({ decision: "deny" });
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

describe("orchestrate-parent telemetry", () => {
  it("spawn logs type; read bytes present; stdout is not the telemetry line", () => {
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
    expect(spawn.stdout).not.toMatch(/telemetry/);
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
    JSON.parse(read.stdout);
    const lines = readTelemetry(ws);
    expect(lines.some((l) => l.spawnType === "implementer")).toBe(true);
    expect(lines.some((l) => l.resumeFromCount === 1)).toBe(true);
    expect(lines.some((l) => l.fileSizeBytes === 3)).toBe(true);
  });

  it("need ok vs fail; intercept FALLBACK; hook stdout is not the telemetry line", () => {
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
    const lines = readTelemetry(ws);
    expect(lines.some((l) => l.parseOk === true && l.intercept === "grunt-job")).toBe(
      true,
    );
    expect(lines.some((l) => l.parseOk === false && l.intercept === "none")).toBe(
      true,
    );
    expect(lines.some((l) => l.intercept === "FALLBACK")).toBe(true);
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
});
