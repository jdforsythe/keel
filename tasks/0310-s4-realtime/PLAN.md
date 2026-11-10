# Task 0310: S4 Realtime (std-live, std-channels, std-offline, std-conflicts)

**Spec:** std.live, std.channels, std.offline, std.conflicts (new, from the design RFC) · k.reactive, k.store, k.server (kernel touch) · **Gate:** S4 exit: multi-user replay finds an injected race · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2 and S3 batches are pushed

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0081 `docs/rfc/0081-s4-realtime.md` (draft committed 8efea33); reconcile with the accepted 0080 and ADRs pending.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run concurrently with the S2 batch; implementation waits for the earlier pushes (k.server and k.store overlap).

- D2 (user, 2026-11-10): API shapes accepted as a set: `channel`/`channelRoute`, `subscribe`/`publish`, `live(...)` as a store, `outbox` with `Write { key, base }`/`send`/`drain`/`resolve('mine' | 'theirs')`, per-transaction policy `'reject'` (default) or `'rebase'`, `races(snapshot, stores)`.
- D3 (user, 2026-11-10): golden-1 is migrated for the exit proof; the `golden-1-api` eval is extended.
- D4 (user, 2026-11-10): channel messages ship closed by default (schema-declared payloads, server-side `member` check per open, re-checked after saves).

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit eval green

## Next action
Step 1b: once rfc:0080 is accepted and committed, resume the S4 design agent: reconcile 0081 with 0080's final transport contract, record D2-D4, set accepted, write ADRs 0080-0085 (after S3's 0073-0079). Implementation waits for the S2 and S3 pushes.
