import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

const PRODUCT_SCRIPTS = [
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
  "scrub-text",
]

const COPY_DIRS = [".rulesync", ".grok", ".codex", ".claude", ".agents"]
const COPY_FILES = ["AGENTS.md", "CLAUDE.md", ".mcp.json"]

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]))
}

export function samePath(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b)
  } catch {
    return path.resolve(a) === path.resolve(b)
  }
}

export function mergeGitignore(dest) {
  const gi = path.join(dest, ".gitignore")
  if (!fs.existsSync(gi)) {
    fs.writeFileSync(gi, ".tmp/\n")
    return
  }
  const text = fs.readFileSync(gi, "utf8")
  const has = text.split(/\r?\n/).some((line) => /^\.tmp\/?$/.test(line))
  if (has) return
  const prefix = text.endsWith("\n") || text.length === 0 ? "" : "\n"
  fs.appendFileSync(gi, `${prefix}.tmp/\n`)
}

export function mergePackageJson(dest, pkgRoot) {
  const destPath = path.join(dest, "package.json")
  let destPkg = {}
  if (fs.existsSync(destPath)) {
    destPkg = JSON.parse(fs.readFileSync(destPath, "utf8"))
  }
  if (destPkg.name === "@lovrozagar/grunt") return

  const srcPkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"))
  destPkg.scripts = { ...(destPkg.scripts || {}) }
  for (const [k, v] of Object.entries(srcPkg.scripts || {})) {
    if (k === "test") continue
    destPkg.scripts[k] = v
  }
  destPkg.devDependencies = { ...(destPkg.devDependencies || {}) }
  destPkg.devDependencies["smol-toml"] = srcPkg.devDependencies["smol-toml"]
  destPkg.devDependencies["rulesync"] = srcPkg.devDependencies["rulesync"]
  destPkg.scripts = sortKeys(destPkg.scripts)
  destPkg.devDependencies = sortKeys(destPkg.devDependencies)
  fs.writeFileSync(destPath, `${JSON.stringify(destPkg, null, 2)}\n`)
}

export function init(dest, { pkgRoot: pkgRootOpt, execFileSync: exec = execFileSync } = {}) {
  dest = path.resolve(dest)
  const pkgRoot = path.resolve(pkgRootOpt ?? PKG_ROOT)

  for (const dir of COPY_DIRS) {
    const src = path.join(pkgRoot, dir)
    const d = path.join(dest, dir)
    fs.mkdirSync(d, { recursive: true })
    if (!samePath(src, d)) fs.cpSync(src, d, { recursive: true, force: true })
  }

  for (const file of COPY_FILES) {
    const src = path.join(pkgRoot, file)
    const d = path.join(dest, file)
    if (!samePath(src, d)) fs.copyFileSync(src, d)
  }

  fs.mkdirSync(path.join(dest, "scripts"), { recursive: true })
  for (const name of PRODUCT_SCRIPTS) {
    const src = path.join(pkgRoot, "scripts", name)
    const d = path.join(dest, "scripts", name)
    if (samePath(src, d)) continue
    const st = fs.statSync(src)
    if (st.isDirectory()) fs.cpSync(src, d, { recursive: true, force: true })
    else fs.copyFileSync(src, d)
  }

  fs.mkdirSync(path.join(dest, ".tmp"), { recursive: true })
  mergeGitignore(dest)

  const self = samePath(dest, pkgRoot)
  // Self-skip: file/dir merge + .tmp + gitignore only. No package.json merge,
  // npm install, or generate/sync/check (would mutate this package in-place).
  if (self) return

  mergePackageJson(dest, pkgRoot)
  exec("npm", ["install"], { cwd: dest, stdio: "inherit" })
  exec("npm", ["run", "rulesync:generate"], { cwd: dest, stdio: "inherit" })
  exec("npm", ["run", "sync:globals:apply"], { cwd: dest, stdio: "inherit" })
  exec("npm", ["run", "rulesync:check"], { cwd: dest, stdio: "inherit" })
}
