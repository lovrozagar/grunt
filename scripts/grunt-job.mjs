#!/usr/bin/env node
/** Deterministic grunt for job: search|exec|test. Exit 2 + FALLBACK on web/HTML/unbounded/denylist. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FALLBACK = "FALLBACK";
export const SHELL_META = /[|&;`$(){}<>\n\r]/;
const DENY_SEGS = new Set(["node_modules", "dist", ".next", "build", "coverage"]);
const DENY_LOCK = /\b(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)\b/;
const MAX_FACTS = 6;
const MAX_STDOUT = 32 * 1024;

function takeFlag(argv, i, prefix) {
  const a = argv[i];
  if (a === prefix) return { value: String(argv[i + 1] || ""), next: i + 1 };
  if (a.startsWith(prefix + "=")) return { value: a.slice(prefix.length + 1), next: i };
  return null;
}

export function parseArgv(argv) {
  let job = "";
  let query = "";
  let searchPath = "";
  let cwd = "";
  const glob = [];
  let unknown = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const jobF = takeFlag(argv, i, "--job");
    if (jobF) {
      job = jobF.value;
      i = jobF.next;
      continue;
    }
    const queryF = takeFlag(argv, i, "--query");
    if (queryF) {
      query = queryF.value;
      i = queryF.next;
      continue;
    }
    const pathF = takeFlag(argv, i, "--path");
    if (pathF) {
      searchPath = pathF.value;
      i = pathF.next;
      continue;
    }
    const cwdF = takeFlag(argv, i, "--cwd");
    if (cwdF) {
      cwd = cwdF.value;
      i = cwdF.next;
      continue;
    }
    const globF = takeFlag(argv, i, "--glob");
    if (globF) {
      if (globF.value) glob.push(globF.value);
      i = globF.next;
      continue;
    }
    unknown = true;
  }
  return {
    job: String(job).trim().toLowerCase(),
    query: String(query),
    path: String(searchPath),
    glob,
    cwd: String(cwd),
    unknown,
  };
}

export function resolveUnder(root, rel) {
  const base = path.resolve(root || process.cwd());
  if (rel == null || rel === "") return base;
  const abs = path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(base, rel);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (abs !== base && !abs.startsWith(prefix)) return null;
  return abs;
}

export function resolveJobCwd(cwd, workspaceRoot) {
  return resolveUnder(workspaceRoot || process.cwd(), cwd);
}

export function shouldFallback(job, query) {
  if (job !== "search" && job !== "exec" && job !== "test") return true;
  const q = String(query || "");
  if (!q.trim()) return true;
  if (/\b(curl|wget)\b/i.test(q)) return true;
  if (/<\s*html\b/i.test(q) || /<\s*!DOCTYPE html/i.test(q)) return true;
  if (DENY_LOCK.test(q)) return true;
  if (/(^|[\s/])\.git(\/|$)/.test(q.replace(/\\/g, "/"))) return true;
  for (const seg of DENY_SEGS) {
    const re = new RegExp(`(^|[\\/\\s'"\`])${escapeRe(seg)}([\\/\\s'"\`]|$)`);
    if (re.test(q)) return true;
  }
  return false;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function looksHtmlOrUnbounded(stdout, stderr) {
  const s = String(stdout || "") + String(stderr || "");
  if (s.length > MAX_STDOUT) return true;
  if (/<\s*html\b/i.test(s) || /<\s*!DOCTYPE html/i.test(s)) return true;
  return false;
}

export function formatVerdict({ status, n, facts, errors }) {
  const lines = [`verdict: ${status}`, `n: ${n}`];
  if (status === "fail") {
    for (const e of (errors || []).slice(0, 3)) lines.push(`- ${e}`);
  } else {
    for (const f of (facts || []).slice(0, MAX_FACTS)) lines.push(`- ${f}`);
  }
  return lines.slice(0, 8).join("\n") + "\n";
}

function runCmd(file, args, cwd) {
  return spawnSync(file, args, {
    encoding: "utf8",
    cwd: cwd || process.cwd(),
    timeout: 20_000,
    maxBuffer: MAX_STDOUT + 4096,
    env: process.env,
  });
}

const SEARCH_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  "build",
  "coverage",
  ".git",
]);
const SEARCH_MAX_HITS = 20;
const SEARCH_MAX_FILE = 200 * 1024;

function parseSearchHits(stdout) {
  const hits = String(stdout || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const facts = hits.map((line) => {
    const m = line.match(/^([^:]+):(\d+):(.*)$/);
    if (!m) return line.slice(0, 160);
    return `${m[1]}:${m[2]} — ${m[3].trim().slice(0, 120)}`;
  });
  return { n: hits.length, facts };
}

function verdictFromHits({ n, facts }) {
  if (!n) {
    return {
      fallback: false,
      text: formatVerdict({ status: "empty", n: 0, facts: [] }),
      code: 0,
    };
  }
  return {
    fallback: false,
    text: formatVerdict({ status: "ok", n, facts }),
    code: 0,
  };
}

export function globToRegExp(glob) {
  const g = String(glob || "").replace(/\\/g, "/");
  let s = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      if (g[i + 2] === "/") {
        s += "(?:.*/)?";
        i += 2;
      } else {
        s += ".*";
        i += 1;
      }
    } else if (c === "*") s += "[^/]*";
    else if (c === "?") s += "[^/]";
    else s += escapeRe(c);
  }
  return new RegExp("^" + s + "$");
}

