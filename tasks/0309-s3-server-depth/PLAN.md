# Task 0309: S3 Server depth (std-jobs, std-schedules, std-streams, topology split, generated Docker/CI, compat check)

**Spec:** std.jobs, std.schedules, std.streams (new, from the design RFC) · k.server, k.module (kernel touch) · **Gate:** S3 exit: split topology without source changes (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), implementation started after the S2 push (4f6dc1e)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0080 `docs/rfc/0080-s3-server-depth.md` accepted (9611941; ADR-0073 to ADR-0079; std-streams dropped: live loaders in k.server are the one stream transport, std.channels builds on them).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
3. [x] Conformance first: all three lanes committed, skipped (8c7ebe4, cf47dd4, 5ddedf1).
4. [~] Implementation batch: kernel (contract first, reports then resumes), deploy, compat, jobs-schedules running; golden last.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run concurrently with the S2 batch; implementation waits for the S2 push because the kernel lanes overlap (server, check, cli, scaffold) and the per-batch agent budget is five plus one.

- D2 (user, 2026-11-10): API shapes accepted as a set: `service({ module })`, `events` endpoints and SSE live loaders, `runners.server.ts`, `job()`/`queue()`/`jobs.enqueue()`, cron `schedule()` in a time zone, `keel codemod place`, `keel check --base`.
- D3 (user, 2026-11-10): generated bundled entries replace every hand-written `server.ts`; golden-1, golden-2, apps/sessions drop theirs; golden-1 gains a `digest` module.
- D4 (user, 2026-11-10): Docker/CI approved: digest-pinned `node:22-slim`, generated build-only workflow, golden-1 image-build job in this repo's CI.
- D5 (user, 2026-11-10): one `KEEL_SECRET` shared by all of an app's deployables.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit eval green

## Next action
Step 4: committed jobs-schedules (ee00ecd), deploy + compat (3f4c23c; check re-based to 40kb). Running: kernel lane (resumed after the session restart; server/services/router uncommitted on disk); compat test fixes (POST answer per spec, widening generator, type errors, cli timeout 30 s); jobs test fixes (concurrency hash, crash count, S0006); a spec agent clarifying k.topology (`/data` owned by node, `KEEL_PEER_<NAME>` upper-cased) and std.jobs (failed-after-last-attempt counts as finished). On the kernel report: commit by path (`packages/server packages/services packages/router/src packages/compiler packages/testing/src` + its cli build/dev files + changesets), then launch the golden lane (golden-1 `digest` module with a runner; golden-1, golden-2, apps/sessions drop `server.ts` for the generated entry; the split-topology eval). Then step 5. Backlog filed in-batch: 0339-0342.
