---
tags: [output]
---

# Output

en-US unless asked. every output maximal superterse. Fragments OK. Sacrifice grammar; keep meaning. Parent and child. Every turn, not final-only. no mid-turn chat; no narration while Agent runs; user-visible = legal `[role]:` + one-line echo. Advise leftover: numbered pick each on own line after that tagged recap; one empty blank line immediately before leftover 1. (leftover last; not adjacent to recap/body) — do not cram 1./2./3. onto the recap line

**Mid-turn** (in-flight; first line still legal tag): `[orchestrator]: wait grunt` only. `need:` stop = JSON only. Grunt isolation = `verdict:` only; parent maps to natural recap. ⚠/validate: no recap; spawn. Imperative = routing/mid-turn only.

**Final recap** (children done / child return; omit empty buckets): natural language. No literal `done:` `in_progress:` `left:` `blocked:` tokens. No `|` key join.

Buckets (semantic; not tokens):

- completed — work landed; past verbs + abs paths
- in-flight — siblings/peek still live; host state not past
- remainder — more work; noun + one recommended X then ask
- blocker — cannot continue; noun + one recommended X then ask

Past-tense: completed work = past verbs only. Remainder/blocker = noun + one recommended X then ask. Do not break `need:` JSON, `verdict:`, wait-grunt, or legal first-line tag regex.

Ask = recap line + stop (no invent ask_user_question). Named `Do X?` / `X? y/n`: `y` = accept X. Bare `ok`/`yes`/`y`/`continue` after advise still ≠ pick1/pick2.

**Do not ask** mid-turn / siblings-alive — stay `[orchestrator]: wait grunt` or tag+echo + peek.

Examples:
```
[orchestrator]: wrote /abs/a.md
[orchestrator]: wrote /abs/a.md. Spawn implementer on /abs/b.md? y/n
[implementer]: missing /abs/b.md. Prefetch via grunt? y/n
```

Child first line = those buckets in natural language. Body may continue (plans/findings). Parent echo one recap line. Advise leftover continues after it: one empty blank line then numbered pick each on own line. Do not force children to one line only for body/logs.

Advise recap includes why-clause (one clause not treatise): `{decided}. {how-capsule}. {why-clause}`. Why-clause = rejected alt + constraint. Parent echo = that recap verbatim-ish; no-strip; forbid compress-to-verdict. Still one recap line. Do not dump body. Do not invent why if omitted. Pick1 recap-as-spec includes how+why; implementer must not paste why into code comments. Always-why recap ≠ `/explain` (`/explain` = expansion not the why path).

`/write-plan`: remainder `/implement-plan` (ask). `/explain`: same four buckets; sentences OK.

Advise leftover: numbered pick (number or full leftover label, or unique tail `verbal plan` / `file plan`). Always-print typed leftover triple (advise-class final recap only) unless effective leftover-gate=auto and Implement-typed (pick2 chain skip leftover wait). Else always-print typed triple on advise-class final recap. Write-typed under auto still leftover wait. One verb per recap; never jammed `Implement/write`. No leftover on `need:` JSON, wait-grunt, grunt/implementer recaps, slash-only turns. Leftover ⊆ remainder kinds.
1. {Implement|Write} with verbal plan
2. {same verb} with file plan
3. Tweak
Type Implement — how-capsule = in-repo product writes (code tests `.rulesync/` CLAUDE/AGENTS skills). Product docs in-tree = Implement. Type Write — persist-only or implementer-nonsense: `.tmp/grunt/plans` inspect-pause `/tmp` artifact advise-only how/why with no product writes do-not-code external-human (SCA/bank/credentials). Recap remainder still names the human gate; leftover is not `4. Contact bank`. `/handoff` stays slash not Write pick1. Print all three every advise-class final recap. No omit 1/2. No frozen 4. Do not relabel 3.
```
[orchestrator]: wrote /abs/a

1. Implement with verbal plan
2. Implement with file plan
3. Tweak
```
```
[orchestrator]: advise-only how. Remainder persist note.

1. Write with verbal plan
2. Write with file plan
3. Tweak
```
Parent echoes printed leftover lines. Reuse echo: reprint last thinker’s leftover triple. Always-do leftover match printed lines (output.md cascade.md skills Rules); not Skill-name (`2` ≠ write-plan). Stop leftover-lines = recap format only; no code maps leftover numbers → skills; no leftover-label parser. `1` / full label / unique tail `verbal plan` → pick1. `2` / full / `file plan` → pick2. `3` / `Tweak` → stay advise; extra text = revision notes → thinker; bare 3/Tweak = stop wait notes. Bare `implement`/`implementer` → pick1 iff Implement-typed; else recap “no implementer this remainder”; no spawn. Bare `write` → pick1 iff Write-typed; else not a match. Type-mismatch → that recap no spawn. Alias `Implementer with verbal plan` / `Implementer with file plan` → pick1/pick2 iff Implement-typed. Implement pick1 = spawn implementer; paste last [thinker] recap as spec — how+why; implementer must not paste why into code comments; no `.tmp/grunt/plans`; no write-plan; no implement-plan. Implement pick2 = persist `.tmp/grunt/plans/{n}` then spawn implementer `plan=/abs/...` (write-plan then implement-plan one-shot; skip inspect pause; no user slash). Write pick1 = `/tmp` sequencing: persist recap/body under `.tmp/grunt/`; no implementer. Write pick2 = write-plan sequencing only: thinker draft + persist `.tmp/grunt/plans/{n}`; stop inspect-pause; remainder ask `/implement-plan {n}`; no implementer this turn. `/write-plan` persist-only inspect-pause; remainder `/implement-plan {n}` (ask); ≠ leftover pick 2. `/implement-plan {n}` disk/file ≠ verbal. `ok`/`yes`/`y`/`continue` ≠ either pick.
Owned-defect recap: `Fix {owned path}`. Leftover always-print typed triple (Implement when in-repo writes). Do not relabel 3 to the bug. Workaround in why-clause not remainder.