export function globMatch(rel, pattern) {
  const n = String(rel || "").replace(/\\/g, "/");
  let p = String(pattern || "").replace(/\\/g, "/");
  if (!p) return false;
  if (!p.includes("/")) p = "**/" + p;
  return globToRegExp(p).test(n) || globToRegExp(String(pattern).replace(/\\/g, "/")).test(n);
}

function fileMatchesGlobs(rel, globs) {
  if (!globs || !globs.length) return true;
  const base = path.posix.basename(rel);
  return globs.some((g) => globMatch(rel, g) || globMatch(base, g));
}

function nodeSearch(query, { cwd, start, glob } = {}) {
  let re;
  try {
    re = new RegExp(query);
  } catch {
    re = null;
  }
  const facts = [];
  let n = 0;
  const root = cwd || process.cwd();
  const origin = start || root;

  function searchFile(abs) {
    if (n >= SEARCH_MAX_HITS) return;
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      return;
    }
    if (!st.isFile() || st.size > SEARCH_MAX_FILE) return;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (!fileMatchesGlobs(rel, glob)) return;
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      return;
    }
    if (text.includes("\0")) return;
    const lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hit = re ? re.test(line) : line.includes(query);
      if (re) re.lastIndex = 0;
      if (!hit) continue;
      n += 1;
      if (facts.length < MAX_FACTS) {
        facts.push(`${rel}:${i + 1} — ${line.trim().slice(0, 120)}`);
      }
      if (n >= SEARCH_MAX_HITS) return;
    }
  }

  function walk(dir) {
    if (n >= SEARCH_MAX_HITS) return;
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      if (n >= SEARCH_MAX_HITS) return;
      if (SEARCH_SKIP_DIRS.has(ent.name)) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      searchFile(abs);
    }
  }

  let st;
  try {
    st = fs.statSync(origin);
  } catch {
    return { n: 0, facts: [] };
  }
  if (st.isFile()) searchFile(origin);
  else walk(origin);
  return { n, facts };
}

export function runSearch(query, { cwd, path: searchPath, glob } = {}) {
  const root = cwd || process.cwd();
  const start = searchPath ? resolveUnder(root, searchPath) : root;
  if (!start) {
    return { fallback: true, text: FALLBACK + "\n", code: 2 };
  }
  const globs = Array.isArray(glob) ? glob.filter(Boolean) : glob ? [String(glob)] : [];
  const relStart = path.relative(root, start) || ".";
  const rgArgs = [
    "-n",
    "--max-count",
    "20",
    "--max-filesize",
    "200K",
    "-g",
    "!node_modules",
    "-g",
    "!dist",
    "-g",
    "!coverage",
    "-g",
    "!.next",
    "-g",
    "!build",
    "-g",
    "!.git",
  ];
  for (const g of globs) {
    rgArgs.push("-g", g);
  }
  rgArgs.push("-e", query, relStart);
  const r = runCmd("rg", rgArgs, root);
  if (!(r.error && r.error.code === "ENOENT")) {
    const stdout = String(r.stdout || "");
    const stderr = String(r.stderr || "");
    if (looksHtmlOrUnbounded(stdout, stderr)) {
      return { fallback: true, text: FALLBACK + "\n", code: 2 };
    }
    if (r.status === 1) {
      return verdictFromHits({ n: 0, facts: [] });
    }
    if (r.status === 0) {
      return verdictFromHits(parseSearchHits(stdout));
    }
    if (r.status != null) {
      const errors = stderr
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        fallback: false,
        text: formatVerdict({
          status: "fail",
          n: 0,
          errors: errors.length ? errors : [`rg exit ${r.status}`],
        }),
        code: 0,
      };
    }
  }

  return verdictFromHits(nodeSearch(query, { cwd: root, start, glob: globs }));
}

