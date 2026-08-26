#!/usr/bin/env node
/** Append-only hook sidecar. Never throws. Never writes stdout. */
import fs from "node:fs";
import path from "node:path";

const QUERY_MAX = 120;

export const ORCHESTRATOR_LOGS_DIR = ".tmp/orchestrator-logs";

export function telemetryPath(workspaceRoot) {
  const root =
    workspaceRoot ||
    process.env.GROK_WORKSPACE_ROOT ||
    process.cwd();
  return path.join(root, ORCHESTRATOR_LOGS_DIR, "telemetry.ndjson");
}

function truncateQuery(q) {
  const s = String(q ?? "");
  if (s.length <= QUERY_MAX) return s;
  return s.slice(0, QUERY_MAX);
}

export function logTelemetry(event, fields, workspaceRoot) {
  try {
    const rec = { ts: Date.now(), event: String(event || "") };
    const src = fields && typeof fields === "object" ? fields : {};
    for (const [k, v] of Object.entries(src)) {
      if (k === "query" && v != null) rec.query = truncateQuery(v);
      else rec[k] = v;
    }
    const dest = telemetryPath(workspaceRoot);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.appendFileSync(dest, JSON.stringify(rec) + "\n");
  } catch {
    // fail-open
  }
}
