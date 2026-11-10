# Task 0307: S2 Values (std-temporal, std-text, std-i18n, std-money; golden-2 lane)

**Spec:** std.money (exists) · std.temporal, std.text, std.i18n (new, from the design RFC) · k.schema type registry, k.ui formatting hooks (kernel touch) · **Gate:** S2 exit: golden-2 prices and dates in 3 locales (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0079 (`docs/rfc/0079-s2-values.md`, draft) (one opus agent, no code): contract per package, kernel changes, spec diff, conformance clauses, lane split, open questions for the user.
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
Step 2: the RFC is written and committed as draft. Its four open questions are with the user (RFC "Open questions": locale as a path param `/:locale/...`; message catalogs out of S2; golden-2 migration; `lang` on every base element; the design agent recommends yes, no, yes, yes). On the answers: record them as D2+, set the RFC status to accepted, write the ADR numbers, then the orchestrator prep in RFC "Lanes" (create the three packages, `tooling/deps.json` order, `pnpm install`, spec files), then step 3 (conformance-writers per lane). Ride-along candidates: 0292 (golden-2 lane), 0306 and 0296 (kernel lane).
