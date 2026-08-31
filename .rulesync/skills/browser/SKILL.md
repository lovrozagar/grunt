---
name: browser
description: >
  Session browser rail. /browser or browse a URL. Call
  node scripts/browser.mjs nav|snap|click|fill|shot|pdf|stop.
  Lightpanda default; snap is the default read. Windows → Chromium.
  Never MCP. Never env knobs. Never raw Playwright.
---

Zero-config. `node scripts/browser.mjs <verb>`.

Verbs: `nav <url>` · `snap` · `click <ref>` · `fill <ref> <text>` · `shot` · `pdf` · `stop` · `doctor` · `ensure`.

- **snap** = default read (markdown + numbered refs). `click`/`fill` need a prior snap.
- Lightpanda default. Chromium when `shot`/`pdf`/`trace`, win32, missing Lightpanda, probe-fail once, or paint hosts (figma docs/sheets/slides mail.google earth).
- Session/profile: `.tmp/grunt/browser/`. `stop` reaps; second `stop` ok.
- Windows: Chromium even if Lightpanda exists.
- `doctor`/`ensure` → `node scripts/doctor.mjs` or `grunt doctor`. See README Prerequisites.
- No env. No MCP. No raw Playwright. Spec: `.rulesync/reference/browser.md`.
