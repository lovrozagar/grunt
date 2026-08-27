import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.hoisted(() => vi.fn());
const execFileSync = vi.hoisted(() => vi.fn());

vi.mock("./init.mjs", () => ({ init }));
vi.mock("node:child_process", () => ({ execFileSync }));

import { start } from "./grunt.mjs";

const USAGE = `Usage: grunt [command]

Default (no command): init — full setup

Commands:
  init       Full setup: merge SoT, npm install, rulesync:generate, sync:globals:apply, rulesync:check
  generate   npm run rulesync:generate
  check      npm run rulesync:check
  help       Show this help
  version    Print package version

Flags:
  --skip-globals  Skip sync:globals:apply (auto-skipped when already initialized)
`;

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
).version as string;

describe("start", () => {
  let argv: string[];
  let exitCode: typeof process.exitCode;
  let stdoutWrite: typeof process.stdout.write;
  const chunks: string[] = [];

  beforeEach(() => {
    argv = process.argv.slice();
    exitCode = process.exitCode;
    process.exitCode = 0;
    chunks.length = 0;
    stdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((buf: string | Uint8Array) => {
      chunks.push(String(buf));
      return true;
    }) as typeof process.stdout.write;
    init.mockReset();
    execFileSync.mockReset();
  });

  afterEach(() => {
    process.argv = argv;
    process.exitCode = exitCode;
    process.stdout.write = stdoutWrite;
  });

  it.each(["help", "--help", "-h"])("%s writes usage", (cmd) => {
    process.argv = ["node", "grunt", cmd];
    start();
    expect(chunks.join("")).toBe(USAGE);
    expect(process.exitCode).toBe(0);
    expect(init).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it.each(["version", "--version", "-v"])("%s writes package version", (cmd) => {
    process.argv = ["node", "grunt", cmd];
    start();
    expect(chunks.join("")).toBe(`${version}\n`);
    expect(process.exitCode).toBe(0);
  });

  it("no-arg runs init on cwd", () => {
    process.argv = ["node", "grunt"];
    start();
    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith(process.cwd(), { skipGlobals: false });
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("init runs init on cwd", () => {
    process.argv = ["node", "grunt", "init"];
    start();
    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith(process.cwd(), { skipGlobals: false });
  });

  it.each([
    ["node", "grunt", "--skip-globals"],
    ["node", "grunt", "init", "--skip-globals"],
    ["node", "grunt", "--skip-globals", "init"],
  ])("passes skipGlobals when argv is %s", (...argv) => {
    process.argv = argv;
    start();
    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith(process.cwd(), { skipGlobals: true });
  });

  it("generate npm-runs rulesync:generate", () => {
    process.argv = ["node", "grunt", "generate"];
    start();
    expect(execFileSync).toHaveBeenCalledOnce();
    expect(execFileSync).toHaveBeenCalledWith("npm", ["run", "rulesync:generate"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    expect(init).not.toHaveBeenCalled();
  });

  it("check npm-runs rulesync:check", () => {
    process.argv = ["node", "grunt", "check"];
    start();
    expect(execFileSync).toHaveBeenCalledOnce();
    expect(execFileSync).toHaveBeenCalledWith("npm", ["run", "rulesync:check"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  });

  it("unknown writes usage and exitCode 1", () => {
    process.argv = ["node", "grunt", "nope"];
    start();
    expect(chunks.join("")).toBe(USAGE);
    expect(process.exitCode).toBe(1);
    expect(init).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
