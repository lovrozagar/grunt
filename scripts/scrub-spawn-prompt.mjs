#!/usr/bin/env node
/** PreToolUse: intent-scrub spawn `prompt`. Fail-open: unchanged/error → empty stdout, exit 0. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scrubText } from "./scrub-text-lib.mjs";

const ALLOWED_TYPES = new Set(["grunt", "implementer", "thinker"]);
export const MAX_PROMPT_CHARS = 8000;
export const TRUNCATE_SUFFIX = "…[truncated]";
/** `router` is a legacy transcript prefix; keep matching it to strip old pastes. */
const TRANSCRIPT_PREFIX =
  /^\s*(?:\[(?:orchestrator|router|implementer|thinker|grunt)\]:|Human:|Assistant:)\s*/i;
const YOU_ARE_SUBAGENT =
  /^\s*You are (?:grunt|implementer|thinker) subagent\b/;
const VERDICT_LINE = /^\s*verdict:\s*/;

export function stripTranscripts(text) {
  const lines = String(text).split(/\n/);
  const out = [];
  let keptYouAre = false;
  for (const line of lines) {
    if (VERDICT_LINE.test(line)) {
      out.push(line);
      continue;
    }
    if (TRANSCRIPT_PREFIX.test(line)) continue;
    if (YOU_ARE_SUBAGENT.test(line)) {
      if (keptYouAre) continue;
      keptYouAre = true;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function extractVerdictBlocks(text) {
  const rawLines = String(text).split(/\n/);
  const lines = [];
  for (const line of rawLines) {
    const idx = line.search(/(?:^|\s)verdict:\s/);
    if (idx > 0) {
      const before = line.slice(0, idx).trimEnd();
      const after = line.slice(idx).trimStart();
      if (before) lines.push(before);
      lines.push(after);
    } else {
      lines.push(line);
    }
  }
  const body = [];
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (VERDICT_LINE.test(line)) {
      if (current) blocks.push(current.join("\n"));
      current = [line];
      continue;
    }
    if (current) {
      if (current.length < 8) current.push(line);
      else {
        blocks.push(current.join("\n"));
        current = null;
        body.push(line);
      }
      continue;
    }
    body.push(line);
  }
  if (current) blocks.push(current.join("\n"));
  return { body: body.join("\n"), blocks };
}

export function truncatePrompt(text, max = MAX_PROMPT_CHARS) {
  const s = String(text);
  if (s.length <= max) return s;
  const { body, blocks } = extractVerdictBlocks(s);
  const verdictPart = blocks.length ? "\n" + blocks.join("\n") : "";
  const budget = max - verdictPart.length - TRUNCATE_SUFFIX.length;
  const cut = Math.max(0, budget);
  return body.slice(0, cut) + TRUNCATE_SUFFIX + verdictPart;
}

const INLINE_TRANSCRIPT =
  /\s*(?:\[(?:orchestrator|router|implementer|thinker|grunt)\]:|Human:|Assistant:)\s*/gi;
const EXTRA_YOU_ARE =
  /\s*You are (?:grunt|implementer|thinker) subagent\b[^.]*\.?/g;

export function stripInlineTranscripts(text) {
  let s = String(text);
  const first = s.match(
    /^\s*You are (?:grunt|implementer|thinker) subagent\b[^.]*\.?\s*/,
  );
  const prefix = first ? first[0] : "";
  let rest = first ? s.slice(first[0].length) : s;
  rest = rest.replace(INLINE_TRANSCRIPT, " ");
  rest = rest.replace(EXTRA_YOU_ARE, " ");
  return (prefix + rest).replace(/[ \t]{2,}/g, " ").trim();
}

export function capSpawnPrompt(prompt) {
  let s = stripTranscripts(String(prompt));
  const extracted = extractVerdictBlocks(s);
  s = scrubText(extracted.body, { intent: true });
  s = stripTranscripts(s);
  s = stripInlineTranscripts(s);
  const again = extractVerdictBlocks(s);
  const blocks = extracted.blocks.concat(again.blocks);
  const verdictPart = blocks.length ? "\n" + blocks.join("\n") : "";
  const maxCore = Math.max(0, MAX_PROMPT_CHARS - verdictPart.length);
  let core = again.body;
  if (core.length > maxCore) {
    const cut = Math.max(0, maxCore - TRUNCATE_SUFFIX.length);
    core = core.slice(0, cut) + TRUNCATE_SUFFIX;
  }
  return (core + verdictPart).trim();
}

export function rewriteSpawnToolInput(toolInput, { defaultGrunt = false } = {}) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return defaultGrunt ? { subagent_type: "grunt" } : null;
  }

  const next = Object.assign({}, toolInput);
  let changed = false;

  if (defaultGrunt) {
    const cur =
      toolInput.subagent_type != null
        ? String(toolInput.subagent_type).trim()
        : toolInput.subagentType != null
          ? String(toolInput.subagentType).trim()
          : "";
    if (!ALLOWED_TYPES.has(cur)) {
      next.subagent_type = "grunt";
      if (Object.prototype.hasOwnProperty.call(toolInput, "subagentType")) {
        next.subagentType = "grunt";
      }
      changed = true;
    }
  }

  if (typeof next.prompt === "string") {
    const scrubbed = capSpawnPrompt(next.prompt);
    if (scrubbed !== next.prompt) {
      next.prompt = scrubbed;
      changed = true;
    }
  }

  return changed ? next : null;
}

export function grokDefaultGrunt() {
  return Boolean(process.env.GROK_HOOK_EVENT);
}

export function processHookPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  let toolInput = data.toolInput;
  if (toolInput == null) toolInput = data.tool_input;
  return rewriteSpawnToolInput(toolInput, {
    defaultGrunt: grokDefaultGrunt(),
  });
}

export function hookResponse(updated) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: updated,
    },
  };
}

function main() {
  try {
    const data = readJsonValue();
    const updated = processHookPayload(data);
    if (!updated) return 0;
    process.stdout.write(JSON.stringify(hookResponse(updated)));
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
