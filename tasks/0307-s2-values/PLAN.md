# Task 0307: S2 Values (std-temporal, std-text, std-i18n, std-money; golden-2 lane)

**Spec:** std.money (exists) · std.temporal, std.text, std.i18n (new, from the design RFC) · k.schema type registry, k.ui formatting hooks (kernel touch) · **Gate:** S2 exit: golden-2 prices and dates in 3 locales (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0079 (`docs/rfc/0079-s2-values.md`, draft) (one opus agent, no code): contract per package, kernel changes, spec diff, conformance clauses, lane split, open questions for the user.
2. [x] Orchestrator accepts the RFC (rfc:0079 accepted 2026-11-10, ADR-0068 to ADR-0072, commit 4979cfe) under the WORKFLOW RFC defaults; questions the defaults do not settle go to the user.
3. [~] Conformance first: std.text, std.i18n, std.temporal, std.money clause 7, std.messages committed (de39b2d, df91f42, 8e0729f, d9d080a); kernel lane writer still running: one `conformance-writer` per lane, tests skipped until implementation.
4. [~] Implementation batch: std-temporal, std-text, i18n-money, std-messages agents running (opus); kernel waits for its conformance; golden-2 last: one agent per lane (std-temporal, std-text, std-i18n, std-money changes, golden-2), one kernel agent; in parallel.
5. [ ] Root `pnpm check`, `pnpm test`, `pnpm build`; ledger; budgets; reviewer + red-team; in-batch fixes; push.
6. [ ] Exit proof: the golden-2 eval shows prices and dates in 3 locales.

## Decisions
- D1 (user, 2026-11-10): the program moves on to S2; S1 leftovers and their red-team lines wait in the backlog and are folded into a later lane that touches the same package.

- D2 (user, 2026-11-10): message catalogs (translated page text) are in S2. Needs a second design pass.
- D3 (user, 2026-11-10): golden-2 is migrated for the exit proof (price and added-on date per recipe, eval task updated).
- D4 (user, 2026-11-10): `lang` is allowed on every k.ui base element.
- D5 (user, 2026-11-10): the locale is a path param, `/:locale/...`; `?locale=` goes under Alternatives.
- D6 (user, 2026-11-10): an app may opt in to an unprefixed default locale (`/recipes` is the default, `/de-DE/recipes` is de-DE) so adding a second locale keeps existing URLs; prefixed everywhere stays the default; `params.locale` stays typed and required in links either way. The declaration shape comes from the reconcile pass and goes back to the user.
- D7 (user, 2026-11-10): `s.enum(values, { pathDefault })` accepted; the scaffold template born with the locale param and an unprefixed default is a separate task after this batch.
- D8 (user, 2026-11-10): `@keel/std-messages` set shape accepted, E2406 (literal copy in components) an error.
- D9 (user, 2026-11-10): `form(schema, { issueText })` accepted.
- D10 (user, 2026-11-10): per-route `<title>` and `<html lang>` are in S2 (not a later RFC); k.router or k.server is split to make room.
- Note: two design agents ran (the one from before the context clear was still alive). Two drafts exist: `docs/rfc/0079-s2-values.md` (path param, `s.format`, E1758, K4 router, no ctx capability) and `docs/rfc/0079-s2-values-temporal-text-i18n.md` (`?locale=`, `s.refine`/`Refined`, E1601 widened, `i18n(ctx)` capability, `toDecimal` replaces `formatMoney`). A reconcile pass merges them into `0079-s2-values.md` with D2-D4 and the catalog design; the second file is then removed.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered, 0 uncovered; unsafe unchanged or justified
- [ ] reviewer approved; red-team findings filed
- [ ] `pnpm eval` golden-2: prices and dates in 3 locales

## Next action
Steps 3-4 in flight. Outstanding: kernel conformance writer (schema, check, ui, forms, router prefix-*, server/router head-*, two edited headers); on its report run `npx vitest run conformance` in each touched package, commit `wip: rfc:0079 kernel conformance, skipped`, launch the kernel implementation agent (K1 first commit). Implementation agents report per lane: commit each by path (`git add packages/<pkg> .changeset/<pkg>-s2.md`), with `rfc:0079` in the subject. Agents that report "waiting on K1/Locale" are resumed by SendMessage once that lane's commit lands. golden-2 lane launches when kernel, i18n-money, temporal and messages are committed. Then step 5: root check/test/build, ledger, budgets, reviewer + red-team, push; step 6: eval. Conformance guard: HEAD subject must carry rfc:0079 for edits to tracked conformance files.
