/** Load leftoverGate + spawnMode from committed jsonc + gitignored local overlay. leftover fail-closed `"ask"`; spawn fail-closed `"cascade"`. Keys independent. */
import fs from "node:fs";
import path from "node:path";

export const CONFIG_REL = ".rulesync/grunt.config.jsonc";
export const LOCAL_CONFIG_REL = ".rulesync/grunt.config.local.jsonc";
export const LEFTOVER_GATES = new Set(["auto", "ask"]);
export const SPAWN_MODES = new Set(["solo", "cascade"]);

export function stripJsonc(text) {
  return String(text ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function parseJsoncFile(abs) {
  try {
    const raw = fs.readFileSync(abs, "utf8");
    const obj = JSON.parse(stripJsonc(raw));
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

function overlayKnown(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  if (extra.leftoverGate === "auto" || extra.leftoverGate === "ask") {
    out.leftoverGate = extra.leftoverGate;
  }
  if (extra.spawnMode === "solo" || extra.spawnMode === "cascade") {
    out.spawnMode = extra.spawnMode;
  }
  return out;
}

function readConfigObject(workspaceRoot) {
  if (!workspaceRoot) return null;
  const committed = parseJsoncFile(path.join(workspaceRoot, CONFIG_REL));
  if (!committed || committed.version !== 1) return null;
  return overlayKnown(
    committed,
    parseJsoncFile(path.join(workspaceRoot, LOCAL_CONFIG_REL)),
  );
}

/** @returns {"auto"|"ask"} */
export function loadLeftoverGate(workspaceRoot) {
  const obj = readConfigObject(workspaceRoot);
  if (!obj) return "ask";
  if (obj.leftoverGate === "auto" || obj.leftoverGate === "ask") {
    return obj.leftoverGate;
  }
  return "ask";
}

/** @returns {"solo"|"cascade"} */
export function loadSpawnMode(workspaceRoot) {
  const obj = readConfigObject(workspaceRoot);
  if (!obj) return "cascade";
  if (obj.spawnMode === "solo" || obj.spawnMode === "cascade") {
    return obj.spawnMode;
  }
  return "cascade";
}
