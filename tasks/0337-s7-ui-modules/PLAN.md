# Task 0337: S7 UI modules (std-headless, std-tables)

**Spec:** std.headless, std.tables (new) · k.ui, k.component (kernel touch) · **Gate:** S7 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S6 pushes

## Shape (tasks/PROGRAM.md)
1. [ ] Design RFC 0084 (one opus agent, no code), ahead of time (user decision D1).
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead; implementation runs in stage order.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Step 1: the design agent is writing `docs/rfc/0084-*.md`; read its report, then step 2.
