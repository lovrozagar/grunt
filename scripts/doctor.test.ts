import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHROMIUM_BINS,
  installHints,
  nodeMajor,
  runDoctor,
  whichBin,
} from "./doctor.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "doctor.mjs");

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

function writeBin(dir: string, name: string, body = "#!/bin/sh\nexit 0\n") {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, name);
  fs.writeFileSync(dest, body, { mode: 0o755 });
  return dest;
}

function writeNode(dir: string, version = "v22.11.0") {
  return writeBin(
    dir,
    "node",
    `#!/bin/sh\n[ "$1" = "-v" ] && echo ${version} && exit 0\nexit 0\n`,
  );
}

const REQUIRED = ["node", "npm", "git", "rtk", "rulesync", "lightpanda", "chromium"];

function writeRequired(dir: string, extra: Record<string, string> = {}) {
  writeNode(dir, extra.nodeVersion || "v22.11.0");
  writeBin(dir, "npm");
  writeBin(dir, "git");
  writeBin(dir, "rtk");
  writeBin(dir, "rulesync");
  writeBin(dir, extra.lightpandaName || "lightpanda");
  writeBin(dir, extra.chromiumName || "chromium");
}

describe("nodeMajor", () => {
  it("parses v-prefixed and bare", () => {
    expect(nodeMajor("v22.11.0")).toBe(22);
    expect(nodeMajor("22.0.0")).toBe(22);
    expect(nodeMajor("v18.20.8")).toBe(18);
    expect(nodeMajor("nope")).toBe(0);
  });
});

describe("CHROMIUM_BINS", () => {
  it("matches browser family names", () => {
    expect(CHROMIUM_BINS).toEqual([
      "chromium",
      "chromium-browser",
      "google-chrome",
      "google-chrome-stable",
      "chrome",
      "msedge",
      "microsoft-edge",
    ]);
  });
});

describe("installHints", () => {
  it("linux/darwin/win32 print-only strings; no playwright install", () => {
    const linux = installHints("all", "linux").join("\n");
    const darwin = installHints("all", "darwin").join("\n");
    const win = installHints("all", "win32").join("\n");
    for (const t of [linux, darwin, win]) {
      expect(t).not.toMatch(/playwright install/);
      expect(t).toMatch(/https:\/\/nodejs\.org/);
      expect(t).toMatch(/≥22|>=22/);
      expect(t).toMatch(/npm i -D rulesync/);
    }
    expect(linux).toMatch(/apt install git|apt install.*git/);
    expect(linux).toMatch(/curl -fsSL https:\/\/raw\.githubusercontent\.com\/rtk-ai\/rtk\/master\/install\.sh \| sh/);
    expect(linux).toMatch(/pkg\.lightpanda\.io\/install\.sh/);
    expect(linux).toMatch(/apt install chromium/);
    expect(darwin).toMatch(/brew install git/);
    expect(darwin).toMatch(/brew install rtk/);
    expect(darwin).toMatch(/brew tap lightpanda-io\/browser/);
    expect(darwin).toMatch(/brew install --cask chromium|brew install --cask google-chrome/);
    expect(win).toMatch(/winget install OpenJS\.NodeJS\.LTS/);
    expect(win).toMatch(/winget install Git\.Git/);
    expect(win).toMatch(/rtk\.exe|WSL/);
    expect(win).toMatch(/rtk-ai\.app\/docs\/getting-started\/installation/);
    expect(win).toMatch(/winget install Google\.Chrome/);
    expect(win).toMatch(/winget install Microsoft\.Edge/);
    expect(win).toMatch(/WSL/i);
  });
});

