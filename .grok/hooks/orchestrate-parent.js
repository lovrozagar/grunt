#!/usr/bin/env node
/** PreToolUse parent-deny on Claude+Grok+Antigravity; Stop = first-non-empty-line recap; stop-block survives host banners; SubagentStop is single-registration intercept.
Parent Read/Grep/Glob/Bash/Web denied unless parent-escape (fat-gate still).
SubagentStop intercepts need: search|exec with grunt-job facts.
Stop: first-non-empty-line [orchestrator]:/[grunt]:/[implementer]:/[thinker]:/[handoff]:/[tmp]: recap
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
  isWorkspaceGruntJob,
  isParentOrchestrator,
  processFatTools,
  rewriteGruntScratchPath,
  subagentTypeOf,
} from "../../scripts/gate-fat-tools.mjs";
import { persistPlan } from "../../scripts/persist-plan.mjs";
import { persistHandoff } from "../../scripts/persist-handoff.mjs";
import { persistTmp } from "../../scripts/persist-tmp.mjs";
import { parseNeed } from "../../scripts/parse-need.mjs";
import { resolveJobCwd, runJob } from "../../scripts/grunt-job.mjs";
import { loadLeftoverGate, loadSpawnMode } from "../../scripts/grunt-config.mjs";

export const ORCHESTRATOR_LOGS_DIR = ".tmp/grunt/orchestrator-logs";
/** One-release dual-read; drop next release. */
export const LEGACY_ORCHESTRATOR_LOGS_DIR = ".tmp/orchestrator-logs";
export const DENY_REASON =
  "First action=spawn implementer|grunt|thinker. Deny expected. Only effective spawnMode=solo this session escapes.";
