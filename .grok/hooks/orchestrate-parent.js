#!/usr/bin/env node
/** Parent-orchestrator gate: spawn/peek/kill/todo + persistPlan/persistHandoff writes.
Parent Read/Grep/Glob/Bash/Web denied unless parent-escape (fat-gate still).
SubagentStop intercepts need: search|exec with grunt-job verdicts.
Stop: [agent]:/[handoff]: recap | parent-escape once; else block. MAX_STOP=3. No isCheap/trivia.
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
import { persistHandoff } from "../../scripts/persist-handoff.mjs";
import { parseNeed } from "../../scripts/parse-need.mjs";
import { resolveJobCwd, runJob } from "../../scripts/grunt-job.mjs";
import { logTelemetry, ORCHESTRATOR_LOGS_DIR } from "../../scripts/telemetry.mjs";

const DENY_REASON = "parent is orchestrator; spawn grunt|implementer|thinker";
const STOP_REASONS = [
  "Violation: parent replied without a [agent]: recap or /parent escape.\n" +
    "DO NOT stop. Continue IN THIS RESPONSE:\n" +
    "1. Spawn grunt|implementer|thinker for the pending work.\n" +
    "2. Reply with the `[agent]:` recap only.\n" +
    "If every spawned child already returned and the turn is done, reply with the `[agent]:` recap now.\n" +
    "If context is long, use /handoff.",
  "Second violation: still no [agent]: recap.\n" +
    "DO NOT stop. Right now, in this same response:\n" +
    "1. Spawn grunt|implementer|thinker.\n" +
    "2. Then reply with only the `[agent]:` recap line.\n" +
    "Already done and every child returned? Send the `[agent]:` recap immediately.\n" +
    "Context too long? Use /handoff.",
  "Third violation: recap still missing.\n" +
    "This is the last check before fail-open. DO NOT stop:\n" +
    "1. Spawn the correct agent for the remaining work.\n" +
    "2. Reply with `[agent]:` recap only, nothing else.\n" +
    "Complete with all children returned? Send the recap now.\n" +
    "Long context? Use /handoff.",
];
const PARENT_TOOLS = new Set([
  "todowrite",
  "getcommandorsubagentoutput",
  "gettaskoutput",
  "killcommandorsubagent",
  "killtask",
]);
const SPAWN_TOOLS = new Set([
  "spawnsubagent",
  "task",
  "agent",
  "spawnagent",
]);
const WRITE_TOOLS = new Set(["write"]);
const READ_TOOLS = new Set(["readfile", "read"]);
const INTERCEPT_JOBS = new Set(["search", "exec"]);
const MAX_STOP = 3;
const MAX_INTERCEPT = 3;
/** `/solo` enters single-agent mode; `/cascade` restores the orchestrator. */
const SOLO_RE = /^\s*\/solo\s*$/;
const CASCADE_RE = /^\s*\/cascade\s*$/;
const SOLO_STAMP = "grunt-off";


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
  if (isSoloMode(data)) {
    // Single-agent session: no parent-deny, no spawn rewrite. Fat gate still applies.
    const fatCode = emitFat(data);
    if (fatCode !== null) return fatCode;
    emit({ decision: "allow" });
    return 0;
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
  if (PARENT_TOOLS.has(toolKey)) {
    emit({ decision: "allow" });
    return 0;
  }
  if (hasParentEscape(data)) {
    const fatCode = emitFat(data);
    if (fatCode !== null) return fatCode;
    emit({ decision: "allow" });
    return 0;
  }
  emit({ decision: "deny", reason: DENY_REASON });
  return 0;
}

/** Session flag, not one-turn. Fail-closed: an unreadable stamp keeps grunt on. */
export function isSoloMode(data) {
  try {
    const p = soloStampPath(data);
    return Boolean(p && fs.existsSync(p));
  } catch {
    return false;
  }
}

