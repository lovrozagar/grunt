import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

const PRODUCT_SCRIPTS = [
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
  "scrub-text",
]

const COPY_DIRS = [".rulesync", ".grok", ".codex", ".claude", ".agents"]
const GUARDED_MD_FILES = ["AGENTS.md", "CLAUDE.md"]
// .mcp.json is intentionally not copied here: scripts/emit-mcp-policy.mjs
// (run via `rulesync:generate`, see mergeClaudeSettings ordering) owns and
// merges it, so a plain-copy would just be clobbered/redundant.
const OWNED_HOOK_FILES = ["scrub-spawn-prompt.mjs", "gate-fat-tools.mjs", "orchestrate-parent.js"]
const SENTINEL_BEGIN = "<!-- grunt:begin -->"
const SENTINEL_END = "<!-- grunt:end -->"

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

function destHasGruntSentinel(dest) {
  return GUARDED_MD_FILES.some((file) => {
    const p = path.join(dest, file)
    return fs.existsSync(p) && fs.readFileSync(p, "utf8").includes(SENTINEL_BEGIN)
  })
}

export function destAlreadyInited(dest) {
  return (
    fs.existsSync(path.join(dest, "scripts", "telemetry.mjs")) ||
    fs.existsSync(path.join(dest, ".grok", "hooks", "orchestrate-parent.js")) ||
    fs.existsSync(path.join(dest, ".rulesync"))
  )
}

export function shouldAutoSkipGlobals(dest) {
  return destHasGruntSentinel(dest) || fs.existsSync(path.join(dest, "scripts", "telemetry.mjs"))
}

export function mergeGuardedMarkdown(dest, pkgRoot, file, { alreadyInited = false } = {}) {
  const src = path.join(pkgRoot, file)
  const d = path.join(dest, file)
  if (samePath(src, d)) return
  const srcText = fs.readFileSync(src, "utf8")

  if (!fs.existsSync(d)) {
    fs.writeFileSync(d, `${SENTINEL_BEGIN}\n${srcText}\n${SENTINEL_END}\n`)
    return
  }

  const destText = fs.readFileSync(d, "utf8")
  const hasSentinel = [SENTINEL_BEGIN, SENTINEL_END].every((marker) => destText.includes(marker))

  if (!hasSentinel) {
    if (alreadyInited) return "skipped-side-file"
    const gruntFile = file.replace(/\.md$/, ".grunt.md")
    fs.writeFileSync(path.join(dest, gruntFile), srcText)
    console.log(`${file} exists without grunt sentinel; wrote ${gruntFile} instead (original untouched)`)
    return
  }

  const beginIdx = destText.indexOf(SENTINEL_BEGIN)
  const endIdx = destText.indexOf(SENTINEL_END)
  const before = destText.slice(0, beginIdx)
  const after = destText.slice(endIdx + SENTINEL_END.length)
  fs.writeFileSync(d, `${before}${SENTINEL_BEGIN}\n${srcText}\n${SENTINEL_END}${after}`)
}

export function mergeClaudeSettings(destRoot, pkgRoot) {
  const srcPath = path.join(pkgRoot, ".claude", "settings.json")
  const destPath = path.join(destRoot, ".claude", "settings.json")

  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.copyFileSync(srcPath, destPath)
    return
  }

  let destSettings
  try {
    destSettings = JSON.parse(fs.readFileSync(destPath, "utf8"))
  } catch (err) {
    throw new Error(`malformed JSON in ${destPath}: ${err.message}`)
  }

  const srcSettings = JSON.parse(fs.readFileSync(srcPath, "utf8"))
  const isOwnedGroup = (group) =>
    group.hooks.every((entry) => OWNED_HOOK_FILES.some((f) => entry.command.includes(f)))

  const destHooks = { ...(destSettings.hooks || {}) }
  for (const [event, srcGroups] of Object.entries(srcSettings.hooks)) {
    const destGroups = destHooks[event] || []
    destHooks[event] = [...destGroups.filter((group) => !isOwnedGroup(group)), ...srcGroups]
  }
  destSettings.hooks = destHooks

  const destPerms = { ...(destSettings.permissions || {}) }
  for (const key of ["deny", "allow"]) {
    const destList = destPerms[key] || []
    const srcList = srcSettings.permissions[key] || []
    const seen = new Set(destList)
    const merged = [...destList]
    for (const item of srcList) {
      if (!seen.has(item)) {
        seen.add(item)
        merged.push(item)
      }
    }
    destPerms[key] = merged
  }
  destSettings.permissions = destPerms

  for (const key of Object.keys(srcSettings)) {
    if (key.toLowerCase().includes("mcp")) {
      destSettings[key] = srcSettings[key]
    }
  }

  fs.writeFileSync(destPath, `${JSON.stringify(destSettings, null, 2)}\n`)
}

