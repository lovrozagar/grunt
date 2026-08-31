import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  destAlreadyInited,
  init,
  mergeClaudeSettings,
  mergeGitignore,
  mergeGuardedMarkdown,
  mergePackageJson,
  samePath,
  shouldAutoSkipGlobals,
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
const GUARDED_MD_FILES = ["AGENTS.md", "CLAUDE.md"];
const PRODUCT_FILES = [
  "check-globals.mjs",
  "emit-agent-shell-tools.mjs",
  "emit-gemini.mjs",
  "emit-mcp-policy.mjs",
  "gate-fat-tools.mjs",
  "hooks-union.mjs",
  "grunt-job.mjs",
  "parse-need.mjs",
  "persist-handoff.mjs",
  "persist-plan.mjs",
  "purge-global-mcps.mjs",
  "scrub-spawn-prompt.mjs",
  "scrub-text-lib.mjs",
  "sync-global-settings.mjs",
  "telemetry.mjs",
  "browser.mjs",
  "doctor.mjs",
];

const SRC_CLAUDE_SETTINGS = {
  permissions: {
    deny: ["Agent(Explore)", "Agent(orchestrator)", "mcp__*"],
  },
  hooks: {
    PreToolUse: [
      {
        matcher: "spawn",
        hooks: [
          {
            type: "command",
            command: 'node "${ROOT}/scripts/scrub-spawn-prompt.mjs"',
          },
        ],
      },
      {
        matcher: "fat",
        hooks: [
          {
            type: "command",
            command: 'node "${ROOT}/scripts/gate-fat-tools.mjs"',
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: 'node "${ROOT}/.grok/hooks/orchestrate-parent.js"',
          },
        ],
      },
    ],
  },
  enableAllProjectMcpServers: false,
  enabledMcpjsonServers: [],
};

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
  fs.writeFileSync(
    path.join(root, ".claude", "settings.json"),
    `${JSON.stringify(SRC_CLAUDE_SETTINGS, null, 2)}\n`,
  );
  for (const f of GUARDED_MD_FILES) {
    fs.writeFileSync(path.join(root, f), `${f} content`);
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

describe("mergeGuardedMarkdown", () => {
  it("self: dest === src is a no-op", () => {
    const dir = tmp("md-self-");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "raw content");
    mergeGuardedMarkdown(dir, dir, "CLAUDE.md");
    expect(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe("raw content");
  });

  it("dest absent: writes package copy wrapped in sentinels", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("md-absent-");
    mergeGuardedMarkdown(dest, pkgRoot, "CLAUDE.md");
    expect(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf8")).toBe(
      "<!-- grunt:begin -->\nCLAUDE.md content\n<!-- grunt:end -->\n",
    );
  });

  it("dest exists without sentinel: writes CLAUDE.grunt.md, leaves original untouched", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("md-nosentinel-");
    fs.writeFileSync(path.join(dest, "CLAUDE.md"), "hand-written consumer doc\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mergeGuardedMarkdown(dest, pkgRoot, "CLAUDE.md");
    expect(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf8")).toBe(
      "hand-written consumer doc\n",
    );
    expect(fs.readFileSync(path.join(dest, "CLAUDE.grunt.md"), "utf8")).toBe("CLAUDE.md content");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("CLAUDE.grunt.md");
    logSpy.mockRestore();
  });

  it("dest exists with sentinel: replaces only the marked region", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("md-sentinel-");
    fs.writeFileSync(
      path.join(dest, "CLAUDE.md"),
      "before\n<!-- grunt:begin -->\nold generated stuff\n<!-- grunt:end -->\nafter\n",
    );
    mergeGuardedMarkdown(dest, pkgRoot, "CLAUDE.md");
    expect(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf8")).toBe(
      "before\n<!-- grunt:begin -->\nCLAUDE.md content\n<!-- grunt:end -->\nafter\n",
    );
    expect(fs.existsSync(path.join(dest, "CLAUDE.grunt.md"))).toBe(false);
  });
});

