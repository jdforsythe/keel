# Task 0307: S2 Values (std-temporal, std-text, std-i18n, std-money; golden-2 lane)

**Spec:** std.money (exists) · std.temporal, std.text, std.i18n (new, from the design RFC) · k.schema type registry, k.ui formatting hooks (kernel touch) · **Gate:** S2 exit: golden-2 prices and dates in 3 locales (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10)

## Shape (tasks/PROGRAM.md)
1. [ ] Design RFC 0079 (one opus agent, no code): contract per package, kernel changes, spec diff, conformance clauses, lane split, open questions for the user.
2. [ ] Orchestrator accepts the RFC under the WORKFLOW RFC defaults; questions the defaults do not settle go to the user.
3. [ ] Conformance first: one `conformance-writer` per lane, tests skipped until implementation.
4. [ ] Implementation batch: one agent per lane (std-temporal, std-text, std-i18n, std-money changes, golden-2), one kernel agent; in parallel.
5. [ ] Root `pnpm check`, `pnpm test`, `pnpm build`; ledger; budgets; reviewer + red-team; in-batch fixes; push.
6. [ ] Exit proof: the golden-2 eval shows prices and dates in 3 locales.

## Decisions
- D1 (user, 2026-11-10): the program moves on to S2; S1 leftovers and their red-team lines wait in the backlog and are folded into a later lane that touches the same package.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered, 0 uncovered; unsafe unchanged or justified
- [ ] reviewer approved; red-team findings filed
- [ ] `pnpm eval` golden-2: prices and dates in 3 locales

## Next action
Step 1: the design agent (opus, relaunched 2026-11-10 after a context clear; no `docs/rfc/0079-*.md` existed yet) is writing `docs/rfc/0079-*.md`. If the file is missing on a fresh start, launch the agent again with the brief in PROGRAM.md "Shape of a stage" 1. Otherwise read its report, then step 2: accept under the WORKFLOW RFC defaults, send the listed open questions to the user, commit `wip: rfc:0079`.
