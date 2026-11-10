# Task 0307: S2 Values (std-temporal, std-text, std-i18n, std-money; golden-2 lane)

**Spec:** std.money (exists) · std.temporal, std.text, std.i18n (new, from the design RFC) · k.schema type registry, k.ui formatting hooks (kernel touch) · **Gate:** S2 exit: golden-2 prices and dates in 3 locales (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0079 (`docs/rfc/0079-s2-values.md`, draft) (one opus agent, no code): contract per package, kernel changes, spec diff, conformance clauses, lane split, open questions for the user.
2. [x] Orchestrator accepts the RFC (rfc:0079 accepted 2026-11-10, ADR-0068 to ADR-0072, commit 4979cfe) under the WORKFLOW RFC defaults; questions the defaults do not settle go to the user.
3. [x] Conformance first: all five lanes committed, skipped (de39b2d, df91f42, 8e0729f, d9d080a, 37a4926): one `conformance-writer` per lane, tests skipped until implementation.
4. [~] Implementation batch: kernel (K1 first, reports then resumes), i18n-money, std-temporal, std-messages running; std-text paused at 113f420 waiting on K1/Locale; golden-2 last: one agent per lane (std-temporal, std-text, std-i18n, std-money changes, golden-2), one kernel agent; in parallel.
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

## Spec defects reported by lanes (orchestrator fixes spec text at batch end, rfc:0079)
- std.temporal `plainDateOf(i, zone)`: within about 15 hours of the year bounds the zoned date leaves 0001-9999; the implementation returns the UTC date of `i` (nearest valid bound). State that rule in the clause.
- std.i18n E2301: `Intl.ListFormat` and `Intl.Segmenter` are not flagged (no stdlib function to name); note in the Rules text if not already implied.

- k.schema `decodeStrings` on a format: coerces as `base` does, then parses the format (a `check`-refused value is a `format` issue). Reword the clause.
- std.messages E2401: a rule's fix edits only the checked file, so a missing locale file has no fix; the fix covers the `load` form only. Reword the Rules text.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered, 0 uncovered; unsafe unchanged or justified
- [ ] reviewer approved; red-team findings filed
- [ ] `pnpm eval` golden-2: prices and dates in 3 locales

## Next action
Step 4 nearly closed: kernel K1-K7 (96279f8, 3e3a013, 5005ef9), all std packages, golden-2 (cad7f45) committed; budgets re-based (0c2c939); spec rewordings (16b78c3, 32572dc). Running: kernel agent on the k.testing settle gap (renderRoute waits for a loader's dynamic import; golden-2 preloads locale files as a workaround in routes.test.ts and the eval acceptance suite, to remove once fixed); fix agent on blank text in std-text/std-messages (golden-2's two generated-props tests). On both: commit by path, resume golden-2 to drop the preload workaround and re-run its verify; then step 5: root `pnpm check && pnpm test && pnpm build`, `keel ledger --diff`, reviewer (`/review`), red-team, in-batch fixes, push; step 6: `pnpm eval --task golden-2 --runner none --strict` converged. Backlog filed in-batch: 0313-0317.
