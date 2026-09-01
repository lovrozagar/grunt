---
tags: [output]
---

# Output

en-US unless asked. every output maximal superterse. Fragments OK. Sacrifice grammar; keep meaning. Parent and child. Every turn, not final-only. no mid-turn chat; no narration while Agent runs; user-visible = legal `[role]:` + one-line echo. Advise leftover: numbered pick each on own line after that tagged recap — do not cram 1./2./3. onto the recap line

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

Child first line = those buckets in natural language. Body may continue (plans/findings). Parent echo one recap line. Advise leftover continues after it numbered pick each on own line. Do not force children to one line only for body/logs.

Advise recap includes why-clause (one clause not treatise): `{decided}. {how-capsule}. {why-clause}`. Why-clause = rejected alt + constraint. Parent echo = that recap verbatim-ish; no-strip; forbid compress-to-verdict. Still one recap line. Do not dump body. Do not invent why if omitted. Pick1 recap-as-spec includes how+why; implementer must not paste why into code comments. Always-why recap ≠ `/explain` (`/explain` = expansion not the why path).

`/write-plan`: remainder `/implement-plan` (ask). `/explain`: same four buckets; sentences OK.

Advise leftover: numbered pick (number or full leftover label, or unique tail `verbal plan` / `file plan`):
1. Implementer with verbal plan
2. Implementer with file plan
3. Tweak
```
[orchestrator]: wrote /abs/a
1. Implementer with verbal plan
2. Implementer with file plan
3. Tweak
```
Always-do leftover match (output.md cascade.md skills Rules); not Skill-name (`2` ≠ write-plan). Stop leftover-lines = recap format only; no code maps `2` → skill names. 1 / that label / explicit implement → pick1 (spawn implementer; paste last [thinker] recap as spec — how+why; implementer must not paste why into code comments; no plan file; no write-plan; no implement-plan). Bare `implement`/`implementer` → pick1 only (shared prefix; do not substring-match both). 2 / that label → persist `.tmp/plans/{n}` then spawn implementer `plan=/abs/...` (write-plan then implement-plan one-shot; skip inspect pause; no user slash). 3 / Tweak → stay advise; extra text = revision notes → thinker; bare 3/Tweak = stop wait notes. `/write-plan` persist-only inspect-pause; remainder `/implement-plan {n}` (ask); not a leftover number. `/implement-plan {n}` disk/file ≠ verbal. `ok`/`yes`/`y`/`continue` ≠ either implement path.
