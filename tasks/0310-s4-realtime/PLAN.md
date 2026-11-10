# Task 0310: S4 Realtime (std-live, std-channels, std-offline, std-conflicts)

**Spec:** std.live, std.channels, std.offline, std.conflicts (new, from the design RFC) · k.reactive, k.store, k.server (kernel touch) · **Gate:** S4 exit: multi-user replay finds an injected race · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2 and S3 batches are pushed

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0081 `docs/rfc/0081-s4-realtime.md` accepted (8810645; ADR-0080 to ADR-0085; channels build on k.server live loaders from rfc:0080; no std-streams).
2. [x] Orchestrator accepts the RFC; user answered D2-D4.
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
Waits for the S2 and S3 pushes. Then: orchestrator prep per RFC 0081 "Lanes" (spec files k.sync, std.channels, std.live, std.offline, std.conflicts, std.multi; k.store/k.ctx/k.server/std.sessions edits; move the stdlib table to spec/std/README.md; skeletons; deps.json; budgets store 3.5 kB), conformance-writers per lane, implementation batch (kernel + channels, live+offline, sessions-group, conflicts, golden-1 lanes).
