#!/usr/bin/env node
/** Inner generate/check/watch chain. Called by guarded-roots; not a public npm script. */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMMANDS = {
  generate: [
    "rulesync generate -t claudecode,codexcli,antigravity-cli,grokcli -f rules,subagents,skills",
    "rulesync generate -t claudecode,codexcli,antigravity-cli -f hooks",
    "node scripts/emit-mcp-policy.mjs",
    "node scripts/emit-gemini.mjs",
    "node scripts/emit-agent-shell-tools.mjs",
    "node scripts/emit-maps.mjs",
    "node scripts/hooks-union.mjs",
  ],
  check: [
    "rulesync generate -t claudecode,codexcli,antigravity-cli,grokcli -f rules,skills --check",
    "rulesync generate -t codexcli,antigravity-cli,grokcli -f subagents --check",
    "rulesync generate -t claudecode,codexcli,antigravity-cli -f hooks --check",
    "node scripts/emit-mcp-policy.mjs --check",
    "node scripts/emit-gemini.mjs --check",
    "node scripts/emit-agent-shell-tools.mjs --check",
    "node scripts/emit-maps.mjs --check",
    "node scripts/check-globals.mjs",
    "node scripts/hooks-union.mjs --check",
  ],
  watch: [
    "node scripts/emit-mcp-policy.mjs",
    "node scripts/emit-gemini.mjs",
    "node scripts/emit-agent-shell-tools.mjs",
    "rulesync generate -t claudecode,codexcli,antigravity-cli,grokcli -f rules,subagents,skills --watch",
  ],
};

export function envWithLocalBin(cwd, env = process.env) {
  const binDir = path.join(cwd, "node_modules", ".bin");
  const merged = { ...env };
  const key = Object.keys(merged).find((k) => k.toLowerCase() === "path") || "PATH";
  merged[key] = `${binDir}${path.delimiter}${merged[key] || ""}`;
  return merged;
}

export function runPipeline(mode, { cwd = process.cwd(), exec = execSync } = {}) {
  const cmds = COMMANDS[mode];
  if (!cmds) {
    throw new Error("usage: pipeline.mjs generate|check|watch");
  }
  const env = envWithLocalBin(cwd);
  for (const cmd of cmds) {
    exec(cmd, { cwd, stdio: "inherit", shell: true, env });
  }
}

function main() {
  try {
    runPipeline(process.argv[2] || "");
    return 0;
  } catch (err) {
    process.stderr.write((err && err.message ? err.message : String(err)) + "\n");
    return 1;
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === thisFile) process.exit(main());
