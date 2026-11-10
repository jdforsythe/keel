# Task 0310: S4 Realtime (std-live, std-channels, std-offline, std-conflicts)

**Spec:** std.live, std.channels, std.offline, std.conflicts (new, from the design RFC) · k.reactive, k.store, k.server (kernel touch) · **Gate:** S4 exit: multi-user replay finds an injected race · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2 and S3 batches are pushed

## Shape (tasks/PROGRAM.md)
1. [ ] Design RFC 0081 (one opus agent, no code), concurrent with the S2 batch (user decision D1).
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run concurrently with the S2 batch; implementation waits for the earlier pushes (k.server and k.store overlap).

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit eval green

## Next action
Step 1: the design agent is writing `docs/rfc/0081-*.md`; read its report, then step 2.