describe("mergeClaudeSettings", () => {
  it("dest .claude/settings.json absent: plain copy", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-absent-");
    mergeClaudeSettings(destRoot, pkgRoot);
    const out = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(out).toEqual(SRC_CLAUDE_SETTINGS);
  });

  it("malformed dest JSON throws with the path in the message", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-malformed-");
    const destSettingsPath = path.join(destRoot, ".claude", "settings.json");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    fs.writeFileSync(destSettingsPath, "{ not valid json");
    expect(() => mergeClaudeSettings(destRoot, pkgRoot)).toThrowError(
      new RegExp(destSettingsPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("consumer hook group with only OWNED commands is replaced", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-owned-");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(destRoot, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { deny: ["Agent(Explore)"] },
        hooks: {
          PreToolUse: [
            {
              matcher: "spawn",
              hooks: [
                {
                  type: "command",
                  command: 'node "${OLD_ROOT}/scripts/scrub-spawn-prompt.mjs"',
                },
              ],
            },
          ],
        },
        enableAllProjectMcpServers: true,
        enabledMcpjsonServers: ["stale"],
      }),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const out = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(out.hooks.PreToolUse).toEqual(SRC_CLAUDE_SETTINGS.hooks.PreToolUse);
    expect(out.hooks.Stop).toEqual(SRC_CLAUDE_SETTINGS.hooks.Stop);
    expect(out.enableAllProjectMcpServers).toBe(false);
    expect(out.enabledMcpjsonServers).toEqual([]);
  });

  it("consumer hook group with only consumer commands survives", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-consumer-");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    const consumerGroup = {
      matcher: "custom",
      hooks: [{ type: "command", command: "node scripts/my-custom-hook.mjs" }],
    };
    fs.writeFileSync(
      path.join(destRoot, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { deny: ["Agent(Explore)"] },
        hooks: { PreToolUse: [consumerGroup] },
      }),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const out = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(out.hooks.PreToolUse).toEqual([consumerGroup, ...SRC_CLAUDE_SETTINGS.hooks.PreToolUse]);
    // event absent from dest entirely still gets appended
    expect(out.hooks.Stop).toEqual(SRC_CLAUDE_SETTINGS.hooks.Stop);
  });

  it("MIXED group (one OWNED + one consumer command) survives intact", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-mixed-");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    const mixedGroup = {
      matcher: "mixed",
      hooks: [
        { type: "command", command: 'node "${OLD_ROOT}/scripts/gate-fat-tools.mjs"' },
        { type: "command", command: "node scripts/my-custom-hook.mjs" },
      ],
    };
    fs.writeFileSync(
      path.join(destRoot, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { deny: [] },
        hooks: { PreToolUse: [mixedGroup] },
      }),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const out = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(out.hooks.PreToolUse).toEqual([mixedGroup, ...SRC_CLAUDE_SETTINGS.hooks.PreToolUse]);
  });

  it("permissions.deny union does not grow on a second run (idempotency)", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-idempotent-");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(destRoot, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { deny: ["Agent(Explore)", "Agent(orchestrator)"] },
        hooks: {},
      }),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const first = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const second = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(second.permissions.deny).toEqual(first.permissions.deny);
    expect(second.permissions.deny).toEqual([
      "Agent(Explore)",
      "Agent(orchestrator)",
      "mcp__*",
    ]);
    expect(second.permissions.allow).toEqual(first.permissions.allow);
  });

  it("unknown consumer top-level key preserved; missing hooks/permissions default to empty", () => {
    const pkgRoot = stubPkgRoot();
    const destRoot = tmp("settings-unknown-key-");
    fs.mkdirSync(path.join(destRoot, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(destRoot, ".claude", "settings.json"),
      JSON.stringify({ someCustomFlag: true }),
    );
    mergeClaudeSettings(destRoot, pkgRoot);
    const out = JSON.parse(
      fs.readFileSync(path.join(destRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(out.someCustomFlag).toBe(true);
    expect(out.hooks).toEqual(SRC_CLAUDE_SETTINGS.hooks);
    expect(out.permissions.deny).toEqual(SRC_CLAUDE_SETTINGS.permissions.deny);
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
    expect(out.scripts.alpha).toBe("old");
    expect(out.scripts.foo).toBe("bar");
    expect(out.devDependencies.lodash).toBe("4");
    expect(out.devDependencies["smol-toml"]).toBe("^1.8.0");
    expect(out.devDependencies.rulesync).toBe("latest");
  });

  it("preserves dest suffix after an upgraded grunt script prefix", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { "rulesync:generate": "rulesync generate -t bar" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-suffix-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        scripts: {
          "rulesync:generate": "rulesync generate -t foo && node scripts/codex-sync.mjs",
        },
      }),
    );
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe(
      "rulesync generate -t bar && node scripts/codex-sync.mjs",
    );
  });

  it("preserves suffix after a multi-command grunt script upgrade", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: {
        "rulesync:generate": "rulesync generate -t bar && node scripts/emit.mjs",
      },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-multi-suffix-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        scripts: {
          "rulesync:generate":
            "rulesync generate -t foo && node scripts/emit.mjs && node scripts/codex-sync.mjs",
        },
      }),
    );
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe(
      "rulesync generate -t bar && node scripts/emit.mjs && node scripts/codex-sync.mjs",
    );
  });

  it("does not treat a non-owned prefix plus extra && as a grunt suffix", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { alpha: "a" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-nonowned-suffix-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({ scripts: { alpha: "echo custom && extra" } }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts.alpha).toBe("echo custom && extra");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("falls through suffix scan when extra commands use bare semicolons", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { "rulesync:generate": "rulesync generate -t bar" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-semi-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        scripts: { "rulesync:generate": "echo custom;echo extra" },
      }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe("echo custom;echo extra");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("keeps dest when dest script already equals src", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { "rulesync:generate": "rulesync generate -t bar" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-equal-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({ scripts: { "rulesync:generate": "rulesync generate -t bar" } }),
    );
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe("rulesync generate -t bar");
  });

  it("keeps dest when it already starts with the new src value plus suffix", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { "rulesync:generate": "rulesync generate -t bar" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-prefix-");
    const cur = "rulesync generate -t bar && node scripts/codex-sync.mjs";
    fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify({ scripts: { "rulesync:generate": cur } }));
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe(cur);
  });

  it("keeps unrelated custom script values and dest-only keys, warns on skip", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("pj-unrelated-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        scripts: { alpha: "echo custom", foo: "bar", test: "jest" },
      }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts.alpha).toBe("echo custom");
    expect(out.scripts.foo).toBe("bar");
    expect(out.scripts.test).toBe("jest");
    expect(out.scripts.zeta).toBe("z");
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes("alpha") && String(c[0]).includes("untouched"))).toBe(
      true,
    );
    warnSpy.mockRestore();
  });

  it("replaces a grunt-owned script with no suffix", () => {
    const pkgRoot = stubPkgRoot({
      name: "fixture-pkg",
      scripts: { "rulesync:generate": "rulesync generate -t bar", "sync:globals:apply": "node scripts/sync-global-settings.mjs --apply" },
      devDependencies: { "smol-toml": "^1.8.0", rulesync: "latest" },
    });
    const dest = tmp("pj-owned-");
    fs.writeFileSync(
      path.join(dest, "package.json"),
      JSON.stringify({
        scripts: { "rulesync:generate": "rulesync generate -t foo" },
      }),
    );
    mergePackageJson(dest, pkgRoot);
    const out = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
    expect(out.scripts["rulesync:generate"]).toBe("rulesync generate -t bar");
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
    // self-skip: markdown/settings stay exactly as-is, no sentinel wrap
    expect(fs.readFileSync(path.join(pkgRoot, "CLAUDE.md"), "utf8")).toBe("CLAUDE.md content");
    const settings = JSON.parse(
      fs.readFileSync(path.join(pkgRoot, ".claude", "settings.json"), "utf8"),
    );
    expect(settings).toEqual(SRC_CLAUDE_SETTINGS);
  });

  it("non-self: file vs dir product scripts, guarded md + settings merge, then npm pipeline in order", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-dest-");
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec });

    for (const d of COPY_DIRS) {
      if (d === ".claude") continue;
      expect(fs.readFileSync(path.join(dest, d, "marker"), "utf8")).toBe(d);
    }
    expect(fs.readFileSync(path.join(dest, ".claude", "marker"), "utf8")).toBe(".claude");
    const settings = JSON.parse(
      fs.readFileSync(path.join(dest, ".claude", "settings.json"), "utf8"),
    );
    expect(settings).toEqual(SRC_CLAUDE_SETTINGS);

    for (const f of GUARDED_MD_FILES) {
      expect(fs.readFileSync(path.join(dest, f), "utf8")).toBe(
        `<!-- grunt:begin -->\n${f} content\n<!-- grunt:end -->\n`,
      );
    }
    expect(fs.existsSync(path.join(dest, ".mcp.json"))).toBe(false);

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

  it("re-running init on an already-initialized dest merges settings.json instead of clobbering", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-rerun-");
    const exec = vi.fn();
    fs.mkdirSync(path.join(dest, ".claude"), { recursive: true });
    const consumerGroup = {
      matcher: "custom",
      hooks: [{ type: "command", command: "node scripts/my-custom-hook.mjs" }],
    };
    fs.writeFileSync(
      path.join(dest, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { deny: ["Agent(Explore)"] },
        hooks: { PreToolUse: [consumerGroup] },
        someCustomFlag: true,
      }),
    );
    init(dest, { pkgRoot, execFileSync: exec });
    const settings = JSON.parse(
      fs.readFileSync(path.join(dest, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.someCustomFlag).toBe(true);
    expect(settings.hooks.PreToolUse).toEqual([
      consumerGroup,
      ...SRC_CLAUDE_SETTINGS.hooks.PreToolUse,
    ]);
    expect(settings.permissions.deny).toContain("Agent(Explore)");
    expect(settings.permissions.deny).toContain("mcp__*");
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
    expect(fs.existsSync(path.join(dest, ".claude", "settings.json"))).toBe(true);
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "sync:globals:apply"],
      ["run", "rulesync:check"],
    ]);
  });

  it("--skip-globals skips sync:globals:apply", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-skip-globals-");
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec, skipGlobals: true });
    expect(exec.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["npm", ["install"]],
      ["npm", ["run", "rulesync:generate"]],
      ["npm", ["run", "rulesync:check"]],
    ]);
  });

  it("applyGlobals true still applies when telemetry auto-skip would fire", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-force-globals-");
    fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dest, "scripts", "telemetry.mjs"), "existing");
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec, applyGlobals: true });
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "sync:globals:apply"],
      ["run", "rulesync:check"],
    ]);
  });

  it("auto-skip globals when telemetry.mjs exists", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-auto-tel-");
    fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dest, "scripts", "telemetry.mjs"), "existing");
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec });
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "rulesync:check"],
    ]);
  });

  it("auto-skip globals when AGENTS.md already has a grunt sentinel", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-auto-sent-");
    fs.writeFileSync(
      path.join(dest, "AGENTS.md"),
      "<!-- grunt:begin -->\nold\n<!-- grunt:end -->\n",
    );
    const exec = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec });
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "rulesync:check"],
    ]);
  });

  it("re-run without sentinel does not create/overwrite *.grunt.md", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-rerun-nosent-");
    fs.writeFileSync(path.join(dest, "CLAUDE.md"), "hand-written consumer doc\n");
    fs.writeFileSync(path.join(dest, "AGENTS.md"), "hand-written consumer doc\n");
    fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dest, "scripts", "telemetry.mjs"), "existing");
    fs.writeFileSync(path.join(dest, "CLAUDE.grunt.md"), "stale side");
    const exec = vi.fn();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    init(dest, { pkgRoot, execFileSync: exec });
    expect(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf8")).toBe("hand-written consumer doc\n");
    expect(fs.readFileSync(path.join(dest, "AGENTS.md"), "utf8")).toBe("hand-written consumer doc\n");
    expect(fs.readFileSync(path.join(dest, "CLAUDE.grunt.md"), "utf8")).toBe("stale side");
    expect(fs.existsSync(path.join(dest, "AGENTS.grunt.md"))).toBe(false);
    expect(logSpy.mock.calls.filter((c) => String(c[0]).includes("lack markers"))).toHaveLength(1);
    logSpy.mockRestore();
  });

  it("first init without sentinel still creates *.grunt.md", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-first-nosent-");
    fs.writeFileSync(path.join(dest, "CLAUDE.md"), "hand-written consumer doc\n");
    fs.writeFileSync(path.join(dest, "AGENTS.md"), "hand-written consumer doc\n");
    const exec = vi.fn();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    init(dest, { pkgRoot, execFileSync: exec });
    expect(fs.readFileSync(path.join(dest, "CLAUDE.md"), "utf8")).toBe("hand-written consumer doc\n");
    expect(fs.readFileSync(path.join(dest, "CLAUDE.grunt.md"), "utf8")).toBe("CLAUDE.md content");
    expect(fs.readFileSync(path.join(dest, "AGENTS.grunt.md"), "utf8")).toBe("AGENTS.md content");
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "sync:globals:apply"],
      ["run", "rulesync:check"],
    ]);
    logSpy.mockRestore();
  });

  it("onPhase merge then npm phases stop before exec", () => {
    const pkgRoot = stubPkgRoot();
    const dest = tmp("grunt-onphase-");
    const exec = vi.fn();
    const onPhase = vi.fn();
    init(dest, { pkgRoot, execFileSync: exec, onPhase });
    expect(onPhase.mock.calls).toEqual([
      ["merge", "start"],
      ["merge", "stop"],
      ["install", "start"],
      ["install", "stop"],
      ["generate", "start"],
      ["generate", "stop"],
      ["sync-globals", "start"],
      ["sync-globals", "stop"],
      ["check", "start"],
      ["check", "stop"],
    ]);
    expect(exec.mock.calls.map((c) => c[1])).toEqual([
      ["install"],
      ["run", "rulesync:generate"],
      ["run", "sync:globals:apply"],
      ["run", "rulesync:check"],
    ]);
  });

  it("self-skip only merge onPhase", () => {
    const pkgRoot = stubPkgRoot();
    const onPhase = vi.fn();
    init(pkgRoot, { pkgRoot, onPhase });
    expect(onPhase.mock.calls).toEqual([
      ["merge", "start"],
      ["merge", "stop"],
    ]);
  });
});

describe("destAlreadyInited / shouldAutoSkipGlobals", () => {
  it("empty dest is neither", () => {
    const dest = tmp("inspect-empty-");
    expect(destAlreadyInited(dest)).toBe(false);
    expect(shouldAutoSkipGlobals(dest)).toBe(false);
  });

  it(".rulesync means inited, not auto-skip", () => {
    const dest = tmp("inspect-rulesync-");
    fs.mkdirSync(path.join(dest, ".rulesync"));
    expect(destAlreadyInited(dest)).toBe(true);
    expect(shouldAutoSkipGlobals(dest)).toBe(false);
  });

  it("sentinel auto-skips globals", () => {
    const dest = tmp("inspect-sent-");
    fs.writeFileSync(
      path.join(dest, "AGENTS.md"),
      "<!-- grunt:begin -->\nx\n<!-- grunt:end -->\n",
    );
    expect(shouldAutoSkipGlobals(dest)).toBe(true);
  });
});

