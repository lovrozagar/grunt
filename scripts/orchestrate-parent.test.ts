import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isAllowedParentGruntJob } from "../.grok/hooks/orchestrate-parent.js";
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
  it("does not block cheap trivia", () => {
    const ws = workspace();
    const result = runHook(
      {
        hookEventName: "Stop",
        reason: "end_turn",
        lastAssistantMessage: "Yes. HTTP is a request/response protocol.",
        workspaceRoot: ws,
        sessionId: "s1",
      },
      { GROK_HOOK_EVENT: "stop", GROK_WORKSPACE_ROOT: ws, GROK_SESSION_ID: "s1" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("does not block a long definition that is not implementation-like", () => {
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
    expect(result.stdout).toBe("");
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
  it("allows parent grunt-job --job search and --job exec", () => {
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
      expect(JSON.parse(result.stdout)).toMatchObject({ decision: "allow" });
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
});


