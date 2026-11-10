# Task 0311: S5 Correctness (std-statecharts, model checking, simulator, mutation in ledger)

**Spec:** std.statecharts (new), k.testing, k.ctx (kernel touch), k.cli and tooling for mutation in the ledger · **Gate:** S5 exit: every rung populated by real machinery · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S4 pushes

## Shape (tasks/PROGRAM.md)
1. [ ] Design RFC 0082 (one opus agent, no code), concurrent with the S2 batch (user decision D1).
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof: ledger shows every rung (proven, exhaustive, probabilistic, example, monitored) populated by real machinery.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead while S2 implements; implementation runs in stage order.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 1: the design agent is writing `docs/rfc/0082-*.md`; read its report, then step 2.