function alreadyRtk(query) {
  const first = String(query || "").trim().split(/\s+/, 1)[0] || "";
  return first === "rtk" || first.endsWith("/rtk");
}

export function runExec(query, { cwd } = {}) {
  const q = String(query).trim();
  if (SHELL_META.test(q)) {
    return { fallback: true, text: FALLBACK + "\n", code: 2 };
  }
  const parts = q.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { fallback: true, text: FALLBACK + "\n", code: 2 };
  }
  let r;
  if (alreadyRtk(q)) {
    r = runCmd(parts[0], parts.slice(1), cwd);
  } else {
    r = runCmd("rtk", parts, cwd);
    if (r.error && r.error.code === "ENOENT") {
      r = runCmd(parts[0], parts.slice(1), cwd);
    }
  }
  if (r.error && r.error.code === "ENOENT") {
    return {
      fallback: false,
      text: formatVerdict({
        status: "fail",
        n: 0,
        errors: [String(r.error.code || "ENOENT")],
      }),
      code: 0,
    };
  }
  const stdout = String(r.stdout || "");
  const stderr = String(r.stderr || "");
  if (looksHtmlOrUnbounded(stdout, stderr)) {
    return { fallback: true, text: FALLBACK + "\n", code: 2 };
  }
  if (r.status !== 0) {
    const errors = stderr
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!errors.length) {
      const fromOut = stdout
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      errors.push(...fromOut);
    }
    return {
      fallback: false,
      text: formatVerdict({
        status: "fail",
        n: 0,
        errors: errors.length ? errors : [`exit ${r.status}`],
      }),
      code: 0,
    };
  }
  const lines = stdout
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length && !stderr.trim()) {
    return {
      fallback: false,
      text: formatVerdict({ status: "empty", n: 0, facts: [] }),
      code: 0,
    };
  }
  const facts = (lines.length ? lines : [stderr.trim()]).slice(0, MAX_FACTS);
  return {
    fallback: false,
    text: formatVerdict({
      status: "ok",
      n: lines.length || facts.length,
      facts,
    }),
    code: 0,
  };
}

function fallbackResult() {
  return { fallback: true, text: FALLBACK + "\n", code: 2 };
}

export function runJob({ job, query, cwd, path: searchPath, glob, unknown } = {}) {
  if (unknown) return fallbackResult();
  if (shouldFallback(job, query)) return fallbackResult();
  const root = cwd || process.cwd();
  if (job === "search") return runSearch(query, { cwd: root, path: searchPath, glob });
  return runExec(query, { cwd: root });
}

function main() {
  try {
    const parsed = parseArgv(process.argv.slice(2));
    if (parsed.unknown) {
      process.stdout.write(FALLBACK + "\n");
      return 2;
    }
    const ws = process.cwd();
    const cwd = parsed.cwd ? resolveJobCwd(parsed.cwd, ws) : ws;
    if (!cwd) {
      process.stdout.write(FALLBACK + "\n");
      return 2;
    }
    const result = runJob({
      job: parsed.job,
      query: parsed.query,
      cwd,
      path: parsed.path,
      glob: parsed.glob,
    });
    process.stdout.write(result.text);
    return result.code;
  } catch {
    process.stdout.write(FALLBACK + "\n");
    return 2;
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === thisFile || import.meta.url === pathToFileURL(invoked).href) {
  process.exit(main());
}
