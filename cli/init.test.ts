import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  init,
  mergeGitignore,
  mergePackageJson,
  samePath,
} from "./init.mjs";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

const COPY_DIRS = [".rulesync", ".grok", ".codex", ".claude", ".agents"];
const COPY_FILES = ["AGENTS.md", "CLAUDE.md", ".mcp.json"];
const PRODUCT_FILES = [
  "check-globals.mjs",
  "emit-mcp-policy.mjs",
  "gate-fat-tools.mjs",
  "grunt-job.mjs",
  "parse-need.mjs",
  "persist-plan.mjs",
  "purge-global-mcps.mjs",
  "scrub-spawn-prompt.mjs",
  "scrub-text-lib.mjs",
  "sync-global-settings.mjs",
  "telemetry.mjs",
];

function stubPkgRoot(pkg: Record<string, unknown> = {
  name: "fixture-pkg",
  scripts: {
    test: "skip-me",
    zeta: "z",
    alpha: "a",
    "rulesync:generate": "gen",
  },
  devDependencies: {
    "smol-toml": "^1.8.0",
    rulesync: "latest",
    zzz: "1",
  },
}) {
  const root = tmp("grunt-pkg-");
  for (const d of COPY_DIRS) {
    fs.mkdirSync(path.join(root, d));
    fs.writeFileSync(path.join(root, d, "marker"), d);
  }
  for (const f of COPY_FILES) {
    fs.writeFileSync(path.join(root, f), f);
  }
  fs.mkdirSync(path.join(root, "scripts"));
  for (const name of PRODUCT_FILES) {
    fs.writeFileSync(path.join(root, "scripts", name), name);
  }
  fs.mkdirSync(path.join(root, "scripts", "scrub-text"));
  fs.writeFileSync(path.join(root, "scripts", "scrub-text", "inside"), "dir");
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  return root;
}

describe("samePath", () => {
  it("try: realpath equal vs unequal", () => {
    const a = tmp("same-a-");
    const b = tmp("same-b-");
    expect(samePath(a, a)).toBe(true);
    expect(samePath(a, b)).toBe(false);
  });

  it("catch: missing paths fall back to resolve", () => {
    const missing = path.join(os.tmpdir(), `grunt-missing-${process.pid}-nope`);
    expect(samePath(missing, missing)).toBe(true);
    expect(samePath(missing, `${missing}-other`)).toBe(false);
  });
});

describe("mergeGitignore", () => {
  it("creates .tmp/ when missing", () => {
    const dest = tmp("gi-miss-");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe(".tmp/\n");
  });

  it("noop when .tmp/ present", () => {
    const dest = tmp("gi-slash-");
    fs.writeFileSync(path.join(dest, ".gitignore"), "foo\n.tmp/\nbar\n");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe("foo\n.tmp/\nbar\n");
  });

  it("noop when .tmp present", () => {
    const dest = tmp("gi-bare-");
    fs.writeFileSync(path.join(dest, ".gitignore"), ".tmp\n");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe(".tmp\n");
  });

  it("appends after trailing newline", () => {
    const dest = tmp("gi-nl-");
    fs.writeFileSync(path.join(dest, ".gitignore"), "node_modules/\n");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe(
      "node_modules/\n.tmp/\n",
    );
  });

  it("appends with inserted newline when file lacks one", () => {
    const dest = tmp("gi-nonl-");
    fs.writeFileSync(path.join(dest, ".gitignore"), "node_modules/");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe(
      "node_modules/\n.tmp/\n",
    );
  });

  it("appends to empty existing file", () => {
    const dest = tmp("gi-empty-");
    fs.writeFileSync(path.join(dest, ".gitignore"), "");
    mergeGitignore(dest);
    expect(fs.readFileSync(path.join(dest, ".gitignore"), "utf8")).toBe(".tmp/\n");
  });
});

