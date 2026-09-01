import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONFIG_REL,
  LEFTOVER_GATES,
  SPAWN_MODES,
  loadLeftoverGate,
  loadSpawnMode,
  stripJsonc,
} from "./grunt-config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmpWs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grunt-config-"));
  tmpDirs.push(dir);
  return dir;
}

function writeConfig(ws: string, body: string) {
  const abs = path.join(ws, CONFIG_REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("stripJsonc", () => {
  it("strips line and block comments; empty/nullish → empty string", () => {
    expect(stripJsonc(undefined)).toBe("");
    expect(stripJsonc(null)).toBe("");
    expect(stripJsonc("")).toBe("");
    expect(stripJsonc('{"a":1}')).toBe('{"a":1}');
    expect(stripJsonc('// c\n{"a":1}')).toBe('\n{"a":1}');
    expect(stripJsonc('/* block */\n{"a":1}')).toBe('\n{"a":1}');
    expect(stripJsonc("/* a */ // b\n1")).toBe(" \n1");
  });
});

describe("LEFTOVER_GATES", () => {
  it("is auto|ask only", () => {
    expect([...LEFTOVER_GATES].sort()).toEqual(["ask", "auto"]);
    expect(LEFTOVER_GATES.has("AUTO")).toBe(false);
  });
});

describe("SPAWN_MODES", () => {
  it("is solo|cascade only", () => {
    expect([...SPAWN_MODES].sort()).toEqual(["cascade", "solo"]);
    expect(SPAWN_MODES.has("SOLO")).toBe(false);
  });
});

describe("loadLeftoverGate", () => {
  it("missing/unreadable/parse fail/version≠1/bad enum/non-object → ask", () => {
    const ws = tmpWs();
    expect(loadLeftoverGate(ws)).toBe("ask");
    expect(loadLeftoverGate("")).toBe("ask");
    expect(loadLeftoverGate(undefined as unknown as string)).toBe("ask");
    expect(loadLeftoverGate(null as unknown as string)).toBe("ask");

    writeConfig(ws, "{ not json");
    expect(loadLeftoverGate(ws)).toBe("ask");

    writeConfig(ws, '{"version":2,"leftoverGate":"auto"}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '{"version":"1","leftoverGate":"auto"}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '{"version":1,"leftoverGate":"AUTO"}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '{"version":1,"leftoverGate":"maybe"}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '{"version":1,"leftoverGate":1}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '{"version":1}');
    expect(loadLeftoverGate(ws)).toBe("ask");

    writeConfig(ws, "null");
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, "[]");
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, "1");
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, '"ask"');
    expect(loadLeftoverGate(ws)).toBe("ask");
    writeConfig(ws, "true");
    expect(loadLeftoverGate(ws)).toBe("ask");

    const asDir = tmpWs();
    fs.mkdirSync(path.join(asDir, CONFIG_REL), { recursive: true });
    expect(loadLeftoverGate(asDir)).toBe("ask");

    const unreadable = tmpWs();
    writeConfig(unreadable, '{"version":1,"leftoverGate":"auto"}');
    fs.chmodSync(path.join(unreadable, CONFIG_REL), 0);
    expect(loadLeftoverGate(unreadable)).toBe("ask");
    fs.chmodSync(path.join(unreadable, CONFIG_REL), 0o644);
  });

  it("enum auto|ask round-trip; unknown keys ignored; jsonc comments stripped", () => {
    const ws = tmpWs();
    writeConfig(
      ws,
      '// c\n{"version":1,"leftoverGate":"auto","extra":true,"spawnMode":"solo"}',
    );
    expect(loadLeftoverGate(ws)).toBe("auto");
    expect(loadSpawnMode(ws)).toBe("solo");
    writeConfig(ws, '/* block */\n{"version":1,"leftoverGate":"ask","n":1}');
    expect(loadLeftoverGate(ws)).toBe("ask");
  });
});

