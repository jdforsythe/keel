# Task 0123/0124: red-team 2026-11-07 highs

**Spec:** k.server, k.ui (0123) · k.compiler (0124) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl; no .worktrees) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0123 server DOM (agent done; InvalidCharacterError on bad names, comments escaped `--`→`- -`, script `</script`→`<\/script`, style `</style` throws, Box/Text check `as`; ui bundle 2594/4096 gzip; +@keel/ui devDep in server, lockfile +3): `createElement`/`setAttribute` throw on invalid element and attribute names; comment serialization cannot break out (`--`, `>`); raw text in `<script>`/`<style>` cannot close the element; `@keel/ui` elements check `as` at runtime. Repro from the backlog line is a test.
- [x] 0124 (rfc:0050, ADR-0039; `artifactHashes` in compiler, `artifacts.hashes` in check derived from the project's sources by runCheck; stale == forged == E1005 "does not match its sources; regenerate"; routes.json compared only without routes.ts, follow-up backlog; k.compiler 1,497 tokens) E1005 detects a forged artifact: `keel check` compares `.keel/*.json` against the compiler's hashes of the current sources, not only against the artifact's own self-hash; forged-hash conformance test; spec clause stays true.

## Steps
1. [x] PLAN written; two opus agents in parallel (server+ui / compiler+check+cli), disjoint packages.
2. [x] Agents reported; `ok check`, `ok test 39 tasks`, `ok ledger --diff 392 items, 347 verified, 6 unsafe, 0 lowered, 0 uncovered`; ledger.json regenerated.
3. [x] reviewer approved (no fix). red-team filed 0139-0144; 0140 (adjacent text pieces, comments in script/style, svg style), 0141 (Heading level) and 0142 (build/check source-selection mismatch, false E1005 after build) are regressions of this batch and are fixed in-batch by the two agents; 0139, 0143, 0144 stay as follow-ups. (WORKFLOW Batches); findings to backlog.
4. [x] 0140/0141/0142 fixed in-batch; final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 392 items, 347 verified, 6 unsafe, 0 lowered, 0 uncovered`; commit by explicit path (`rfc:0050` on the 0124 commit), flip backlog lines, handoff, push.

## Decisions
- D1: 0124 is an RFC (backlog marks it so): rfc:0050. 0123 is a bug fix under existing clauses (k.compiler "renders verbatim ... creates no element"); it becomes rfc:0051 only if a new conformance clause is needed.
- D2: Both run in this worktree; agents stage nothing; orchestrator commits by path.

## Verification
- [x] `pnpm check` and `pnpm test` green
- [x] `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe count 6 unchanged or justified
- [x] backlog repros for 0123 and 0124 are failing-then-passing tests

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1370 files` · `ok budgets 46 measured` · `ok ledger --diff 392 items, 347 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 2: mediums 0125-0128.