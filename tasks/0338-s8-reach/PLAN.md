# Task 0338: S8 Reach (std-db, std-workflows, Capacitor, Tauri, verification)

**Spec:** std.db, std.workflows (new); Capacitor and Tauri adapters; verification · k.store, k.ctx, k.server (kernel touch) · **Gate:** S8 exit per the design RFC · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open; implementation started 2026-11-13 (S5, the S6 batch and S7 pushed)

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
Step 2a, orchestrator prep, started 2026-11-13. Running: one opus spec agent writing RFC 0085's Spec diff into `spec/` rebased on the tree after S5, S6, S7 and RFCs 0093-0099 (new k.persist, k.shell, k.prove, std.db, std.workflows, std.shells; a MERGE into the existing k.deploy; edits to k.store, k.ctx, k.server, k.topology, k.compat, k.ledger, std.jobs, std.statecharts; the map at its 1,200-token cap). Nothing of it is committed until it reports: `git status --short spec` shows its in-flight edits. It was told to stop on any section that cannot fit under 1,500 tokens and give split options (k.server has 3 tokens of room, so expect that); it also reports the external requirements (Postgres, `node:sqlite` and its Node version, Z3, Tauri, Capacitor, the Android SDK) and what is installed on this machine. When it reports: record its deviations as D5 here, decide the splits it asks for (a split is a spec agent applying two texts, then a conformance-writer moving headers, as k.router to k.guards went in tasks/0337-s7-ui-modules/PLAN.md D11), commit as `rfc:0085 spec: ...`, tell the user which external tools they must provide before the lanes that need them can be verified. Then: backlog 0257 first (a revealed secret in a stored snapshot becomes durable on std-db), then the package prep from RFC 0085 "Lanes" (skeletons, `tooling/deps.json`, budget entries, one `pnpm install`), conformance-writers per lane (headers quote clauses verbatim with raw `"`; new tests `test.skip`; rendered fixtures need accessible names), the lanes (kernel first; db, workflows, targets, verify, golden; the verify lane's first commit is the Z3 spike), each verifying `check` AND `build` and its suite and committing its own paths as `rfc:0085 <lane>: ...`, budgets re-based with measured bytes, root gates (log the test run to a file; stop orphaned `keel dev` children; delete `apps/*/reports/a11y.json`), ledger on a quiet tree, reviewer and red-team, fixes, push, the exit-proof eval, docs and an app skill under 600 tokens. How S5-S7 ran is in tasks/0311-s5-correctness/PLAN.md, tasks/0312-s6-compliance/PLAN.md and tasks/0337-s7-ui-modules/PLAN.md. Sections at or near their cap today: k.router 1 token left, k.security 1, std.tables 1, k.compiler 2, k.server 3, k.runtime 3, k.aria 5, k.ui 6, k.cli 8, std.headless 8. Budgets with almost no room: router 8 B, testing 20 B, std-statecharts root 47 B, compiler 201 B. Machine rules: few test-running agents, one test file at a time, never the root `pnpm test` from an agent except through an eval, no mutation without asking the user (0533: 121 stale claims).
