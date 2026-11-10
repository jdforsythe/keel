# Task 0309: S3 Server depth (std-jobs, std-schedules, std-streams, topology split, generated Docker/CI, compat check)

**Spec:** std.jobs, std.schedules, std.streams (new, from the design RFC) · k.server, k.module (kernel touch) · **Gate:** S3 exit: split topology without source changes (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), implementation started after the S2 push (4f6dc1e)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0080 `docs/rfc/0080-s3-server-depth.md` accepted (9611941; ADR-0073 to ADR-0079; std-streams dropped: live loaders in k.server are the one stream transport, std.channels builds on them).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
3. [~] Conformance first: three writers running (kernel sections k.topology/k.server/k.services/k.module; k.compat + k.scaffold; std.jobs + std.schedules) after prep commit 221406e.
4. [~] Implementation batch: deploy and compat lanes launched (their conformance at 8c7ebe4); kernel and jobs-schedules wait for their writers; golden last.
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
Steps 3-4 in flight. Committed conformance: k.compat + k.scaffold (8c7ebe4), std.jobs + std.schedules (cf47dd4). Running: the kernel-sections writer; implementation agents for deploy (scaffold, cli place/generate, tooling/generate.mjs), compat (check, cli surface.json and --base) and jobs-schedules (std-jobs, std-schedules; may report waiting on the kernel's runner start and app.close()). On each writer's report: load-check and commit `wip: rfc:0080 ... conformance, skipped`, then launch that lane's implementation (kernel: server/services/router/compiler/testing, lands `service({ module })` and live loaders first and reports; jobs-schedules). Lane reports: commit by path with rfc:0080 in the subject. golden lane (golden-1 `digest` module, server.ts removal in golden-1, golden-2, apps/sessions, the split-topology eval) launches when kernel, deploy, compat are committed. Then step 5 (root check/test/build, ledger, budgets, reviewer + red-team, push, mutation alone) and the exit eval.
