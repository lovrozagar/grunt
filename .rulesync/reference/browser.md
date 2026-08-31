---
tags: [browser]
---

# Browser

Zero-config in-tree session rail. Not MCP. Not env. Not raw Playwright.

```
node scripts/browser.mjs nav|snap|click|fill|shot|pdf|stop|doctor|ensure
```

Default engine: **Lightpanda** (`lightpanda` on PATH). Chromium only when a rule below requires it.

## Verbs

| verb | purpose |
| --- | --- |
| `nav <url>` | launch or reuse session; go to URL |
| `snap` | markdown + numbered AX refs (default read) |
| `click <ref>` | click a ref from last `snap` |
| `fill <ref> <text>` | fill a ref from last `snap` |
| `shot` | screenshot (Chromium paint) |
| `pdf` | PDF (Chromium paint) |
| `stop` | reap engine pid; clear session; idempotent |
| `doctor` | unified prereq doctor (`scripts/doctor.mjs`); alias `ensure` |
| `ensure` | alias of `doctor` |

Session + profile + artifacts: `.tmp/grunt/browser/` only.

## Install

Run `grunt doctor` / `node scripts/doctor.mjs`. See README Prerequisites.

## Engine

Lightpanda first (`lightpanda serve` internally, CDP, `LP.getMarkdown` + AX refs).

Chromium immediately when any of:

- verb is `shot` | `pdf` | `trace`
- `process.platform === "win32"`
- paint-host URL (tiny set): figma, Google docs / sheets / slides, mail.google, earth
- `lightpanda` missing from PATH and a Chromium binary is present
- Lightpanda probe fails **once** → one Chromium replay of last URL; no loop

No user env. Never `GRUNT_BROWSER*`. Never `LIGHTPANDA_CDP_URL`.

## Non-goals

- MCP browser servers
- user env knobs
- raw Playwright as the agent tool
- grunt `job:browse`
- teaching thinker / orchestrator to browse

## RTK

`playwright` on the RTK command list is the **test-runner family only**. Browser rail is `lightpanda` + `scripts/browser.mjs`.