describe("mergePackageJson", () => {
  it("creates {} dest and merges scripts skipping test, injects deps, sorts keys", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("pj-new-");
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts).toEqual({
      alpha: "a",
      "rulesync:generate": "gen",
      zeta: "z",
    });
    expect(Object.keys(out.scripts)).toEqual(["alpha", "rulesync:generate", "zeta"]);
    expect(out.devDependencies).toEqual({
      rulesync: "latest",
      "smol-toml": "^1.8.0",
    });
    expect(Object.keys(out.devDependencies)).toEqual(["rulesync", "smol-toml"]);
    expect(out.scripts.test).toBeUndefined();
  });

  it("merges over existing dest scripts/deps, keeps dest test", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("pj-exist-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        name: "app",
        scripts: { test: "jest", alpha: "old", foo: "bar" },
        devDependencies: { lodash: "4" },
      }),
    );
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts.test).toBe("jest");
    expect(out.scripts.alpha).toBe("a");
    expect(out.scripts.foo).toBe("bar");
    expect(out.devDependencies.lodash).toBe("4");
    expect(out.devDependencies["smol-toml"]).toBe("^1.8.0");
    expect(out.devDependencies.rulesync).toBe("latest");
  });

  it("early return when name is @lovrozagar/grunt", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("pj-self-");
    const raw = `${JSON.stringify({ name: "@lovrozagar/grunt", scripts: { test: "x" } }, null, 2)}\n`;
    fs.writeFileSync(path.join(dest, "package.json"), raw);
    mergePackageJson(dest, pkgRoot);
    expect(fs.readFileSync(path.join(dest, "package.json"), "utf8")).toBe(raw);
  });

  it("src without scripts uses empty object", () => {
    const pkgRoot = stubPkgRoot({
      name: "no-scripts",
      devDependencies: { "smol-toml": "1", rulesync: "2" },
    });
    const dest = tmp("pj-noscripts-");
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts).toEqual({});
    expect(out.devDependencies).toEqual({ rulesync: "2", "smol-toml": "1" });
  });
});

describe("init", () => {
  it("self-skip: copies + gitignore, no exec, no package merge", () => {
    const pkgRoot = stubPkgRoot();
    const exec = vi.fn();
    init(pkgRoot, { pkgRoot, execFileSync: exec });
    expect(exec).not.toHaveBeenCalled();
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
    expect(pkg.name).toBe("fixture-pkg");
    expect(fs.existsSync(path.join(pkgRoot, ".tmp"))).toBe(true);
    expect(fs.readFileSync(path.join(pkgRoot, ".gitignore"), "utf8")).toBe(".tmp/\n");
    expect(fs.readFileSync(path.join(pkgRoot, "scripts", "telemetry.mjs"), "utf8")).toBe(
      "telemetry.mjs",
    );
  });

  it("non-self: file vs dir product scripts, then npm pipeline in order", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-dest-");
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec });

    for (const d of COPY_DIRS) {
      expect(fs.readFileSync(path.join(dest, d, "marker"), "utf8")).toBe(d);
    }
    for (const f of COPY_FILES) {
      expect(fs.readFileSync(path.join(dest, f), "utf8")).toBe(f);
    }
    for (const name of PRODUCT_FILES) {
      expect(fs.statSync(path.join(dest, "scripts", name)).isFile()).toBe(true);
    }
    expect(fs.statSync(path.join(dest, "scripts", "scrub-text")).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(dest, "scripts", "scrub-text", "inside"), "utf8")).toBe(
      "dir",
    );

    const destPkg = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(destPkg.scripts.test).toBeUndefined();
    expect(destPkg.devDependencies["smol-toml"]).toBe("^1.8.0");

    expect(exec.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["npm", ["install"]],
      ["npm", ["run", "rulesync:generate"]],
      ["npm", ["run", "sync:globals:apply"]],
      ["npm", ["run", "rulesync:check"]],
    ]);
    for (const call of exec.mock.calls) {
      expect(call[2]).toEqual({ cwd: dest, stdio: "inherit" });
    }
  });

  it("omitted execFileSync uses default; self-skip never invokes it", () => {
    const pkgRoot = stubPkgRoot();
    init(pkgRoot, { pkgRoot });
    expect(fs.existsSync(path.join(pkgRoot, "AGENTS.md"))).toBe(true);
    expect(fs.readFileSync(path.join(pkgRoot, ".gitignore"), "utf8")).toBe(".tmp/\n");
  });

  it("omitted pkgRoot uses built-in PKG_ROOT; exec mocked", () => {
    const dest = tmp("grunt-realroot-");
    const exec = vi.fn();
    init(dest, { execFileSync: exec });
    expect(fs.existsSync(path.join(dest, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "scripts", "scrub-text"))).toBe(true);
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "sync:globals:apply"],
      ["run", "rulesync:check"],
    ]);
  });
});
