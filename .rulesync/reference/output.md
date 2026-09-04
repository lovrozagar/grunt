---
tags: [output]
---

# Output

en-US unless asked. Terse complete sentences. First line is the glance; rest still readable. Lowest cognitive load for a glance and a full read. Parent and child. Every turn. Optional identity: `[role]:` then the sentence. Not a cipher. Do not encode status tokens or `files:`/`warn:` keys. No fragments-OK. No maximal superterse.

**Mid-turn** (in-flight): `[orchestrator]: wait grunt` only. `need:` stop = JSON only. Cascade recaps still start with `[role]:` so Stop can allow them. After the colon: a sentence not `done.` / `advise.`. Solo may omit the tag. Imperative = routing/mid-turn only. ⚠/validate: no recap; spawn.

**Final recap** (children done / child return): tagged recap. First line is glanceable and complete enough. Paths and test outcomes live in the sentences (“Wrote a.md. Tests green.”). Thinker how+why stay in the recap as prose (rejected alt + constraint) not `{decided}.{how}.{why}` slots. Parent copies that recap; pick1 spec = that recap; implementer must not paste why into code comments.

No literal `done:` `in_progress:` `left:` `blocked:` tokens. No `|` key join. Omit empty lines.

Do not recap as slogans: `research+advise done — implement on ask`; `done — rulesync check + tests green`; `leftover-gate done`; `jsonc comments now just options:`.

Buckets (semantic; not tokens):

- completed — work landed; past verbs + abs paths
- in-flight — siblings/peek still live; host state not past
- remainder — more work; noun + one recommended X then ask
- blocker — cannot continue; noun + one recommended X then ask

Past-tense: completed work = past verbs only. Remainder/blocker = noun + one recommended X then ask. Do not break `need:` JSON, wait-grunt, leftover 1/2/3, or legal first-line tag regex.

Ask = recap + stop (no invent ask_user_question). Named `Do X?` / `X? y/n`: `y` = accept X. Bare `ok`/`yes`/`y`/`continue` after advise still ≠ pick1/pick2.

**Do not ask** mid-turn / siblings-alive — stay `[orchestrator]: wait grunt` or tagged recap + peek.

Examples:
```
[orchestrator]: Wrote a.md.
[orchestrator]: Wrote a.md. Spawn implementer on /abs/b.md? y/n
[implementer]: Missing /abs/b.md. Prefetch via grunt? y/n
```

Child fills the tagged recap. Body may continue (plans/findings). Parent copies that recap (drop child tag; legal `[role]:` first line); no-strip; no compress-to-one-line; no body dump; no inventing files from logs. Multi-child: one recap; union paths in the sentences; worst remainder/blocker wins. In-flight siblings: exact `[orchestrator]: wait grunt` only (no leftover). `/handoff` `/tmp` serial/path recaps untouched. Advise leftover continues after the recap: one empty blank line then numbered pick each on own line.

Advise recap: first line `[role]:` then decided, how, and why as prose. Why = rejected alt + constraint. Parent echo = that recap verbatim-ish; no-strip. Do not dump body. Do not invent why if omitted. Pick1 recap-as-spec = that recap (how+why) not thinker body; implementer must not paste why into code comments. Always-why recap ≠ `/explain` (`/explain` = longer expansion, not the only grammar escape). Thinker recap without why is incomplete (leftover 3 / re-spawn).

`/write-plan`: remainder `/implement-plan` (ask). `/explain`: same four buckets; longer expansion.

Duties: implementer = every written path + test outcome in the sentences. thinker = advise recap with decided/how/why as prose; cite paths in sentences. grunt isolation = grunt-job facts ≤8 lines (size cap, not a recap cipher). Parent copies the recap; no invent files.

Grunt-job stdout (search/exec/test): a sentence plus up to 6 dash facts (fail: first 3 errors). Cap 8 lines. Resume/intercept paste that stdout as facts. No `verdict:`/`n:` wrappers. No `[role]:` wrap on the blob. Prompt stays `You are {agent} subagent.` plus the new facts only.

Advise leftover: numbered pick (number or full leftover label, or unique tail `verbal plan` / `file plan`). Always-print typed leftover triple (advise-class final recap only) unless effective leftover-gate=auto and Implement-typed (pick2 chain skip leftover wait). Else always-print typed triple on advise-class final recap. Write-typed under auto still leftover wait. One verb per recap; never jammed `Implement/write`. No leftover on `need:` JSON, wait-grunt, grunt/implementer recaps, slash-only turns. Leftover ⊆ remainder kinds. one empty blank line immediately before leftover 1. (leftover last; not adjacent to recap/body)
1. {Implement|Write} with verbal plan
2. {same verb} with file plan
3. Tweak
Type Implement — how = in-repo product writes (code tests `.rulesync/` CLAUDE/AGENTS skills). Product docs in-tree = Implement. Type Write — persist-only or implementer-nonsense: `.tmp/grunt/plans` inspect-pause `/tmp` artifact advise-only how/why with no product writes do-not-code external-human (SCA/bank/credentials). Recap remainder still names the human gate; leftover is not `4. Contact bank`. `/handoff` stays slash not Write pick1. Print all three every advise-class final recap. No omit 1/2. No frozen 4. Do not relabel 3.
```
[orchestrator]: Wrote /abs/a. Patch in-tree. Essays rejected — Stop allows multi-line.

1. Implement with verbal plan
2. Implement with file plan
3. Tweak
```
```
[orchestrator]: Advise-only how. Remainder persist note. Artifact not product — no in-repo writes.

1. Write with verbal plan
2. Write with file plan
3. Tweak
```
Parent echoes printed leftover lines. Reuse echo: reprint last thinker’s leftover triple. Always-do leftover match printed lines (output.md cascade.md skills Rules); not Skill-name (`2` ≠ write-plan). Stop leftover-lines = recap format only; no code maps leftover numbers → skills; no leftover-label parser. `1` / full label / unique tail `verbal plan` → pick1. `2` / full / `file plan` → pick2. `3` / `Tweak` → stay advise; extra text = revision notes → thinker; bare 3/Tweak = stop wait notes. Bare `implement`/`implementer` → pick1 iff Implement-typed; else recap “no implementer this remainder”; no spawn. Bare `write` → pick1 iff Write-typed; else not a match. Type-mismatch → that recap no spawn. Alias `Implementer with verbal plan` / `Implementer with file plan` → pick1/pick2 iff Implement-typed. Implement pick1 = spawn implementer; paste last [thinker] recap as spec — how+why; implementer must not paste why into code comments; no `.tmp/grunt/plans`; no write-plan; no implement-plan. Implement pick2 = persist `.tmp/grunt/plans/{n}` then spawn implementer `plan=/abs/...` (write-plan then implement-plan one-shot; skip inspect pause; no user slash). Write pick1 = `/tmp` sequencing: persist recap/body under `.tmp/grunt/`; no implementer. Write pick2 = write-plan sequencing only: thinker draft + persist `.tmp/grunt/plans/{n}`; stop inspect-pause; remainder ask `/implement-plan {n}`; no implementer this turn. `/write-plan` persist-only inspect-pause; remainder `/implement-plan {n}` (ask); ≠ leftover pick 2. `/implement-plan {n}` disk/file ≠ verbal. `ok`/`yes`/`y`/`continue` ≠ either pick.
Owned-defect recap: `Fix {owned path}`. Leftover always-print typed triple (Implement when in-repo writes). Do not relabel 3 to the bug. Workaround in why not remainder.