function hasParentEscape(data) {
  const p = stampPath(data, "parent-escape");
  return Boolean(p && fs.existsSync(p));
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
    (data && (data.workspaceRoot || data.workspace_root)) ||
    (data && data.cwd) ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd() ||
    ""
  );
}

function isUnderDir(filePath, workspaceRoot, segments) {
  if (!filePath || !workspaceRoot) return false;
  const abs = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspaceRoot, filePath);
  const dir = path.resolve(workspaceRoot, ...segments);
  const rel = path.relative(dir, abs);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function isUnderPlans(filePath, workspaceRoot) {
  return isUnderDir(filePath, workspaceRoot, [".tmp", "plans"]);
}

export function isUnderHandoffs(filePath, workspaceRoot) {
  return isUnderDir(filePath, workspaceRoot, [".tmp", "grunt", "handoffs"]);
}

export function isAllowedParentGruntJob(command, workspaceRoot) {
  return isWorkspaceGruntJob(command, workspaceRoot, ["search", "exec"]);
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
  const handoff = isUnderHandoffs(rawPath, ws);
  if (!handoff && !isUnderPlans(rawPath, ws)) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const content = typeof toolInput.content === "string" ? toolInput.content : "";
  const persist = handoff ? persistHandoff : persistPlan;
  const result = persist({ workspaceRoot: ws, content });
  if (!result.ok) {
    emit({
      decision: "deny",
      reason: result.error || (handoff ? "invalid handoff" : "invalid plan"),
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
  const prompt = userPromptOf(data);
  // Sticky: only /solo and /cascade move it. Every other prompt leaves it alone.
  if (SOLO_RE.test(prompt)) {
    const solo = soloStampPath(data);
    if (solo) {
      fs.mkdirSync(path.dirname(solo), { recursive: true });
      fs.writeFileSync(solo, "1");
    }
  } else if (CASCADE_RE.test(prompt)) {
    unlinkQuiet(soloStampPath(data));
  }
  if (isParentEscapePrompt(prompt)) {
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
  const lines = String(msg || "").split("\n");
  let firstNonEmpty = "";
  for (const line of lines) {
    if (line.trim() !== "") {
      firstNonEmpty = line;
      break;
    }
  }
  const stripped = firstNonEmpty.replace(/^[\s`*_>]+/, "");
  return /^\[(?:grunt|implementer|thinker|handoff)\]:/.test(stripped);
}

function stop(data) {
  if (data.subagentType || data.subagent_type) {
    return interceptNeed(data, "Stop");
  }
  if (data.stopHookActive || data.stop_hook_active) return 0;
  const reason = String(data.reason || "");
  if (reason && reason !== "end_turn") return 0;

  // Before the parent-escape consume: solo must never burn the one-turn stamp.
  if (isSoloMode(data)) return 0;

  const escapeStamp = stampPath(data, "parent-escape");
  if (escapeStamp && fs.existsSync(escapeStamp)) {
    unlinkQuiet(escapeStamp);
    return 0;
  }

  const msg = data.lastAssistantMessage || data.last_assistant_message || "";
  if (isChildRecap(msg)) return 0;

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
  const reasonText = STOP_REASONS[Math.min(n, STOP_REASONS.length - 1)];
  emit({ decision: "block", reason: reasonText });
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
    hookSpecificOutput: {
      hookEventName,
      additionalContext: reason,
    },
  });
  return 0;
}

function stampPath(data, prefix) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data) || "default";
  if (!root) return null;
  return path.join(root, ORCHESTRATOR_LOGS_DIR, prefix + "-" + sid);
}

function sessionIdOf(data) {
  return String(
    process.env.GROK_SESSION_ID ||
      (data && (data.sessionId || data.session_id)) ||
      "",
  );
}

/** Solo is a mode: never share a `default` stamp across sid-less sessions. */
function soloStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, ORCHESTRATOR_LOGS_DIR, SOLO_STAMP + "-" + sid);
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