export const STOP_REASONS = [
  "Spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` tagged recap; advise leftover numbered pick each on own line after (echo printed leftover; always-print typed triple).",
  "Still spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` tagged recap; advise leftover numbered pick each on own line after (echo printed leftover; always-print typed triple).",
  "Last spawn: ⚠/validate/sim findings or writes remain after Implement pick/`/implement-plan`/explicit implement or parent just tried to Write → spawn implementer. Else facts → grunt. Else no spec/not small/simple → thinker then recap-stop. Else small/simple/defined → implementer. Thinker recap ≠ spec-ready. `ok`/`yes` ≠ implement. Else recap `[orchestrator]:` tagged recap; advise leftover numbered pick each on own line after (echo printed leftover; always-print typed triple).",
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
export const PARENT_SKILLS = new Set([
  "parent",
  "explain",
  "solo",
  "cascade",
  "auto",
  "ask",
  "handoff",
  "tmp",
  "pickup",
  "write-plan",
  "implement-plan",
]);
const INTERCEPT_JOBS = new Set(["search", "exec"]);
const MAX_STOP = 3;
const MAX_INTERCEPT = 3;
/** `/solo` enters single-agent mode; `/cascade` restores the orchestrator. */
const SOLO_RE = /^\s*\/solo\s*$/;
const CASCADE_RE = /^\s*\/cascade\s*$/;
const AUTO_RE = /^\s*\/auto\s*$/;
const ASK_RE = /^\s*\/ask\s*$/;
const SOLO_STAMP = "grunt-off";
export const AUTO_ASK_STAMP = "auto-ask";
export const SPAWN_MODE_STAMP = "spawn-mode";


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

/** Session flag, not one-turn. Fail-closed: unreadable spawn-mode stamp is not solo. */
export function isSoloMode(data) {
  try {
    return spawnModeOf(data) === "solo";
  } catch {
    return false;
  }
}

function hasParentEscape(data) {
  return Boolean(resolveStamp(data, "parent-escape"));
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
  return isUnderDir(filePath, workspaceRoot, [".tmp", "grunt", "plans"]);
}

export function isUnderHandoffs(filePath, workspaceRoot) {
  return isUnderDir(filePath, workspaceRoot, [".tmp", "grunt", "handoffs"]);
}

export const TMP_RESERVED_DIRS = new Set([
  "plans",
  "handoffs",
  "browser",
  "orchestrator-logs",
]);

export function isUnderTmp(filePath, workspaceRoot) {
  if (!filePath || !workspaceRoot) return false;
  const abs = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspaceRoot, filePath);
  const root = path.resolve(workspaceRoot, ".tmp", "grunt");
  if (path.dirname(abs) !== root) return false;
  return !TMP_RESERVED_DIRS.has(path.basename(abs));
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
  let persist;
  let invalid = "invalid plan";
  if (isUnderPlans(rawPath, ws)) {
    persist = persistPlan;
    invalid = "invalid plan";
  } else if (isUnderHandoffs(rawPath, ws)) {
    persist = persistHandoff;
    invalid = "invalid handoff";
  } else if (isUnderTmp(rawPath, ws)) {
    persist = persistTmp;
    invalid = "invalid tmp";
  } else {
    if (hasParentEscape(data)) {
      emit({ decision: "allow" });
      return 0;
    }
    emit({ decision: "deny", reason: DENY_REASON });
    return 0;
  }
  const content = typeof toolInput.content === "string" ? toolInput.content : "";
  const result = persist({ workspaceRoot: ws, content });
  if (!result.ok) {
    emit({
      decision: "deny",
      reason: result.error || invalid,
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
  writeStamp(data, "tools-used", "1");
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
  unlinkStamp(data, "tools-used");
  const prompt = userPromptOf(data);
  if (!isHostStopBanner(prompt)) {
    unlinkStamp(data, "stop-block");
  }
  // Sticky: only exact /solo and /cascade move spawn-mode. Always unlink grunt-off.
  if (SOLO_RE.test(prompt) || CASCADE_RE.test(prompt)) {
    const token = SOLO_RE.test(prompt) ? "solo" : "cascade";
    const cfg = loadSpawnMode(workspaceRootOf(data));
    if (token === cfg) {
      unlinkSpawnModeStamp(data);
    } else {
      writeSpawnModeStamp(data, token);
    }
    unlinkSoloStamp(data);
  }
  if (AUTO_RE.test(prompt) || ASK_RE.test(prompt)) {
    const token = AUTO_RE.test(prompt) ? "auto" : "ask";
    const cfg = loadLeftoverGate(workspaceRootOf(data));
    if (token === cfg) {
      unlinkAutoAskStamp(data);
    } else {
      writeAutoAskStamp(data, token);
    }
  }
  if (isParentEscapePrompt(prompt)) {
    writeStamp(data, "parent-escape", "1");
  } else {
    unlinkStamp(data, "parent-escape");
  }
  if (isHostStopBanner(prompt)) return 0;
  emit({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: effectiveGruntContext(data),
    },
  });
  return 0;
}

const RECAP_TAG_RE =
  /^\[(?:orchestrator|grunt|implementer|thinker|handoff|tmp)\]:/;
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

function nonemptyLines(msg) {
  return String(msg || "")
    .split("\n")
    .filter((l) => l.trim());
}

/** Format-only leftover triple. No leftover-number → skill map. */
export function hasLeftoverTriple(msg) {
  const lines = String(msg || "")
    .split("\n")
    .map((l) => l.replace(/^[\s`*_>]+/, "").trim());
  const hit = (re) => lines.some((l) => re.test(l));
  const tweak = hit(/^3\.\s+Tweak$/);
  const impl =
    hit(/^1\.\s+Implement with verbal plan$/) &&
    hit(/^2\.\s+Implement with file plan$/);
  const write =
    hit(/^1\.\s+Write with verbal plan$/) &&
    hit(/^2\.\s+Write with file plan$/);
  return Boolean(tweak && (impl || write));
}

/** Ask leftover-required: any `[thinker]:`; `[orchestrator]:` iff >1 nonempty line (except exact wait-grunt); `[grunt]|[implementer]|[handoff]|[tmp]:` exempt. Auto waives in Stop. */
export function leftoverRequiredAsk(msg) {
  if (isWaitGruntExact(msg)) return false;
  const first = firstNonEmptyStripped(msg);
  if (/^\[(?:grunt|implementer|handoff|tmp)\]:/.test(first)) return false;
  if (/^\[thinker\]:/.test(first)) return true;
  if (/^\[orchestrator\]:/.test(first)) return nonemptyLines(msg).length > 1;
  return false;
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

function stop(data) {
  if (data.subagentType || data.subagent_type) {
    return interceptNeed(data, "Stop");
  }
  if (data.stopHookActive || data.stop_hook_active) {
    return 0;
  }
  const reason = String(data.reason || "");
  if (reason && reason !== "end_turn") return 0;

  // Before the parent-escape consume: solo must never burn the one-turn stamp.
  if (isSoloMode(data)) return 0;

  if (resolveStamp(data, "parent-escape")) {
    unlinkStamp(data, "parent-escape");
    return 0;
  }

  const payloadMsg = payloadAssistantMessage(data);
  let msg = payloadMsg;
  if (!msg) {
    const tp = data.transcript_path || data.transcriptPath || "";
    msg = lastAssistantFromTranscript(tp);
  }

  const waitFirst = firstNonEmptyStripped(msg) === WAIT_GRUNT;
  if (waitFirst && !isWaitGruntExact(msg)) {
    // fall through to block — leftover lines not allowed on mid-turn wait
  } else if (isRecap(msg)) {
    if (
      leftoverGateOf(data) !== "auto" &&
      leftoverRequiredAsk(msg) &&
      !hasLeftoverTriple(msg)
    ) {
      // fall through to block — leftover-required under ask
    } else {
      return 0;
    }
  }

  let n = readStampInt(data, "stop-block");
  if (n >= MAX_STOP) {
    return 0;
  }
  writeStamp(data, "stop-block", String(n + 1));
  const reasonText = STOP_REASONS[Math.min(n, STOP_REASONS.length - 1)];
  emit({ decision: "block", reason: reasonText });
  return 0;
}

function interceptNeed(data, hookEventName) {
  const ws = workspaceRootOf(data);
  if (data.stopHookActive || data.stop_hook_active) {
    return 0;
  }
  const msg = data.lastAssistantMessage || data.last_assistant_message || "";
  const parsed = parseNeed(msg);
  if (!parsed.ok) {
    return 0;
  }
  const jobs = parsed.jobs;
  if (
    jobs.length > 4 ||
    !jobs.every((j) => INTERCEPT_JOBS.has(j.job))
  ) {
    return 0;
  }

  let n = readStampInt(data, "need-intercept");
  if (n >= MAX_INTERCEPT) {
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
      return 0;
    }
    parts.push(String(result.text || "").trimEnd());
  }
  writeStamp(data, "need-intercept", String(n + 1));
  const reason = parts.join("\n");
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

function legacyStampPath(data, prefix) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data) || "default";
  if (!root) return null;
  return path.join(root, LEGACY_ORCHESTRATOR_LOGS_DIR, prefix + "-" + sid);
}

function resolveStamp(data, prefix) {
  const neu = stampPath(data, prefix);
  if (neu && fs.existsSync(neu)) return neu;
  const old = legacyStampPath(data, prefix);
  if (old && fs.existsSync(old)) return old;
  return null;
}

function writeStamp(data, prefix, body) {
  const p = stampPath(data, prefix);
  if (!p) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function unlinkStamp(data, prefix) {
  unlinkQuiet(stampPath(data, prefix));
  unlinkQuiet(legacyStampPath(data, prefix));
}

function readStampInt(data, prefix) {
  const p = resolveStamp(data, prefix);
  if (!p) return 0;
  const n = parseInt(fs.readFileSync(p, "utf8"), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
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

function legacySoloStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, LEGACY_ORCHESTRATOR_LOGS_DIR, SOLO_STAMP + "-" + sid);
}

function resolveSoloStamp(data) {
  const neu = soloStampPath(data);
  if (neu && fs.existsSync(neu)) return neu;
  const old = legacySoloStampPath(data);
  if (old && fs.existsSync(old)) return old;
  return null;
}

function unlinkSoloStamp(data) {
  unlinkQuiet(soloStampPath(data));
  unlinkQuiet(legacySoloStampPath(data));
}

/** Spawn-mode stamp: never share a `default` stamp across sid-less sessions. */
export function spawnModeStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, ORCHESTRATOR_LOGS_DIR, SPAWN_MODE_STAMP + "-" + sid);
}

function legacySpawnModeStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, LEGACY_ORCHESTRATOR_LOGS_DIR, SPAWN_MODE_STAMP + "-" + sid);
}

function resolveSpawnModeStamp(data) {
  const neu = spawnModeStampPath(data);
  if (neu && fs.existsSync(neu)) return neu;
  const old = legacySpawnModeStampPath(data);
  if (old && fs.existsSync(old)) return old;
  return null;
}

function writeSpawnModeStamp(data, body) {
  const p = spawnModeStampPath(data);
  if (!p) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function unlinkSpawnModeStamp(data) {
  unlinkQuiet(spawnModeStampPath(data));
  unlinkQuiet(legacySpawnModeStampPath(data));
}

/** Valid stamp solo|cascade wins; else grunt-off presence as solo; else config. Unreadable/bad body ignored. */
export function spawnModeOf(data) {
  try {
    const p = resolveSpawnModeStamp(data);
    if (p) {
      const body = fs.readFileSync(p, "utf8").trim();
      if (body === "solo" || body === "cascade") return body;
    }
  } catch {
    // unreadable stamp → fall through
  }
  if (resolveSoloStamp(data)) return "solo";
  return loadSpawnMode(workspaceRootOf(data));
}

/** Leftover-gate stamp: never share a `default` stamp across sid-less sessions. */
export function autoAskStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, ORCHESTRATOR_LOGS_DIR, AUTO_ASK_STAMP + "-" + sid);
}

function legacyAutoAskStampPath(data) {
  const root = workspaceRootOf(data);
  const sid = sessionIdOf(data);
  if (!root || !sid) return null;
  return path.join(root, LEGACY_ORCHESTRATOR_LOGS_DIR, AUTO_ASK_STAMP + "-" + sid);
}

function resolveAutoAskStamp(data) {
  const neu = autoAskStampPath(data);
  if (neu && fs.existsSync(neu)) return neu;
  const old = legacyAutoAskStampPath(data);
  if (old && fs.existsSync(old)) return old;
  return null;
}

function writeAutoAskStamp(data, body) {
  const p = autoAskStampPath(data);
  if (!p) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}

function unlinkAutoAskStamp(data) {
  unlinkQuiet(autoAskStampPath(data));
  unlinkQuiet(legacyAutoAskStampPath(data));
}

/** Stamp body auto|ask wins; else config; else ask. Bad stamp body ignored. */
export function leftoverGateOf(data) {
  try {
    const p = resolveAutoAskStamp(data);
    if (p) {
      const body = fs.readFileSync(p, "utf8").trim();
      if (body === "auto" || body === "ask") return body;
    }
  } catch {
    // unreadable stamp → fall through
  }
  return loadLeftoverGate(workspaceRootOf(data));
}

/** One-line UserPromptSubmit additionalContext from effective spawnMode + leftoverGate. */
export function effectiveGruntContext(data) {
  return (
    "Effective grunt: spawnMode=" +
    spawnModeOf(data) +
    " leftoverGate=" +
    leftoverGateOf(data) +
    ". solo = no spawn-first spawn-if-asked parent tools on. cascade = first token spawn."
  );
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