describe("loadSpawnMode", () => {
  it("missing/unreadable/parse fail/version≠1/bad enum/non-object → cascade", () => {
    const ws = tmpWs();
    expect(loadSpawnMode(ws)).toBe("cascade");
    expect(loadSpawnMode("")).toBe("cascade");
    expect(loadSpawnMode(undefined as unknown as string)).toBe("cascade");
    expect(loadSpawnMode(null as unknown as string)).toBe("cascade");

    writeConfig(ws, "{ not json");
    expect(loadSpawnMode(ws)).toBe("cascade");

    writeConfig(ws, '{"version":2,"spawnMode":"solo"}');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '{"version":"1","spawnMode":"solo"}');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '{"version":1,"spawnMode":"SOLO"}');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '{"version":1,"spawnMode":"maybe"}');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '{"version":1,"spawnMode":1}');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '{"version":1}');
    expect(loadSpawnMode(ws)).toBe("cascade");

    writeConfig(ws, "null");
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, "[]");
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, "1");
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, '"solo"');
    expect(loadSpawnMode(ws)).toBe("cascade");
    writeConfig(ws, "true");
    expect(loadSpawnMode(ws)).toBe("cascade");

    const asDir = tmpWs();
    fs.mkdirSync(path.join(asDir, CONFIG_REL), { recursive: true });
    expect(loadSpawnMode(asDir)).toBe("cascade");

    const unreadable = tmpWs();
    writeConfig(unreadable, '{"version":1,"spawnMode":"solo"}');
    fs.chmodSync(path.join(unreadable, CONFIG_REL), 0);
    expect(loadSpawnMode(unreadable)).toBe("cascade");
    fs.chmodSync(path.join(unreadable, CONFIG_REL), 0o644);
  });

  it("enum solo|cascade round-trip; unknown keys ignored; jsonc comments stripped", () => {
    const ws = tmpWs();
    writeConfig(
      ws,
      '// c\n{"version":1,"spawnMode":"solo","extra":true,"leftoverGate":"auto"}',
    );
    expect(loadSpawnMode(ws)).toBe("solo");
    writeConfig(ws, '/* block */\n{"version":1,"spawnMode":"cascade","n":1}');
    expect(loadSpawnMode(ws)).toBe("cascade");
  });
});

describe("key independence", () => {
  it("leftover auto + spawn solo", () => {
    const ws = tmpWs();
    writeConfig(ws, '{"version":1,"leftoverGate":"auto","spawnMode":"solo"}');
    expect(loadLeftoverGate(ws)).toBe("auto");
    expect(loadSpawnMode(ws)).toBe("solo");
  });

  it("leftover AUTO + spawn solo → ask+solo", () => {
    const ws = tmpWs();
    writeConfig(ws, '{"version":1,"leftoverGate":"AUTO","spawnMode":"solo"}');
    expect(loadLeftoverGate(ws)).toBe("ask");
    expect(loadSpawnMode(ws)).toBe("solo");
  });

  it("leftover auto + spawn SOLO → auto+cascade", () => {
    const ws = tmpWs();
    writeConfig(ws, '{"version":1,"leftoverGate":"auto","spawnMode":"SOLO"}');
    expect(loadLeftoverGate(ws)).toBe("auto");
    expect(loadSpawnMode(ws)).toBe("cascade");
  });

  it("missing spawnMode key + leftover auto → auto+cascade", () => {
    const ws = tmpWs();
    writeConfig(ws, '{"version":1,"leftoverGate":"auto"}');
    expect(loadLeftoverGate(ws)).toBe("auto");
    expect(loadSpawnMode(ws)).toBe("cascade");
  });
});

describe("committed jsonc", () => {
  it("keys leftoverGate spawnMode version; leftover ask; spawn cascade", () => {
    const raw = fs.readFileSync(path.join(root, CONFIG_REL), "utf8");
    expect(raw).toMatch(/"leftoverGate":\s*"ask"/);
    expect(raw).toMatch(/"spawnMode":\s*"cascade"/);
    expect(raw).toMatch(/"version":\s*1/);
    expect(raw).not.toMatch(/"leftoverGate":\s*"auto"/);
    expect(raw).not.toMatch(/"spawnMode":\s*"solo"/);
    expect(raw).toMatch(/\/\/ leftoverGate: "ask" \| "auto"/);
    expect(raw).toMatch(/\/\/ spawnMode: "cascade" \| "solo"/);
    expect(raw).not.toMatch(/fail-closed/);
    expect(raw).not.toMatch(/Keys independent/);
    expect(raw).not.toMatch(/Committed spawnMode is "cascade" never "solo"/);
    expect(raw).not.toMatch(/poison/);
    expect(raw).not.toMatch(/version≠1/);
    expect(raw).not.toMatch(/Only leftoverGate is configurable here/);
    expect(raw).not.toMatch(/spawnMode\/solo\/cascade intentionally/);
    expect(loadLeftoverGate(root)).toBe("ask");
    expect(loadSpawnMode(root)).toBe("cascade");
    const obj = JSON.parse(stripJsonc(raw));
    expect(Object.keys(obj).sort()).toEqual([
      "leftoverGate",
      "spawnMode",
      "version",
    ]);
  });
});
