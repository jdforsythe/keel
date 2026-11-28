# Task 0129-0148: red-team mediums and follow-ups, batch 3

**Spec:** k.check (0129) · k.store k.server (0131, 0148) · k.compiler k.cli (0139, 0143, 0144) · k.testing (0130) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0129 (agent A done: rfc:0053, ADR-0042; per-file binding table, E1601 at the use, new E1603 eval/Function in k.ctx, E1002 sinks widened in compiler ruleRawHtml.ts; check budget re-based 27 → 30 kB, D7; mutation run skipped at the 10-minute cap) E1601 and E1002 detection gaps: aliased/computed `Date`/`Math` access, destructuring, `eval`/`new Function`, `Reflect.set(..., 'innerHTML')`, `DOMParser` (check)
- [x] 0130 closed by rfc:0049: ledger.json shows k.services 9/9, k.errors 8/8, k.testing 10/10, k.scaffold 7/7, std.geo 5/5, std.brands 6/6 clauses above `none`; E1707 gates the status (verified 2026-11-07, no code)
- [x] 0131 (agent C done: rfc:0054, ADR-0044; `logLimit` default 256, oldest folded into base on commit/restore; undo past the window returns false; caller in loaders/actions is the base64url SHA-256 of the cookie token; Saved parsed once per version; server budget re-based 11 → 11.5 kB, +139 B, D7) store log limit and compaction on save; caller tokens not persisted forever (store, server)
- [x] 0148 (agent C done: commit validates every opened key; factory keys load in one inOrder section; serializability property test) write skew and read skew: validate every opened key's `from` at commit; load a factory's keys under one `inOrder` (server)
- [x] 0139 (agent B done: rfc:0055, ADR-0043; option (a): routes.json with a routes.ts is W1005 "not verified" in check, compared at vite build; no sandbox exists; k.compiler 1,495 tokens; follow-ups 0149, 0150 filed) routes.json compared where routes are evaluated, or a sandboxed evaluator (compiler, cli, check)
- [x] 0143 (agent B: `artifacts.hashes` override removed; `CheckOptions.project` names the derivation files; unknown artifact name is E1005) `check()` fails closed on a missing artifact name in `artifacts.hashes` (check)
- [x] 0144 (agent B: each `<dir>/.keel/` compared against sources under `<dir>`, one compile per project; 31 files from root and in-app) workspace `keel check` compares nested `apps/<x>/.keel/*.json` against their app's sources (cli, check)

## Steps
1. [x] PLAN; three agents in parallel: A check rules (0129); B artifacts path (0139, 0143, 0144: check generatedEdits/check.ts/CheckOptions, cli, compiler artifactHashes); C server+store (0131, 0148).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 401 items, 357 verified, 6 unsafe, 0 lowered, 0 uncovered`. Reviewer + red-team running.
3. [x] 0151/0153 fixed in-batch; final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 401 items, 357 verified, 6 unsafe, 0 lowered, 0 uncovered`; two code commits (rfc:0053+0055 check/cli/compiler cluster; rfc:0054 store/server) because the clusters share EXPLANATIONS.ts, k.compiler.md and budgets.json (rfc:0053/0054/0055), flip backlog, handoff, push.

## Decisions
- D1: Ownership: A owns check rule internals and KERNEL_RULES/EXPLANATIONS lines for E1601/E1002 plus check conformance for rfc:0053; B owns check.ts, generatedEdits.ts, CheckOptions, cli, compiler; C owns server and store. Any cross-owner need is reported, not edited.
- D3: Read-set validation means overlapping actions on one factory 409 even when they write different stores; accepted (correctness over throughput; local topology).
- D4: Budget re-bases (D7): `@keel/check` 27 → 30 kB because rfc:0053 adds a per-file binding table (globalRefs, ResolvedGlobals, unwrapExpression) and the E1603 rule, +1,997 B gzip after trimming, with ~1.6 KB not recoverable without merging rule walkers; `@keel/server` 11 → 11.5 kB for rfc:0054 read-set tracking and caller hashing, +139 B. Reasons repeated in the commit messages.
- D5: red-team batch 3 filed 0151-0155; 0151 (exported alias unreported, violates the rfc:0053 clause) and 0153 (new E1601 false positives on constructor constants and instanceof) are fixed in-batch by agent A; 0152 (more ambients, Function.prototype.constructor, data: import), 0154 (E1002 should share the resolver), 0155 (W1005 fires on every clean check of an app with routes.ts; routes.json still unverified anywhere routine) stay as follow-ups with 0149, 0150.
- D2: RFC numbers reserved: 0053 (0129), 0054 (0131), 0055 (0139 if a spec change is needed).

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro is a failing-then-passing test

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1402 files` · `ok budgets 46 measured` · `ok ledger --diff 401 items, 357 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 4: lows 0132-0137; then 0149, 0150, 0152, 0154, 0155.