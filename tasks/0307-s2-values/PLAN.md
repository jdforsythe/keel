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

- D2 (user, 2026-11-10): message catalogs (translated page text) are in S2. Needs a second design pass.
- D3 (user, 2026-11-10): golden-2 is migrated for the exit proof (price and added-on date per recipe, eval task updated).
- D4 (user, 2026-11-10): `lang` is allowed on every k.ui base element.
- D5 (open, user): how the locale is carried: path param `/:locale/...` or `?locale=`. The user asked for pros and cons; working assumption path param until answered.
- Note: two design agents ran (the one from before the context clear was still alive). Two drafts exist: `docs/rfc/0079-s2-values.md` (path param, `s.format`, E1758, K4 router, no ctx capability) and `docs/rfc/0079-s2-values-temporal-text-i18n.md` (`?locale=`, `s.refine`/`Refined`, E1601 widened, `i18n(ctx)` capability, `toDecimal` replaces `formatMoney`). A reconcile pass merges them into `0079-s2-values.md` with D2-D4 and the catalog design; the second file is then removed.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered, 0 uncovered; unsafe unchanged or justified
- [ ] reviewer approved; red-team findings filed
- [ ] `pnpm eval` golden-2: prices and dates in 3 locales

## Next action
Step 2: a reconcile design agent (opus) is merging the two drafts into `docs/rfc/0079-s2-values.md` and adding message catalogs (D2). If no agent is running on a fresh start, launch it again. On its report: get D5 from the user if still open, `git rm` the second draft, set the RFC accepted, then the orchestrator prep in RFC "Lanes", then step 3.
