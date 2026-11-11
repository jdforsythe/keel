# Task 0338: S8 Reach (std-db, std-workflows, Capacitor, Tauri, verification)

**Spec:** std.db, std.workflows (new); Capacitor and Tauri adapters; verification · k.store, k.ctx, k.server (kernel touch) · **Gate:** S8 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2-S7 pushes

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0085 `docs/rfc/0085-s8-reach.md` (draft 3f4c23c); finalizing with the user's answers and ADRs 0103-0108.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
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
Step 1: the design agent is writing `docs/rfc/0085-*.md`; read its report, then step 2.
