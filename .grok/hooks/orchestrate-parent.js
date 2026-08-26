#!/usr/bin/env node
/** Parent-orchestrator gate: allow spawn/read/todo; deny write/edit/bash/web/MCP.
Fat Read/Grep/Glob limits + path denylist via gate-fat-tools (one updatedInput).
Parent bash: only node scripts/grunt-job.mjs --job search|exec [--path --glob --cwd].
SubagentStop intercepts need: search|exec with grunt-job verdicts.
Stop: recap [agent]: / parent-escape stamp; do not waive impl on tools-used.
Fail-open: parse/crash → empty stdout, exit 0. Explicit JSON only when denying.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rewriteSpawnToolInput } from "../../scripts/scrub-spawn-prompt.mjs";
import {
  fatHookOutput,
  fileSizeBytes,
  isWorkspaceGruntJob,
  processFatTools,
  resolveReadPath,
  subagentTypeOf,
} from "../../scripts/gate-fat-tools.mjs";
import { persistPlan } from "../../scripts/persist-plan.mjs";
import { parseNeed } from "../../scripts/parse-need.mjs";
import { resolveJobCwd, runJob } from "../../scripts/grunt-job.mjs";
import { logTelemetry, ORCHESTRATOR_LOGS_DIR } from "../../scripts/telemetry.mjs";

const DENY_REASON = "parent is orchestrator; spawn grunt|implementer|thinker";
const STOP_REASON =
  "parent is orchestrator; spawn grunt|implementer|thinker; do not complete in-parent";
const ALLOWED_TOOLS = new Set([
  "spawnsubagent",
  "task",
  "todowrite",
  "getcommandorsubagentoutput",
  "gettaskoutput",
  "killcommandorsubagent",
  "killtask",
  "readfile",
  "read",
  "grep",
  "grepsearch",
  "listdir",
  "glob",
]);
const SPAWN_TOOLS = new Set(["spawnsubagent", "task"]);
const WRITE_TOOLS = new Set(["write"]);
const BASH_TOOLS = new Set(["bash", "runterminalcommand"]);
const READ_TOOLS = new Set(["readfile", "read"]);
const INTERCEPT_JOBS = new Set(["search", "exec"]);
const MAX_STOP = 3;
const MAX_INTERCEPT = 3;


function main() {
  try {
    const data = readJsonValue();
    const event = eventKey(
      process.env.GROK_HOOK_EVENT ||
        (data && (data.hookEventName || data.hook_event_name)) ||
        "",
    );
    if (event === "pretooluse") return preToolUse(data || {});
    if (event === "posttooluse") return postToolUse(data || {});
    if (event === "userpromptsubmit") return userPromptSubmit(data || {});
    if (event === "stop") return stop(data || {});
    if (event === "subagentstop") return interceptNeed(data || {}, "SubagentStop");
    return 0;
  } catch {
    return 0;
  }
}

function preToolUse(data) {
  const toolName = String(data.toolName || data.tool_name || "");
  const toolKey = eventKey(toolName);
  let toolInput = data.toolInput;
  if (toolInput == null) toolInput = data.tool_input;
  logPreTool(data, toolKey, toolInput);

  const sub = subagentTypeOf(data);
  if (sub) {
    const code = emitFat(data);
    return code == null ? 0 : code;
  }
  if (SPAWN_TOOLS.has(toolKey)) {
    const updated = rewriteSpawn(toolInput);
    if (updated) {
      emit({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          updatedInput: updated,
        },
      });
      return 0;
    }
    emit({ decision: "allow" });
    return 0;
  }
  if (WRITE_TOOLS.has(toolKey)) {
    return parentWrite(data, toolInput);
  }
  if (BASH_TOOLS.has(toolKey)) {
    return parentBash(data, toolInput);
  }
  if (ALLOWED_TOOLS.has(toolKey)) {
    const fatCode = emitFat(data);
    if (fatCode !== null) return fatCode;
    emit({ decision: "allow" });
    return 0;
  }
  emit({ decision: "deny", reason: DENY_REASON });
  return 0;
}

function logPreTool(data, toolKey, toolInput) {
  const fields = {};
  if (SPAWN_TOOLS.has(toolKey) && toolInput && typeof toolInput === "object") {
    fields.spawnType = String(
      toolInput.subagent_type || toolInput.subagentType || "",
    );
    const rf = toolInput.resume_from ?? toolInput.resumeFrom;
    fields.resumeFromCount =
      rf == null || rf === "" ? 0 : Array.isArray(rf) ? rf.length : 1;
  }
  if (READ_TOOLS.has(toolKey) && toolInput && typeof toolInput === "object") {
    const raw =
      toolInput.target_file ||
      toolInput.file_path ||
      toolInput.targetFile ||
      toolInput.filePath ||
      "";
    fields.fileSizeBytes = fileSizeBytes(resolveReadPath(raw, data));
  }
  if (Object.keys(fields).length) {
    logTelemetry("pretool", fields, workspaceRootOf(data));
  }
}

function emitFat(data) {
  const fat = fatHookOutput(processFatTools(data));
  if (!fat) return null;
  emit(fat);
  return 0;
}

function workspaceRootOf(data) {
  return (
    process.env.GROK_WORKSPACE_ROOT ||
    (data && (data.workspaceRoot || data.workspace_root || data.cwd)) ||
    ""
  );
}

export function isUnderPlans(filePath, workspaceRoot) {
  if (!filePath || !workspaceRoot) return false;
  const abs = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspaceRoot, filePath);
  const plans = path.resolve(workspaceRoot, ".tmp", "plans");
  const rel = path.relative(plans, abs);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function isAllowedParentGruntJob(command, workspaceRoot) {
  return isWorkspaceGruntJob(command, workspaceRoot, ["search", "exec"]);
}

function parentBash(data, toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const cmd = typeof toolInput.command === "string" ? toolInput.command : "";
  if (!isAllowedParentGruntJob(cmd, workspaceRootOf(data))) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  emit({ decision: "allow" });
  return 0;
}

function parentWrite(data, toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const ws = workspaceRootOf(data);
  const rawPath =
    toolInput.file_path ||
    toolInput.filePath ||
    toolInput.path ||
    toolInput.target_file ||
    "";
  if (!isUnderPlans(rawPath, ws)) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const content = typeof toolInput.content === "string" ? toolInput.content : "";
  const result = persistPlan({ workspaceRoot: ws, content });
  if (!result.ok) {
    emit({
      decision: "deny",
      reason: result.error || "invalid plan",
    });
    return 0;
  }
  const next = Object.assign({}, toolInput, {
    file_path: result.path,
    content: result.content,
  });
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: next,
    },
  });
  return 0;
}

function rewriteSpawn(toolInput) {
  // Type default + intent-scrub in one updatedInput (last-wins with scrub-spawn).
  return rewriteSpawnToolInput(toolInput, { defaultGrunt: true });
}

function postToolUse(data) {
  if (data.subagentType || data.subagent_type) return 0;
  const stamp = stampPath(data, "tools-used");
  if (!stamp) return 0;
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, "1");
  return 0;
}

function userPromptOf(data) {
  if (!data || typeof data !== "object") return "";
  return String(data.prompt ?? data.userPrompt ?? data.user_prompt ?? data.content ?? "");
}

function isParentEscapePrompt(prompt) {
  return /^\s*\/parent(?:\s|$)/.test(String(prompt || ""));
}

function userPromptSubmit(data) {
  unlinkQuiet(stampPath(data, "tools-used"));
  unlinkQuiet(stampPath(data, "stop-block"));
  if (isParentEscapePrompt(userPromptOf(data))) {
    const p = stampPath(data, "parent-escape");
    if (p) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, "1");
    }
  } else {
    unlinkQuiet(stampPath(data, "parent-escape"));
  }
  return 0;
}

function isChildRecap(msg) {
  return /^\s*\[(?:grunt|implementer|thinker)\]:/.test(String(msg || ""));
}

function stop(data) {
  if (data.subagentType || data.subagent_type) {
    return interceptNeed(data, "Stop");
  }
  const reason = String(data.reason || "");
  if (reason && reason !== "end_turn") return 0;

  const escapeStamp = stampPath(data, "parent-escape");
  if (escapeStamp && fs.existsSync(escapeStamp)) {
    unlinkQuiet(escapeStamp);
    return 0;
  }

  const msg = data.lastAssistantMessage || data.last_assistant_message || "";
  if (isCheap(msg) || isChildRecap(msg)) return 0;
  if (!looksLikeImplementation(msg)) return 0;

  const stopStamp = stampPath(data, "stop-block");
  let n = 0;
  if (stopStamp && fs.existsSync(stopStamp)) {
    n = parseInt(fs.readFileSync(stopStamp, "utf8"), 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
  }
  if (n >= MAX_STOP) return 0;
  if (stopStamp) {
    fs.mkdirSync(path.dirname(stopStamp), { recursive: true });
    fs.writeFileSync(stopStamp, String(n + 1));
  }
  emit({ decision: "block", reason: STOP_REASON });
  return 0;
}

function interceptNeed(data, hookEventName) {
  const ws = workspaceRootOf(data);
  if (data.stopHookActive || data.stop_hook_active) {
    logTelemetry(
      "stop",
      { parseOk: false, intercept: "none" },
      ws,
    );
    return 0;
  }
  const msg = data.lastAssistantMessage || data.last_assistant_message || "";
  const parsed = parseNeed(msg);
  if (!parsed.ok) {
    logTelemetry("stop", { parseOk: false, intercept: "none" }, ws);
    return 0;
  }
  const jobs = parsed.jobs;
  const names = jobs.map((j) => j.job);
  if (
    jobs.length > 4 ||
    !jobs.every((j) => INTERCEPT_JOBS.has(j.job))
  ) {
    logTelemetry(
      "stop",
      { parseOk: true, jobs: names, intercept: "none" },
      ws,
    );
    return 0;
  }

  const interceptStamp = stampPath(data, "need-intercept");
  let n = 0;
  if (interceptStamp && fs.existsSync(interceptStamp)) {
    n = parseInt(fs.readFileSync(interceptStamp, "utf8"), 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
  }
  if (n >= MAX_INTERCEPT) {
    logTelemetry(
      "stop",
      { parseOk: true, jobs: names, intercept: "none" },
      ws,
    );
    return 0;
  }

  const cwd = ws || process.cwd();
  const parts = [];
  for (const job of jobs) {
    let result;
    try {
      const jobCwd = job.cwd ? resolveJobCwd(job.cwd, cwd) : cwd;
      if (job.cwd && !jobCwd) {
        result = { fallback: true, text: "FALLBACK\n" };
      } else {
        result = runJob({
          job: job.job,
          query: job.query,
          cwd: jobCwd || cwd,
          path: job.path,
          glob: job.glob,
        });
      }
    } catch {
      result = { fallback: true, text: "FALLBACK\n" };
    }
    if (!result || result.fallback) {
      logTelemetry(
        "stop",
        {
          parseOk: true,
          jobs: names,
          intercept: "FALLBACK",
          query: job.query,
        },
        ws,
      );
      return 0;
    }
    parts.push(String(result.text || "").trimEnd());
  }
  if (interceptStamp) {
    fs.mkdirSync(path.dirname(interceptStamp), { recursive: true });
    fs.writeFileSync(interceptStamp, String(n + 1));
  }
  const reason = parts.join("\n");
  logTelemetry(
    "stop",
    { parseOk: true, jobs: names, intercept: "grunt-job" },
    ws,
  );
  emit({
    decision: "block",
    reason,
    hookSpecificOutput: {
      hookEventName,
      additionalContext: reason,
    },
  });
  return 0;
}

function looksLikeImplementation(msg) {
  if (typeof msg !== "string") return false;
  const t = msg;
  if (t.includes("```")) return true;
  if (/(?:^|\n)(?:diff --git |--- [^\n]+\n\+\+\+ |@@ )/.test(t)) return true;
  if (/\b(?:write|create|edit)[-_ ]file\b/i.test(t)) return true;
  const patchLines = t.split(/\n/).filter((l) => /^[+-](?![+-])/.test(l)).length;
  if (patchLines >= 8) return true;
  return false;
}

function isCheap(msg) {
  if (typeof msg !== "string") return false;
  const t = msg.trim();
  if (!t || t.length > 500) return false;
  if (t.includes("```")) return false;
  const sentences = t.split(/(?<=[.!?])(?:\s+|$)/).filter((s) => s.trim());
  if (sentences.length > 2) return false;
  const lines = t.split(/\n/).filter((l) => l.trim());
  return lines.length <= 4;
}

function stampPath(data, prefix) {
  const root =
    process.env.GROK_WORKSPACE_ROOT ||
    (data && (data.workspaceRoot || data.workspace_root)) ||
    "";
  const sid =
    process.env.GROK_SESSION_ID || (data && (data.sessionId || data.session_id)) || "";
  if (!root || !sid) return null;
  return path.join(root, ORCHESTRATOR_LOGS_DIR, prefix + "-" + sid);
}

function unlinkQuiet(p) {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch {
    // missing is fine
  }
}

function eventKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function readJsonValue() {
  let buf = Buffer.alloc(0);
  const tmp = Buffer.alloc(8192);
  for (;;) {
    let n;
    try {
      n = fs.readSync(0, tmp, 0, tmp.length, null);
    } catch {
      break;
    }
    if (n === 0) break;
    buf = Buffer.concat([buf, tmp.subarray(0, n)]);
    try {
      return JSON.parse(buf.toString("utf8"));
    } catch {
      // incomplete
    }
  }
  if (!buf.length) return undefined;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return undefined;
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === thisFile || import.meta.url === pathToFileURL(invoked).href) {
  process.exit(main());
}
