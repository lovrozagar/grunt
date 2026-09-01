/** Load leftoverGate + spawnMode from `.rulesync/grunt.config.jsonc`. leftover fail-closed `"ask"`; spawn fail-closed `"cascade"`. Keys independent. */
import fs from "node:fs";
import path from "node:path";

export const CONFIG_REL = ".rulesync/grunt.config.jsonc";
export const LEFTOVER_GATES = new Set(["auto", "ask"]);
export const SPAWN_MODES = new Set(["solo", "cascade"]);

export function stripJsonc(text) {
  return String(text ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function readConfigObject(workspaceRoot) {
  if (!workspaceRoot) return null;
  const raw = fs.readFileSync(path.join(workspaceRoot, CONFIG_REL), "utf8");
  const obj = JSON.parse(stripJsonc(raw));
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  if (obj.version !== 1) return null;
  return obj;
}

/** @returns {"auto"|"ask"} */
export function loadLeftoverGate(workspaceRoot) {
  try {
    const obj = readConfigObject(workspaceRoot);
    if (!obj) return "ask";
    if (obj.leftoverGate === "auto" || obj.leftoverGate === "ask") {
      return obj.leftoverGate;
    }
    return "ask";
  } catch {
    return "ask";
  }
}

/** @returns {"solo"|"cascade"} */
export function loadSpawnMode(workspaceRoot) {
  try {
    const obj = readConfigObject(workspaceRoot);
    if (!obj) return "cascade";
    if (obj.spawnMode === "solo" || obj.spawnMode === "cascade") {
      return obj.spawnMode;
    }
    return "cascade";
  } catch {
    return "cascade";
  }
}