function looksGruntOwnedPrefix(prefix) {
  return /rulesync|sync:globals|^npm run /.test(prefix)
}

function commandCount(script) {
  return script.split(/\s*(?:&&|;)\s*/).filter(Boolean).length
}

function extraOwnedSuffix(cur, newSrc) {
  const nNew = commandCount(newSrc)
  const nCur = commandCount(cur)
  if (nCur <= nNew) return null
  let completed = 1
  const re = / &&| ;|&&/g
  let m
  while ((m = re.exec(cur))) {
    if (completed === nNew) {
      const prefix = cur.slice(0, m.index)
      if (!looksGruntOwnedPrefix(prefix)) return null
      return cur.slice(m.index)
    }
    completed++
  }
  return null
}

function mergeScriptValue(name, newSrc, cur) {
  if (cur == null) return newSrc
  if (cur.startsWith(newSrc)) return cur
  const suffix = extraOwnedSuffix(cur, newSrc)
  if (suffix != null) return newSrc + suffix
  if (looksGruntOwnedPrefix(cur)) return newSrc
  console.warn(`script \`${name}\` left untouched (unrelated customization)`)
  return cur
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
    destPkg.scripts[k] = mergeScriptValue(k, v, destPkg.scripts[k])
  }
  destPkg.devDependencies = { ...(destPkg.devDependencies || {}) }
  destPkg.devDependencies["smol-toml"] = srcPkg.devDependencies["smol-toml"]
  destPkg.devDependencies["rulesync"] = srcPkg.devDependencies["rulesync"]
  destPkg.scripts = sortKeys(destPkg.scripts)
  destPkg.devDependencies = sortKeys(destPkg.devDependencies)
  fs.writeFileSync(destPath, `${JSON.stringify(destPkg, null, 2)}\n`)
}

export function init(dest, { pkgRoot: pkgRootOpt, execFileSync: exec = execFileSync, skipGlobals = false, applyGlobals, onPhase } = {}) {
  dest = path.resolve(dest)
  const pkgRoot = path.resolve(pkgRootOpt ?? PKG_ROOT)
  const alreadyInited = destAlreadyInited(dest)
  const skipGlobalsApply =
    applyGlobals === true ? false : skipGlobals || shouldAutoSkipGlobals(dest)

  const phase = (name, fn) => {
    onPhase?.(name, "start")
    try {
      fn()
    } finally {
      onPhase?.(name, "stop")
    }
  }

  const self = samePath(dest, pkgRoot)

  phase("merge", () => {
    for (const dir of COPY_DIRS) {
      const src = path.join(pkgRoot, dir)
      const d = path.join(dest, dir)
      fs.mkdirSync(d, { recursive: true })
      if (samePath(src, d)) continue
      if (dir === ".claude") {
        fs.cpSync(src, d, {
          recursive: true,
          force: true,
          filter: (s) => path.basename(s) !== "settings.json",
        })
        mergeClaudeSettings(dest, pkgRoot)
      } else {
        fs.cpSync(src, d, { recursive: true, force: true })
      }
    }

    let skippedSideFile = false
    for (const file of GUARDED_MD_FILES) {
      if (mergeGuardedMarkdown(dest, pkgRoot, file, { alreadyInited }) === "skipped-side-file") {
        skippedSideFile = true
      }
    }
    if (skippedSideFile) {
      console.log("AGENTS.md/CLAUDE.md lack markers and were left alone")
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

    if (!self) mergePackageJson(dest, pkgRoot)
  })

  // Self-skip: file/dir merge + .tmp + gitignore only. No package.json merge,
  // npm install, or generate/sync/check (would mutate this package in-place).
  if (self) return

  const runNpm = (name, args) => {
    onPhase?.(name, "start")
    onPhase?.(name, "stop")
    exec("npm", args, { cwd: dest, stdio: "inherit" })
  }
  runNpm("install", ["install"])
  runNpm("generate", ["run", "rulesync:generate"])
  if (!skipGlobalsApply) {
    runNpm("sync-globals", ["run", "sync:globals:apply"])
  }
  runNpm("check", ["run", "rulesync:check"])
}
