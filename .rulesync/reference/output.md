---
tags: [output]
---

# Output

en-US unless asked. every output maximal superterse. Fragments OK. Sacrifice grammar; keep meaning. Parent and child. Every turn, not final-only. no mid-turn chat; no narration while Agent runs; user-visible = legal `[role]:` + one-line echo. Advise leftover: numbered pick each on own line after that tagged recap — do not cram 1./2. onto the recap line

**Mid-turn** (in-flight; first line still legal tag): `[orchestrator]: wait grunt` only. `need:` stop = JSON only. Grunt isolation = `verdict:` only; parent maps to natural recap. ⚠/validate: no recap; spawn. Imperative = routing/mid-turn only.

**Final recap** (children done / child return; omit empty buckets): natural language. No literal `done:` `in_progress:` `left:` `blocked:` tokens. No `|` key join.

Buckets (semantic; not tokens):

- completed — work landed; past verbs + abs paths
- in-flight — siblings/peek still live; host state not past
- remainder — more work; noun + one recommended X then ask
- blocker — cannot continue; noun + one recommended X then ask

Past-tense: completed work = past verbs only. Remainder/blocker = noun + one recommended X then ask. Do not break `need:` JSON, `verdict:`, wait-grunt, or legal first-line tag regex.

Ask = recap line + stop (no invent ask_user_question). Named `Do X?` / `X? y/n`: `y` = accept X. Bare `ok`/`yes`/`y`/`continue` after advise still ≠ Implement unless named/numbered Implement.

**Do not ask** mid-turn / siblings-alive — stay `[orchestrator]: wait grunt` or tag+echo + peek.

Examples:
```
[orchestrator]: wrote /abs/a.md
[orchestrator]: wrote /abs/a.md. Spawn implementer on /abs/b.md? y/n
[implementer]: missing /abs/b.md. Prefetch via grunt? y/n
```

Child first line = those buckets in natural language. Body may continue (plans/findings). Parent echo one recap line. Advise leftover continues after it numbered pick each on own line. Do not force children to one line only.

`/write-plan`: remainder `/implement-plan` (ask). `/explain`: same four buckets; sentences OK.

Advise leftover: numbered pick (slash `/implement-plan` + explicit implement = Implement aliases):
1. Implement
2. Tweak
```
[orchestrator]: wrote /abs/a
1. Implement
2. Tweak
```
