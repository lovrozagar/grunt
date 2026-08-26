import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  FALLBACK,
  parseArgv,
  runJob,
  shouldFallback,
} from "./grunt-job.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const script = path.join(here, "grunt-job.mjs");
const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function pathSansRg() {
  return (process.env.PATH || "")
    .split(path.delimiter)
    .filter((dir) => !fs.existsSync(path.join(dir, "rg")))
    .join(path.delimiter);
}

function runCli(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    cwd: opts.cwd || root,
    timeout: 20_000,
    env: opts.env || process.env,
  });
}

describe("parseArgv", () => {
  it("parses job query path glob cwd; unknown flags set unknown", () => {
    expect(
      parseArgv([
        "--job",
        "search",
        "--query",
        "a|b",
        "--path",
        "src",
        "--glob",
        "*.md",
        "--glob=*.ts",
        "--cwd",
        "pkg",
      ]),
    ).toEqual({
      job: "search",
      query: "a|b",
      path: "src",
      glob: ["*.md", "*.ts"],
      cwd: "pkg",
      unknown: false,
    });
    expect(parseArgv(["--job", "search", "--query", "x", "--wat"]).unknown).toBe(true);
  });
});

describe("shouldFallback", () => {
  it("falls back on web jobs, denylist, empty query; allows bounded test", () => {
    expect(shouldFallback("web", "anything")).toBe(true);
    expect(shouldFallback("test", "npm test")).toBe(false);
    expect(shouldFallback("search", "")).toBe(true);
    expect(shouldFallback("search", "foo node_modules")).toBe(true);
    expect(shouldFallback("exec", "cat package-lock.json")).toBe(true);
    expect(shouldFallback("test", "foo node_modules")).toBe(true);
    expect(shouldFallback("search", "gate-fat-tools")).toBe(false);
  });
});

describe("runJob search", () => {
  it("ok when the pattern hits this repo", () => {
    const r = runJob({
      job: "search",
      query: "DEFAULT_GREP_HEAD_LIMIT",
      cwd: root,
    });
    expect(r.fallback).toBe(false);
    expect(r.text).toMatch(/^verdict: ok\n/);
    expect(r.text).toMatch(/^n: /m);
    expect(r.text.split("\n").filter(Boolean).length).toBeLessThanOrEqual(8);
  });

  it("empty when nothing matches", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grunt-job-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "a.txt"), "hello\n");
    const r = runJob({
      job: "search",
      query: "zzzxnot-a-real-token-grunt-job-xyzzy",
      cwd: dir,
    });
    expect(r.fallback).toBe(false);
    expect(r.text).toBe("verdict: empty\nn: 0\n");
    expect(r.code).toBe(0);
  });
});

describe("runJob search flags", () => {
  it("PATH without rg: hello|world fixture ok; --path scoped", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grunt-job-or-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "a.txt"), "hello\n");
    fs.writeFileSync(path.join(dir, "b.txt"), "world\n");
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "sub", "c.txt"), "hello\n");
    fs.writeFileSync(path.join(dir, "sub", "d.txt"), "nope\n");
    const env = { ...process.env, PATH: pathSansRg() };
    const or = runCli(["--job", "search", "--query", "hello|world"], { cwd: dir, env });
    expect(or.status).toBe(0);
    expect(or.stdout).toMatch(/^verdict: ok\n/);
    expect(or.stdout).toMatch(/hello|world/);
    const scoped = runCli(
      ["--job", "search", "--query", "hello|world", "--path", "sub"],
      { cwd: dir, env },
    );
    expect(scoped.status).toBe(0);
    expect(scoped.stdout).toMatch(/^verdict: ok\n/);
    expect(scoped.stdout).toMatch(/sub\/c\.txt/);
    expect(scoped.stdout).not.toMatch(/a\.txt/);
    fs.writeFileSync(path.join(dir, "e.md"), "hello\n");
    const globbed = runCli(
      ["--job", "search", "--query", "hello", "--glob", "*.md"],
      { cwd: dir, env },
    );
    expect(globbed.status).toBe(0);
    expect(globbed.stdout).toMatch(/e\.md/);
    expect(globbed.stdout).not.toMatch(/a\.txt/);
  });

  it("unknown flags FALLBACK", () => {
    const r = runCli(["--job", "search", "--query", "x", "--wat"]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe(FALLBACK + "\n");
  });
});

describe("runJob exec", () => {
  it("ok on a successful command", () => {
    const r = runJob({ job: "exec", query: "echo hi", cwd: root });
    expect(r.fallback).toBe(false);
    expect(r.text).toMatch(/^verdict: ok\n/);
    expect(r.text).toMatch(/^n: /m);
    expect(r.text).toMatch(/^- hi$/m);
    expect(r.text.split("\n").filter(Boolean).length).toBeLessThanOrEqual(8);
  });

  it("fail on a nonzero command", () => {
    const r = runJob({ job: "exec", query: "false", cwd: root });
    expect(r.text).toMatch(/^verdict: fail\n/);
    expect(r.text).toMatch(/^n: /m);
    expect(r.text.split("\n").filter(Boolean).length).toBeLessThanOrEqual(8);
  });

  it("empty on a silent success", () => {
    const r = runJob({ job: "exec", query: "true", cwd: root });
    expect(r.text).toBe("verdict: empty\nn: 0\n");
  });

  it("FALLBACK on shell meta; --cwd + true ok", () => {
    const meta = runJob({ job: "exec", query: "cd && npm test", cwd: root });
    expect(meta.fallback).toBe(true);
    expect(meta.text).toBe(FALLBACK + "\n");
    expect(meta.code).toBe(2);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grunt-job-cwd-"));
    tmpDirs.push(dir);
    const cli = runCli(["--job", "exec", "--query", "true", "--cwd", "."], { cwd: dir });
    expect(cli.status).toBe(0);
    expect(cli.stdout).toBe("verdict: empty\nn: 0\n");
    const escape = runCli(["--job", "exec", "--query", "true", "--cwd", ".."], { cwd: dir });
    expect(escape.status).toBe(2);
    expect(escape.stdout).toBe(FALLBACK + "\n");
  });
});

describe("runJob test", () => {
  it("ok on a bounded successful command", () => {
    const r = runJob({ job: "test", query: "echo hi", cwd: root });
    expect(r.fallback).toBe(false);
    expect(r.text).toMatch(/^verdict: ok\n/);
    expect(r.text).toMatch(/^- hi$/m);
  });

  it("fail on a nonzero command", () => {
    const r = runJob({ job: "test", query: "false", cwd: root });
    expect(r.fallback).toBe(false);
    expect(r.text).toMatch(/^verdict: fail\n/);
  });

  it("FALLBACK on denylist query", () => {
    const r = runJob({ job: "test", query: "npm test node_modules", cwd: root });
    expect(r.fallback).toBe(true);
    expect(r.text).toBe(FALLBACK + "\n");
    expect(r.code).toBe(2);
  });
});

describe("FALLBACK", () => {
  it("CLI exits 2 and prints FALLBACK for denylist and html", () => {
    const a = runCli(["--job", "search", "--query", "foo node_modules"]);
    expect(a.status).toBe(2);
    expect(a.stdout).toBe(FALLBACK + "\n");
    const b = runCli(["--job", "exec", "--query", "printf '<html>x</html>'"]);
    expect(b.status).toBe(2);
    expect(b.stdout).toBe(FALLBACK + "\n");
    const c = runCli(["--job", "web", "--query", "https://example.com"]);
    expect(c.status).toBe(2);
    expect(c.stdout).toBe(FALLBACK + "\n");
  });
});
