#!/usr/bin/env node
/** PreToolUse: fat Read/Grep/Glob/Bash gate. Fail-open: parse/crash → empty stdout, exit 0. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Parent Grep head_limit when the model omits one. */
export const DEFAULT_GREP_HEAD_LIMIT = 50;
/** Parent Read line limit when the model omits one. */
export const DEFAULT_READ_LIMIT = 200;
/** Implementer/thinker (and unknown non-grunt) Grep head_limit when omitted. */
export const CHILD_GREP_HEAD_LIMIT = 150;
/** Implementer/thinker (and unknown non-grunt) Read line limit when omitted. */
export const CHILD_READ_LIMIT = 400;
/** Deny if requested Grep head_limit or Read limit exceeds this. */
export const MAX_REQUEST_LIMIT = 500;
/** Deny Read when the file is larger than this, even with a line limit. */
export const DENY_FILE_BYTES = 200 * 1024;

export const DENY_PATH_SEGMENTS = new Set([
  "node_modules",
  "dist",
  ".next",
  "build",
  "coverage",
]);
export const DENY_LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

export const REASON_DENYLIST =
  "path denylist; use package API / spawn grunt job:search";
export const REASON_HEAD_LIMIT =
  "spawn grunt job:search; head_limit>500";
export const REASON_FILE_SIZE = "spawn grunt job:search; file >200KB";
export const REASON_IMPLEMENTER_BASH =
  "need: grunt job:exec|test query:…";

const READ_TOOLS = new Set(["read", "readfile"]);
const GREP_TOOLS = new Set(["grep", "grepsearch"]);
const GLOB_TOOLS = new Set(["glob", "listdir"]);
const BASH_TOOLS = new Set(["bash", "runterminalcommand"]);
const PATH_FIELDS = [
  "path",
  "file_path",
  "filePath",
  "target_file",
  "targetFile",
  "target_directory",
  "targetDirectory",
  "glob",
  "glob_pattern",
  "globPattern",
];
const BASH_DUMP_CMDS =
  /\b(cat|tac|less|more|head|tail|nl|bat|hexdump|xxd|rg|grep|egrep|fgrep|find|fd)\b/;
const BASH_SEARCH = /\b(rg|grep|egrep|fgrep|find|fd)\b/;
const BASH_WEB = /\b(curl|wget)\b/;
const BASH_TEST =
  /\b(?:npm|pnpm|yarn|bun)\s+test\b|\bcargo\s+test\b|\bpytest\b|\bvitest\b|\bjest\b/;
export const SHELL_META = /[|&;`$(){}<>\n\r]/;
const GRUNT_JOB_FLAGS = new Set(["--job", "--query", "--path", "--glob", "--cwd"]);

export function eventKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function subagentTypeOf(data) {
  if (!data || typeof data !== "object") return "";
  const raw =
    data.subagentType ??
    data.subagent_type ??
    data.agentType ??
    data.agent_type ??
    "";
  return String(raw).trim().toLowerCase();
}

export function isParentOrchestrator(data) {
  return !subagentTypeOf(data);
}

export function toolInputOf(data) {
  if (!data || typeof data !== "object") return null;
  let toolInput = data.toolInput;
  if (toolInput == null) toolInput = data.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return null;
  }
  return toolInput;
}

export function pathIsDenied(p) {
  if (p == null) return false;
  const n = String(p).replace(/\\/g, "/").trim();
  if (!n) return false;
  if (DENY_LOCKFILES.has(path.posix.basename(n))) return true;
  if (gitDirIn(n)) return true;
  return n.split("/").some((seg) => DENY_PATH_SEGMENTS.has(seg));
}

export function denyResponse(reason) {
  return {
    decision: "deny",
    reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

export function hookResponse(updated) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: updated,
    },
  };
}

export function workspaceRootOf(data) {
  return (
    process.env.GROK_WORKSPACE_ROOT ||
    (data && (data.workspaceRoot || data.workspace_root || data.cwd)) ||
    process.cwd()
  );
}

function asNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function requestedLimit(input, snake, camel) {
  return asNumber(input[snake] ?? input[camel]);
}

function hasLimitField(input, snake, camel) {
  return (
    Object.prototype.hasOwnProperty.call(input, snake) ||
    Object.prototype.hasOwnProperty.call(input, camel)
  );
}

function usesCamelInput(input) {
  return Object.keys(input).some(
    (k) =>
      k === "targetFile" ||
      k === "filePath" ||
      k === "headLimit" ||
      k === "targetDirectory" ||
      k === "globPattern" ||
      k === "ignoreGlobs",
  );
}

function setMissingLimit(next, input, snake, camel, value) {
  if (hasLimitField(input, snake, camel)) return false;
  if (usesCamelInput(input) && snake !== camel) next[camel] = value;
  else next[snake] = value;
  return true;
}

export const GLOB_IGNORE = [...DENY_PATH_SEGMENTS, ".git"];

function setMissingIgnore(next, input) {
  if (hasLimitField(input, "ignore", "ignoreGlobs")) return false;
  if (usesCamelInput(input)) next.ignoreGlobs = GLOB_IGNORE.slice();
  else next.ignore = GLOB_IGNORE.slice();
  return true;
}

function collectPathValues(input) {
  const out = [];
  for (const key of PATH_FIELDS) {
    const v = input[key];
    if (typeof v === "string" && v) out.push(v);
  }
  return out;
}

function readFilePath(input) {
  return (
    input.target_file ||
    input.file_path ||
    input.targetFile ||
    input.filePath ||
    ""
  );
}

export function resolveReadPath(filePath, data) {
  if (!filePath || typeof filePath !== "string") return null;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(workspaceRootOf(data), filePath);
}

export function fileSizeBytes(absPath) {
  if (!absPath) return null;
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return null;
    return st.size;
  } catch {
    return null;
  }
}

export function bashTargetsDenylist(command) {
  const cmd = String(command || "");
  if (!cmd.trim()) return false;
  if (!BASH_DUMP_CMDS.test(cmd) && !DENY_LOCKFILES_IN_CMD(cmd)) return false;
  if (DENY_LOCKFILES_IN_CMD(cmd) && BASH_DUMP_CMDS.test(cmd)) return true;
  if (gitDirIn(cmd) && BASH_DUMP_CMDS.test(cmd)) return true;
  for (const seg of DENY_PATH_SEGMENTS) {
    const re = new RegExp(
      `(^|[\\/\\s'"\`])${escapeRe(seg)}([\\/\\s'"\`]|$)`,
    );
    if (re.test(cmd) && BASH_DUMP_CMDS.test(cmd)) return true;
  }
  return false;
}

