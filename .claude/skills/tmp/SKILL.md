---
name: tmp
description: >
  One-off convo artifact dump under .tmp/grunt/. Use for /tmp, dump a draft,
  save a note/email/script from this session. Not a plan, not a handoff, not
  product source.
---
# tmp

One turn, in-parent. Parent authors from this session (email/script/note). **Do not spawn.** Write once. Recap path. Stop.

## Invocation

`/tmp [what]`

Empty `$ARGUMENTS` + no already-visible dumpable blob → `need task`. Empty + visible blob (code fence / draft) → dump that.

## When

Dump a one-off convo artifact. Not `/handoff` (no pickup no Goal/State/Next). Not `.tmp/grunt/plans/`. Not product source. Not OS `/tmp`.

## Path

`.tmp/grunt/{serial}-{slug}-{YYYYMMDDTHHMMSSZ}.{ext}`

- serial: unpadded int ≥ 1, next after existing tmp dumps (own counter; not plan/handoff serials)
- slug: lower, non `[a-z0-9]` → `-`, collapse, trim 50
- stamp: UTC `YYYYMMDDTHHMMSSZ`
- ext: `TMP_EXT` or explicit `.{ext}` in args; else `md`

## Write

```
TMP_NAME: <3-6 word name>
TMP_EXT: md
<artifact only>
```

`TMP_EXT` optional. Parent `write`s any root filename under `.tmp/grunt/` (not `plans|handoffs|browser|orchestrator-logs`). Grok `orchestrate-parent.js` runs `scripts/persist-tmp.mjs`: serial/slug/ext from `TMP_*`, strips those lines, no YAML frontmatter, rewrites path + content. Write outside that root or missing `TMP_NAME:` is denied.

Host without that hook: name the file per **Path** yourself, or pipe the body to `node scripts/persist-tmp.mjs --workspace {repo}` and use its `path`.

Never rewrite an existing dump; new serial. Artifact file content after hook = artifact only (no TMP_* lines no YAML frontmatter).

## Report

```
[tmp]: serial={int} path=.tmp/grunt/{serial}-{slug}-{stamp}.{ext}
```

Do not dump the body.

## Rules

- No spawn. One write. `/tmp` is not a mode. Slash `/tmp` = no leftover. Write leftover pick 1 (`Write with verbal plan`) uses this persist sequencing; recap `[tmp]:`; no implementer. No pickup.
- Never parent Read/Bash. Write `.tmp/grunt/` root files only.
- Secrets/tokens: refuse dump. Text artifacts only; no binary.
- Protocol: `.rulesync/reference/cascade.md`. Do not paste it here.
