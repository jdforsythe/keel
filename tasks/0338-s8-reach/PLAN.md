# Task 0338: S8 Reach (std-db, std-workflows, Capacitor, Tauri, verification)

**Spec:** std.db, std.workflows (new); Capacitor and Tauri adapters; verification · k.store, k.ctx, k.server (kernel touch) · **Gate:** S8 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S7 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0085 `docs/rfc/0085-s8-reach.md` accepted (ADR-0103 to ADR-0108).
2. [x] Orchestrator accepts the RFC; user answered D2-D4.
3. [ ] Conformance first, per lane, after the prior pushes.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run ahead; implementation runs in stage order.

- D2 (user, 2026-11-11): API shapes accepted as a set (k.persist `read`/`commit` on ctx.storage and `createCtx({ drivers })`; saves as one commit; std-db SQLite via node:sqlite and Postgres via pg with stored-schema checks through `check --base`; std-workflows as a chart run per instance over std-jobs; std-capacitor and std-tauri shells with generated read-only files via `keel build --target`; k.prove Z3 induction proofs recorded as `proven`, starting with a spike).
- D3 (user, 2026-11-11): golden-1 migrates to std-db; CI per PR on Linux with a Postgres service container, Tauri Linux build and shell replay, Android debug APK, `prove`; Android emulator replay nightly; iOS manual dispatch; macOS and Windows Tauri builds on a developer machine; no signing, store upload or Postgres hosting.
- D4 (user, 2026-11-11): the caller cookie lives in the shell's native cookie store; `.pii` data is stored unencrypted at rest (encryption left to the database or disk).

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit proof

## Next action
Waits for the S2-S7 pushes. Before the S8 batch: run backlog 0257 (a revealed secret in a stored snapshot becomes durable on std-db). Then: orchestrator prep per RFC 0085 "Lanes" (k.persist, k.deploy, k.shell, k.prove, std.db, std.workflows, std.shells; edits to k.store, k.ctx, k.server, k.topology, k.compat, k.ledger; skeletons; deps; budgets), conformance-writers, implementation batch (kernel + db, workflows, targets, verify, golden lanes; the verify lane's first commit is the Z3 spike).