describe("runDoctor", () => {
  it("empty PATH + no running node fallback → exit 1; all required missing; OS hints; optional gh; no playwright", () => {
    const cwd = tmp("doc-empty-");
    const linux = runDoctor({
      cwd,
      pathEnv: "",
      platform: "linux",
      execPath: "",
    });
    const darwin = runDoctor({
      cwd,
      pathEnv: "",
      platform: "darwin",
      execPath: "",
    });
    const win = runDoctor({
      cwd,
      pathEnv: "",
      platform: "win32",
      execPath: "",
    });
    for (const r of [linux, darwin, win]) {
      expect(r.code).toBe(1);
      expect(r.stderr).toBe("");
      for (const name of REQUIRED) {
        expect(r.stdout).toMatch(new RegExp(`${name}\\s+missing`));
      }
      expect(r.stdout).toMatch(/gh\s+missing \(optional\)/);
      expect(r.stdout).toMatch(/install \(print-only; not run\)/);
      expect(r.stdout).not.toMatch(/playwright install/);
      expect(r.stdout).toMatch(/rulesync schema doctor: npm run rulesync:doctor/);
    }
    expect(linux.stdout).toMatch(/curl -fsSL https:\/\/pkg\.lightpanda\.io\/install\.sh \| bash/);
    expect(darwin.stdout).toMatch(/brew tap lightpanda-io\/browser/);
    expect(win.stdout).toMatch(/winget install Google\.Chrome/);
    expect(win.stdout).toMatch(/PATH|shim/i);
    expect(win.stdout).toMatch(/WSL/i);
  });

  it("all required present, gh missing → exit 0; gh optional only; no required install dump", () => {
    const cwd = tmp("doc-ok-");
    const bin = path.join(cwd, "bin");
    writeRequired(bin);
    const r = runDoctor({
      cwd,
      pathEnv: bin,
      platform: "linux",
      execPath: "",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/node\s+ok/);
    expect(r.stdout).toMatch(/v22\.11\.0/);
    expect(r.stdout).toContain(path.join(bin, "git"));
    expect(r.stdout).toMatch(/gh\s+missing \(optional\)/);
    expect(r.stdout).not.toMatch(/node\s+missing/);
    expect(r.stdout).not.toMatch(/install \(print-only; not run\)/);
    expect(r.stdout).toMatch(/rulesync schema doctor: npm run rulesync:doctor/);
  });

  it("gh present is ok not a required miss", () => {
    const cwd = tmp("doc-gh-");
    const bin = path.join(cwd, "bin");
    writeRequired(bin);
    const gh = writeBin(bin, "gh");
    const r = runDoctor({ cwd, pathEnv: bin, platform: "linux", execPath: "" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(gh);
    expect(r.stdout).not.toMatch(/gh\s+missing/);
  });

  it("node <22 is required fail even if bin exists", () => {
    const cwd = tmp("doc-old-");
    const bin = path.join(cwd, "bin");
    writeRequired(bin, { nodeVersion: "v18.20.0" });
    const r = runDoctor({ cwd, pathEnv: bin, platform: "linux", execPath: "" });
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/node\s+.*need ≥22|node\s+.*need >=22/);
    expect(r.stdout).toMatch(/https:\/\/nodejs\.org/);
  });

  it("rulesync / rtk from node_modules/.bin counts as npx-able", () => {
    const cwd = tmp("doc-npx-");
    const bin = path.join(cwd, "bin");
    writeNode(bin);
    writeBin(bin, "npm");
    writeBin(bin, "git");
    writeBin(bin, "lightpanda");
    writeBin(bin, "chromium");
    const nm = path.join(cwd, "node_modules", ".bin");
    const rtk = writeBin(nm, "rtk");
    const rs = writeBin(nm, "rulesync");
    const r = runDoctor({ cwd, pathEnv: bin, platform: "linux", execPath: "" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(rtk);
    expect(r.stdout).toContain(rs);
  });

  it("chromium family name google-chrome satisfies chromium", () => {
    const cwd = tmp("doc-chrome-");
    const bin = path.join(cwd, "bin");
    writeRequired(bin, { chromiumName: "google-chrome" });
    const r = runDoctor({ cwd, pathEnv: bin, platform: "linux", execPath: "" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(path.join(bin, "google-chrome"));
    expect(r.stdout).not.toMatch(/chromium\s+missing/);
  });

  it("whichBin finds chrome.exe on win32 PATH dir", () => {
    const dir = tmp("which-win-");
    const exe = path.join(dir, "chrome.exe");
    fs.writeFileSync(exe, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    expect(whichBin("chrome", dir, "win32")).toBe(exe);
  });
});

describe("doctor cli", () => {
  it("main empty PATH + no node on PATH exits 1", () => {
    const cwd = tmp("doc-cli-");
    const r = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      cwd,
      env: { ...process.env, PATH: "/nonexistent-grunt-doctor" },
      timeout: 15_000,
    });
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/missing/);
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/playwright install/);
  });
});