function gitDirIn(s) {
  return /(^|[\s/])\.git(\/|$)/.test(String(s).replace(/\\/g, "/"));
}

function DENY_LOCKFILES_IN_CMD(cmd) {
  return /\b(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)\b/.test(cmd);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function alreadyRtk(command) {
  const first = String(command || "")
    .trim()
    .split(/\s+/, 1)[0] || "";
  return first === "rtk" || first.endsWith("/rtk");
}

export function stripFlagValue(cmd, flag) {
  const f = escapeRe(flag);
  const val = `(?:"[^"]*"|'[^']*'|\\S+)`;
  return String(cmd || "")
    .replace(new RegExp(`${f}=${val}`, "g"), `${flag}=_`)
    .replace(new RegExp(`${f}\\s+${val}`, "g"), `${flag} _`);
}

function gruntJobRest(command, workspaceRoot) {
  const cmd = String(command || "").trim();
  if (!cmd || !workspaceRoot) return null;
  const parts = cmd.split(/\s+/).filter(Boolean);
  let i = 0;
  const first = parts[0] || "";
  if (first === "rtk" || first.endsWith("/rtk")) i = 1;
  const bin = parts[i] || "";
  if (bin !== "node" && !bin.endsWith("/node")) return null;
  i += 1;
  const scriptArg = parts[i];
  if (!scriptArg) return null;
  const abs = path.isAbsolute(scriptArg)
    ? path.resolve(scriptArg)
    : path.resolve(workspaceRoot, scriptArg);
  const expected = path.resolve(workspaceRoot, "scripts", "grunt-job.mjs");
  if (abs !== expected) return null;
  return parts.slice(i + 1);
}

/** True when argv targets workspace scripts/grunt-job.mjs (flags may be messy). */
export function isWorkspaceGruntJobScript(command, workspaceRoot) {
  return gruntJobRest(command, workspaceRoot) != null;
}

export function parseGruntJobCommand(command, workspaceRoot) {
  const cmd = String(command || "").trim();
  if (!cmd || !workspaceRoot) return null;
  if (SHELL_META.test(stripFlagValue(cmd, "--query"))) return null;
  const rest = gruntJobRest(cmd, workspaceRoot);
  if (!rest) return null;
  let job = "";
  let hasQuery = false;
  for (let j = 0; j < rest.length; j++) {
    const a = rest[j];
    let flag = a;
    let inline = false;
    if (typeof a === "string" && a.startsWith("--") && a.includes("=")) {
      flag = a.slice(0, a.indexOf("="));
      inline = true;
    }
    if (!GRUNT_JOB_FLAGS.has(flag)) return null;
    if (!inline) j += 1;
    if (flag === "--job") {
      job = String(inline ? a.slice(a.indexOf("=") + 1) : rest[j] || "").toLowerCase();
    } else if (flag === "--query") {
      hasQuery = true;
    }
  }
  return { job, hasQuery };
}

export function isWorkspaceGruntJob(command, workspaceRoot, allowedJobs) {
  const parsed = parseGruntJobCommand(command, workspaceRoot);
  if (!parsed || !parsed.hasQuery) return false;
  const allow = allowedJobs || ["search", "exec", "test"];
  return allow.includes(parsed.job);
}

export function implementerBashReason(command, workspaceRoot) {
  const cmd = String(command || "");
  if (bashTargetsDenylist(cmd)) return REASON_DENYLIST;
  if (alreadyRtk(cmd)) return null;
  if (isWorkspaceGruntJob(cmd, workspaceRoot, ["search", "exec", "test"])) {
    return null;
  }
  const wsGrunt = isWorkspaceGruntJobScript(cmd, workspaceRoot);
  if (BASH_WEB.test(cmd)) return REASON_IMPLEMENTER_BASH;
  if (!wsGrunt && (BASH_SEARCH.test(cmd) || BASH_TEST.test(cmd))) {
    return REASON_IMPLEMENTER_BASH;
  }
  return null;
}

/**
 * @returns {null | { type: "deny", reason: string } | { type: "rewrite", updatedInput: object }}
 */
export function processFatTools(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const toolKey = eventKey(data.toolName || data.tool_name || "");
  const input = toolInputOf(data);
  if (!input) return null;
  const sub = subagentTypeOf(data);
  if (sub === "grunt") return null;

  const parent = isParentOrchestrator(data);
  const isRead = READ_TOOLS.has(toolKey);
  const isGrep = GREP_TOOLS.has(toolKey);
  const isGlob = GLOB_TOOLS.has(toolKey);
  const isBash = BASH_TOOLS.has(toolKey);

  if (isRead || isGrep || isGlob) {
    for (const v of collectPathValues(input)) {
      if (pathIsDenied(v)) return { type: "deny", reason: REASON_DENYLIST };
    }
    if (isGlob) {
      const raw =
        input.target_directory ||
        input.targetDirectory ||
        input.path ||
        "";
      if (raw) {
        const abs = path.isAbsolute(raw)
          ? raw
          : path.resolve(workspaceRootOf(data), raw);
        if (pathIsDenied(abs) || pathIsDenied(path.basename(abs))) {
          return { type: "deny", reason: REASON_DENYLIST };
        }
      }
    }

    if (isGrep) {
      const n = requestedLimit(input, "head_limit", "headLimit");
      if (n != null && n > MAX_REQUEST_LIMIT) {
        return { type: "deny", reason: REASON_HEAD_LIMIT };
      }
    }
    if (isRead) {
      const n = requestedLimit(input, "limit", "limit");
      if (n != null && n > MAX_REQUEST_LIMIT) {
        return { type: "deny", reason: REASON_HEAD_LIMIT };
      }
      const abs = resolveReadPath(readFilePath(input), data);
      const size = fileSizeBytes(abs);
      if (size != null && size > DENY_FILE_BYTES) {
        return { type: "deny", reason: REASON_FILE_SIZE };
      }
    }

    const grepDefault = parent ? DEFAULT_GREP_HEAD_LIMIT : CHILD_GREP_HEAD_LIMIT;
    const readDefault = parent ? DEFAULT_READ_LIMIT : CHILD_READ_LIMIT;
    const next = Object.assign({}, input);
    let changed = false;
    if (isGrep) {
      changed =
        setMissingLimit(
          next,
          input,
          "head_limit",
          "headLimit",
          grepDefault,
        ) || changed;
    }
    if (isRead) {
      changed =
        setMissingLimit(
          next,
          input,
          "limit",
          "limit",
          readDefault,
        ) || changed;
    }
    if (isGlob) {
      changed = setMissingIgnore(next, input) || changed;
    }
    return changed ? { type: "rewrite", updatedInput: next } : null;
  }

  if (isBash) {
    const cmd = typeof input.command === "string" ? input.command : "";
    if (bashTargetsDenylist(cmd)) {
      return { type: "deny", reason: REASON_DENYLIST };
    }
    if (sub === "implementer") {
      const reason = implementerBashReason(cmd, workspaceRootOf(data));
      if (reason) return { type: "deny", reason };
    }
    return null;
  }

  return null;
}

export function fatHookOutput(result) {
  if (!result) return null;
  if (result.type === "deny") return denyResponse(result.reason);
  if (result.type === "rewrite") return hookResponse(result.updatedInput);
  return null;
}

export function processHookPayload(data) {
  return fatHookOutput(processFatTools(data));
}

function main() {
  try {
    const data = readJsonValue();
    const out = processHookPayload(data);
    if (!out) return 0;
    process.stdout.write(JSON.stringify(out));
    return 0;
  } catch {
    return 0;
  }
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
