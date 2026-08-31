#!/usr/bin/env node
/** PreToolUse parent-deny on Claude+Grok+Antigravity; Stop = first-non-empty-line recap; stop-block survives host banners; SubagentStop is single-registration intercept.
Parent Read/Grep/Glob/Bash/Web denied unless parent-escape (fat-gate still).
SubagentStop intercepts need: search|exec with grunt-job verdicts.
Stop: first-non-empty-line [orchestrator]:/[grunt]:/[implementer]:/[thinker]:/[handoff]: recap
| parent-escape once; else block. MAX_STOP=3. No isCheap/trivia.
Empty lastAssistantMessage → transcript_path tail-scan. Fail-open: parse/crash → empty stdout, exit 0.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MAX_PROMPT_CHARS,
  rewriteSpawnToolInput,
  spawnCapReason,
} from "../../scripts/scrub-spawn-prompt.mjs";
import {
  denyResponse,
  fatHookOutput,
  fileSizeBytes,
  isWorkspaceGruntJob,
  isParentOrchestrator,
  processFatTools,
  resolveReadPath,
  rewriteGruntScratchPath,
  subagentTypeOf,
} from "../../scripts/gate-fat-tools.mjs";
import { persistPlan } from "../../scripts/persist-plan.mjs";
import { persistHandoff } from "../../scripts/persist-handoff.mjs";
import { parseNeed } from "../../scripts/parse-need.mjs";
import { resolveJobCwd, runJob } from "../../scripts/grunt-job.mjs";
import { logTelemetry, ORCHESTRATOR_LOGS_DIR } from "../../scripts/telemetry.mjs";

export const DENY_REASON =
  "First action=spawn implementer|grunt|thinker. Deny expected. Only /solo this session escapes.";
export const STOP_REASONS = [
  "Spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` one recap line; advise leftover 1./2. each on own line after.",
  "Still spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` one recap line; advise leftover 1./2. each on own line after.",
  "Last spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` one recap line; advise leftover 1./2. each on own line after.",
];
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;
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
const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "searchreplace",
  "replacefilecontent",
]);
const BASH_TOOLS = new Set(["bash", "runterminalcommand", "runcommand"]);
const SKILL_TOOLS = new Set(["skill"]);
const PARENT_SKILLS = new Set([
  "parent",
  "explain",
  "solo",
  "cascade",
  "handoff",
  "pickup",
  "write-plan",
  "implement-plan",
]);
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
  if (sub || !isParentOrchestrator(data)) {
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
    const updated = rewriteSpawn(toolInput, data);
    if (updated && updated.__denied) return 0;
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
  if (BASH_TOOLS.has(toolKey) && isAllowedParentGruntJob(bashCommandOf(toolInput), workspaceRootOf(data))) {
    emit({ decision: "allow" });
    return 0;
  }
  if (SKILL_TOOLS.has(toolKey) && isAllowedParentSkill(toolInput)) {
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

function bashCommandOf(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return "";
  }
  return String(toolInput.command ?? toolInput.cmd ?? "");
}

function skillNameOf(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return "";
  }
  const raw =
    toolInput.skill ??
    toolInput.skill_name ??
    toolInput.skillName ??
    toolInput.name ??
    "";
  const s = String(raw).trim().toLowerCase().replace(/\\/g, "/");
  const base = s.split("/").pop() || "";
  return base.replace(/\.md$/, "").replace(/_/g, "-");
}

export function isAllowedParentSkill(toolInput) {
  return PARENT_SKILLS.has(skillNameOf(toolInput));
}

function isHostStopBanner(prompt) {
  const p = String(prompt || "");
  if (/^\s*Stop hook feedback:/.test(p)) return true;
  if (/Blocked by stop hook/.test(p)) return true;
  if (/task[-_ ]?notification/i.test(p)) return true;
  return false;
}

function parentWrite(data, toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const ws = workspaceRootOf(data);
  let rawPath =
    toolInput.file_path ||
    toolInput.filePath ||
    toolInput.path ||
    toolInput.target_file ||
    "";
  const rewritten = rewriteGruntScratchPath(rawPath, ws);
  if (rewritten) rawPath = rewritten;
  const handoff = isUnderHandoffs(rawPath, ws);
  if (!handoff && !isUnderPlans(rawPath, ws)) {
    if (hasParentEscape(data)) {
      emit({ decision: "allow" });
      return 0;
    }
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

function rewriteSpawn(toolInput, data) {
  // Type default + intent-scrub in one updatedInput (last-wins with scrub-spawn).
  const updated = rewriteSpawnToolInput(toolInput, { defaultGrunt: true });
  const prompt =
    updated && typeof updated.prompt === "string"
      ? updated.prompt
      : toolInput && typeof toolInput.prompt === "string"
        ? toolInput.prompt
        : "";
  if (prompt.length > MAX_PROMPT_CHARS) {
    emit(denyResponse(spawnCapReason(workspaceRootOf(data))));
    return { __denied: true };
  }
  return updated;
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
  const prompt = userPromptOf(data);
  if (!isHostStopBanner(prompt)) {
    unlinkQuiet(stampPath(data, "stop-block"));
  }
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

const RECAP_TAG_RE =
  /^\[(?:orchestrator|grunt|implementer|thinker|handoff)\]:/;
const WAIT_GRUNT = "[orchestrator]: wait grunt";

function firstNonEmptyStripped(msg) {
  for (const line of String(msg || "").split("\n")) {
    if (!line.trim()) continue;
    return line.replace(/^[\s`*_>]+/, "");
  }
  return "";
}

export function isRecap(msg) {
  return RECAP_TAG_RE.test(firstNonEmptyStripped(msg));
}

/** Mid-turn wait must be exactly `[orchestrator]: wait grunt` (no leftover lines). */
export function isWaitGruntExact(msg) {
  const nonempty = String(msg || "")
    .split("\n")
    .filter((l) => l.trim());
  if (nonempty.length !== 1) return false;
  return nonempty[0].replace(/^[\s`*_>]+/, "") === WAIT_GRUNT;
}

function payloadAssistantMessage(data) {
  if (!data || typeof data !== "object") return "";
  const camel = data.lastAssistantMessage;
  if (camel != null && String(camel) !== "") return String(camel);
  const snake = data.last_assistant_message;
  if (snake != null && String(snake) !== "") return String(snake);
  return "";
}

function isAssistantRecord(obj) {
  if (!obj || typeof obj !== "object") return false;
  const type = String(obj.type || "").toLowerCase();
  if (type === "user" || type === "human" || type === "tool" || type === "tool_result") {
    return false;
  }
  if (type === "assistant") return true;
  const role = String(
    obj.role || (obj.message && obj.message.role) || "",
  ).toLowerCase();
  if (role === "user" || role === "human") return false;
  return role === "assistant";
}

function assistantTextFromRecord(obj) {
  if (!isAssistantRecord(obj)) return null;
  const msg = obj.message && typeof obj.message === "object" ? obj.message : obj;
  const content = msg.content ?? obj.content;
  if (Array.isArray(content)) {
    const texts = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const pt = String(part.type || "");
      if (pt === "tool_use" || pt === "tool_result" || pt === "function_call") continue;
      if (typeof part.text === "string" && part.text) texts.push(part.text);
    }
    const joined = texts.join("\n").trim();
    return joined ? joined : null;
  }
  if (typeof content === "string" && content.trim()) return content;
  if (typeof obj.text === "string" && obj.text.trim()) return obj.text;
  return null;
}

export function lastAssistantFromTranscript(filePath) {
  try {
    if (!filePath) return "";
    const st = fs.statSync(filePath);
    const start = Math.max(0, st.size - TRANSCRIPT_TAIL_BYTES);
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(st.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      const text = buf.toString("utf8");
      const lines = text.split("\n");
      if (start > 0 && lines.length) lines.shift();
      let last = "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let rec;
        try {
          rec = JSON.parse(t);
        } catch {
          continue;
        }
        const extracted = assistantTextFromRecord(rec);
        if (extracted) last = extracted;
      }
      return last;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function logParentStop(data, fields) {
  logTelemetry("parent-stop", fields, workspaceRootOf(data));
}

function stop(data) {
  if (data.subagentType || data.subagent_type) {
    return interceptNeed(data, "Stop");
  }
  if (data.stopHookActive || data.stop_hook_active) {
    logParentStop(data, {
      recap: false,
      recapSource: "none",
      attempt: 0,
      failOpen: true,
      stopHookActive: true,
    });
    return 0;
  }
  const reason = String(data.reason || "");
  if (reason && reason !== "end_turn") return 0;

  // Before the parent-escape consume: solo must never burn the one-turn stamp.
  if (isSoloMode(data)) return 0;

  const escapeStamp = stampPath(data, "parent-escape");
  if (escapeStamp && fs.existsSync(escapeStamp)) {
    unlinkQuiet(escapeStamp);
    return 0;
  }

  const payloadMsg = payloadAssistantMessage(data);
  let recapSource = "none";
  let msg = "";
  if (payloadMsg) {
    msg = payloadMsg;
    recapSource = "payload";
  } else {
    const tp = data.transcript_path || data.transcriptPath || "";
    msg = lastAssistantFromTranscript(tp);
    if (msg) recapSource = "transcript";
  }

  const waitFirst = firstNonEmptyStripped(msg) === WAIT_GRUNT;
  if (waitFirst && !isWaitGruntExact(msg)) {
    // fall through to block — leftover lines not allowed on mid-turn wait
  } else if (isRecap(msg)) {
    logParentStop(data, {
      recap: true,
      recapSource,
      attempt: 0,
      failOpen: false,
      stopHookActive: false,
    });
    return 0;
  }

  const stopStamp = stampPath(data, "stop-block");
  let n = 0;
  if (stopStamp && fs.existsSync(stopStamp)) {
    n = parseInt(fs.readFileSync(stopStamp, "utf8"), 10);
    if (!Number.isFinite(n) || n < 0) n = 0;
  }
  if (n >= MAX_STOP) {
    logParentStop(data, {
      recap: false,
      recapSource,
      attempt: n,
      failOpen: true,
      stopHookActive: false,
    });
    return 0;
  }
  if (stopStamp) {
    fs.mkdirSync(path.dirname(stopStamp), { recursive: true });
    fs.writeFileSync(stopStamp, String(n + 1));
  }
  logParentStop(data, {
    recap: false,
    recapSource,
    attempt: n + 1,
    failOpen: false,
    stopHookActive: false,
  });
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
