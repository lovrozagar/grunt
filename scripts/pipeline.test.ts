import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { COMMANDS, envWithLocalBin, runPipeline } from "./pipeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "pipeline.mjs");

describe("runPipeline", () => {
  it("runs generate commands in order with local .bin PATH", () => {
    const exec = vi.fn();
    const cwd = "/tmp/ws";
    runPipeline("generate", { cwd, exec });
    expect(exec.mock.calls.map((c) => c[0])).toEqual(COMMANDS.generate);
    const env = exec.mock.calls[0][1].env;
    expect(env.PATH.startsWith(path.join(cwd, "node_modules", ".bin") + path.delimiter)).toBe(
      true,
    );
    expect(exec.mock.calls[0][1]).toMatchObject({
      cwd,
      stdio: "inherit",
      shell: true,
    });
  });

  it("stops after the first failing command", () => {
    const exec = vi.fn(() => {
      throw new Error("boom");
    });
    expect(() => runPipeline("check", { cwd: "/tmp", exec })).toThrow(/boom/);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toBe(COMMANDS.check[0]);
  });

  it("rejects unknown mode", () => {
    expect(() => runPipeline("")).toThrow(/generate\|check\|watch/);
    expect(() => runPipeline("nope")).toThrow(/generate\|check\|watch/);
  });

  it("envWithLocalBin prepends when PATH is missing", () => {
    const cwd = "/tmp/ws";
    const env = envWithLocalBin(cwd, {});
    expect(env.PATH).toBe(path.join(cwd, "node_modules", ".bin") + path.delimiter);
  });
});

describe("CLI", () => {
  it("exits 1 with usage on bad mode", () => {
    const result = spawnSync(process.execPath, [script, "nope"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/generate\|check\|watch/);
    expect(result.stdout).toBe("");
  });
});
