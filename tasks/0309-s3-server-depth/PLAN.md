# Task 0309: S3 Server depth (std-jobs, std-schedules, std-streams, topology split, generated Docker/CI, compat check)

**Spec:** std.jobs, std.schedules, std.streams (new, from the design RFC) · k.server, k.module (kernel touch) · **Gate:** S3 exit: split topology without source changes (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), implementation started after the S2 push (4f6dc1e)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0080 `docs/rfc/0080-s3-server-depth.md` accepted (9611941; ADR-0073 to ADR-0079; std-streams dropped: live loaders in k.server are the one stream transport, std.channels builds on them).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
3. [~] Conformance first: three writers running (kernel sections k.topology/k.server/k.services/k.module; k.compat + k.scaffold; std.jobs + std.schedules) after prep commit 221406e.
4. [ ] Implementation batch; kernel agent; reviewer + red-team; push.
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
Step 3 in flight. On each writer's report: run `npx vitest run conformance` in the touched packages (skipped suites must load clean), commit `wip: rfc:0080 <sections> conformance, skipped`. When all three are committed, step 4: launch the implementation lanes per RFC 0080 "Lanes" (kernel: server, services, router, compiler, testing; jobs-schedules; deploy: scaffold, cli, generate.mjs; compat: check + surface artifact; golden last), ≤ 5 + 1; the kernel lane lands the live-loader and topology contract first and reports so dependent lanes can be resumed. Conformance guard: HEAD subject must carry rfc:0080 for edits to tracked conformance files.
