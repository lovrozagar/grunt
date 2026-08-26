import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { init } from "./init.mjs"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

const USAGE = `Usage: grunt [command]

Default (no command): init — full setup

Commands:
  init       Full setup: merge SoT, npm install, rulesync:generate, sync:globals:apply, rulesync:check
  generate   npm run rulesync:generate
  check      npm run rulesync:check
  help       Show this help
  version    Print package version
`

function pkgVersion() {
  const pkg = JSON.parse(readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"))
  return pkg.version
}

function npmRun(script) {
  execFileSync("npm", ["run", script], { cwd: process.cwd(), stdio: "inherit" })
}

export function start() {
  const [cmd] = process.argv.slice(2)
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE)
    return
  }
  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    process.stdout.write(`${pkgVersion()}\n`)
    return
  }
  if (!cmd || cmd === "init") {
    init(process.cwd())
    return
  }
  if (cmd === "generate") {
    npmRun("rulesync:generate")
    return
  }
  if (cmd === "check") {
    npmRun("rulesync:check")
    return
  }
  process.stdout.write(USAGE)
  process.exitCode = 1
}
