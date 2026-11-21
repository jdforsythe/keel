# Task 0165 + follow-ups + 0138: batch 6

**Spec:** k.compiler k.ctx (0165, 0170, 0171) · k.server k.ui k.forms std.timings (0166, 0172) · k.cli k.check k.schema k.ctx k.store (0138) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0165 (agent A done: rfc:0061, ADR-0050; element-valued child expressions are E1403 with an `<If when fallback>` rewrite fix when `If` is imported; covers ?:, &&, ||, ??, arrays, map/flatMap, function children, same-file bindings; If fallback now renders; compiler 24,269/24,576 B) element-valued conditional expressions lower as node bindings (or a diagnostic), never "[object Object]" (compiler, runtime-dom)
- [x] 0170 (agent A: resolver follows never-assigned let/var keys and aliased Object.assign/defineProperties maps) E1002 follows never-assigned `let`/`var` keys and object values passed to Object.assign/defineProperties (compiler)
- [x] 0171 (agent A: blob:/data: in import() and Worker/SharedWorker; getPrototypeOf(fn).constructor) E1603 covers blob: URLs in import()/Worker and getPrototypeOf(...).constructor (check)
- [x] 0166 (agent B done: rfc:0062, ADR-0051; Field.bind and ui controls write value/checked/selected into markup on the first sync effect, server DOM unchanged; password/file get no value attribute; golden-1 ssrNode asserts the edit page values; follow-up 0174 filed) server-rendered form controls show their values: decide where `value`/`checked`/`selected` attributes are written on first render (ui, forms, server)
- [x] 0172 (agent B: two segments, protected ≤192 for names called twice, dropped counts unprotected evictions only) timings cap keeps names with history in a protected segment (std-timings)
- [x] 0138 (agent C + D: k.schema, k.ctx, k.store, k.cli flipped; toJsonSchema emits additionalProperties:false only for closed objects (rfc:0029); k.check stays implemented, #1 blocked → backlog 0173; k.schema, k.ctx, k.store flipped; k.check #3 green; k.check #1 blocked by 38 codes without fixtures → backlog 0173; k.cli #2 blocked by `additionalProperties: false` on open inputs → agent D fixes toJsonSchema in-batch) the five rfc:0049 sections back to `conformance-covered` honestly: k.cli #2, k.check #1 and #3, k.schema #1, k.ctx #3, k.store #12 (conformance-writer per clause; then status flip)

## Steps
1. [x] PLAN; three agents in parallel: A rules (0165, 0170, 0171: compiler lowering + rules + globals, check rules); B render (0166, 0172: ui, forms, server dom, std-timings); C conformance (0138: conformance-writer per clause, spec map statuses).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 418 items, 377 verified, 6 unsafe, 0 lowered, 0 uncovered`; `none` clauses left: k.check#1 (0173) and std.sessions (proposed). docs/RFC.md corrected (guard checks the commit message, not the PR title) and bumped. Reviewer + red-team running.
3. [x] 0175/0176/0178/0179/0180 fixed in-batch (scope-aware elementValued via decl-backed resolver; text() renders nothing for a node; std.timings clause reworded with an independent oracle; textarea/pre leading newline kept; Field.bind keeps a pre-hydration edit); final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 419 items, 378 verified, 6 unsafe, 0 lowered, 0 uncovered`; one code commit tagged rfc:0061 rfc:0062 (0138 additions ride along: pure additions need no tag) plus the handoff commit (rfc:0061 for A if a clause changes; 0062 for B), flip backlog, handoff, push.

## Decisions
- D1: Ownership: A packages/compiler (all src), packages/check src/rules + conformance for its clauses, packages/runtime-dom only if lowering needs a new op; B packages/ui, packages/forms, packages/server src/internal/dom, packages/std-timings; C packages/{cli,check,schema,ctx,store}/conformance additions only (pure additions need no RFC), spec/00-map.md status lines, and the sections' status lines. C never edits src; if a clause cannot pass without a src change, C reports it and the section stays `implemented`.
- D2: RFC numbers reserved: 0061 (A), 0062 (B).

- D3: reviewer requested a cli changeset (added: .changeset/cli-mcp-schema-closed-0138.md). Red-team batch 6 filed 0175-0181; 0176 (scope-blind E1403 drops real text), 0175 (runtime text() guard), 0178 (false std.timings clause), 0179 (textarea leading newline), 0180 (Field.bind overwrites pre-hydration input) are fixed in-batch by agents A and B; 0177 (more E1603 wrappers) and 0181 (toJsonSchema drops int/id/length constraints) stay as follow-ups with 0173, 0174.

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro (k.check stays implemented: #1 blocked, backlog 0173) is a failing-then-passing test; every flipped section has zero `none` clauses in ledger.json

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1452 files` · `ok budgets 46 measured` · `ok ledger --diff 419 items, 378 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 7: 0114 two-phase manifest RFC, 0173, 0174, 0177, 0181.