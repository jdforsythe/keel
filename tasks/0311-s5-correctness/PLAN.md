# Task 0311: S5 Correctness (std-statecharts, model checking, simulator, mutation in ledger)

**Spec:** std.statecharts (new), k.testing, k.ctx (kernel touch), k.cli and tooling for mutation in the ledger · **Gate:** S5 exit: every rung populated by real machinery · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open; implementation started 2026-11-13 (S2-S4 pushed)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0082 `docs/rfc/0082-s5-correctness.md`, accepted 2026-11-10 with ADRs 0086-0091.
2. [x] Orchestrator accepts the RFC; no open questions.
2a. [x] Orchestrator prep (RFC Lanes): spec text rebased on the tree after S2-S4, package skeleton, deps, budgets, one `pnpm install`.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: ledger shows every rung (proven, exhaustive, probabilistic, example, monitored) populated by real machinery.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

- D2 (user, 2026-11-10): API shapes accepted as a set: `explore(...)` in @keel/testing (k.model), `Schedule`/`simulate` on the sim ctx (k.sim), `chart(...)` in @keel/std-statecharts (flat charts only in S5, E2751-E2755), sha-keyed mutation claims with E1712/E1713, `keel session monitor`.
- D3 (user, 2026-11-10): golden-1 is migrated (editor chart, monitor hook, three tests, eval twins).
- D4 (user, 2026-11-10): `monitored` evidence comes from a local production build of golden-1 driven by Playwright.
- D5 (user, 2026-11-10): the `proven` rung keeps type-level tests (docs/TESTING.md definition stands); the RFC's narrowing is rejected.
- D6 (orchestrator, 2026-11-13; confirm or reverse): the RFC's spec text is written into `spec/` rebased on the tree after S2-S4. Differences from the RFC's text: (1) the ledger clauses were k.testing#9-#11 (a focus clause landed at #4), now k.ledger#1-#3; k.testing#12, #13 are #9, #10; std.multi's schedule clause is #6 and the E2007/E2008 clause is #7. (2) std.monitor's reader guard answers 403 `keel.denied` (what `sessions.reader` does), not a redirect. (3) `sessions.tally` is an API route (k.api). (4) k.testing keeps E1719, E1720 and its current Harness block. (5) all codes the RFC takes were free and are used as written. Tokens: k.ledger 1,413, k.model 1,231, k.sim 1,223, std.statecharts 1,120, std.monitor 840, k.testing 1,135, k.ctx 1,494, k.cli 1,488, std.multi 981, map 1,116.
- D7 (orchestrator, 2026-11-13): package bytes today differ from the RFC's table: testing 7,951 B (9kb), ctx 2,635 B (3kb), cli 20,451 B (22kb). ctx will not hold +0.55 kB; budgets are re-based after the kernel lane with measured bytes (default 7), not before.
- Until K4 and the `group-schedule` test land, `keel ledger --diff` reports k.testing#9, #10 and std.multi#6 lowered and std.multi clause 6 uncovered; the ledger is rewritten on a quiet tree at batch end.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 3: conformance-writers (k.sim, k.model, k.ledger with the eight header edits, std.statecharts, std.monitor + std.multi#6), all in `rfc:0082` commits. Then step 4 lanes per the RFC's Lanes table.
