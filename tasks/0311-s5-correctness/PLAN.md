# Task 0311: S5 Correctness (std-statecharts, model checking, simulator, mutation in ledger)

**Spec:** std.statecharts (new), k.testing, k.ctx (kernel touch), k.cli and tooling for mutation in the ledger · **Gate:** S5 exit: every rung populated by real machinery · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S4 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0082 `docs/rfc/0082-s5-correctness.md` (draft 093f1f8); finalizing with the user's answers and ADRs 0086-0091.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: ledger shows every rung (proven, exhaustive, probabilistic, example, monitored) populated by real machinery.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

- D2 (user, 2026-11-10): API shapes accepted as a set: `explore(...)` in @keel/testing (k.model), `Schedule`/`simulate` on the sim ctx (k.sim), `chart(...)` in @keel/std-statecharts (flat charts only in S5, E2751-E2755), sha-keyed mutation claims with E1712/E1713, `keel session monitor`.
- D3 (user, 2026-11-10): golden-1 is migrated (editor chart, monitor hook, three tests, eval twins).
- D4 (user, 2026-11-10): `monitored` evidence comes from a local production build of golden-1 driven by Playwright.
- D5 (user, 2026-11-10): the `proven` rung keeps type-level tests (docs/TESTING.md definition stands); the RFC's narrowing is rejected.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 1: the design agent is writing `docs/rfc/0082-*.md`; read its report, then step 2.
