# Task 0309: S3 Server depth (std-jobs, std-schedules, std-streams, topology split, generated Docker/CI, compat check)

**Spec:** std.jobs, std.schedules, std.streams (new, from the design RFC) · k.server, k.module (kernel touch) · **Gate:** S3 exit: split topology without source changes (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), design only until the S2 batch is pushed

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0080 `docs/rfc/0080-s3-server-depth.md` (draft committed cb1f4d4); reconcile with 0081 and ADRs 0073-0079 in progress.
2. [ ] Orchestrator accepts the RFC; open questions to the user.
3. [ ] Conformance first, per lane, after the S2 push (S2 and S3 both touch server, check, cli, scaffold).
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
Step 1b: the design agent is reconciling 0080 with 0081's transport requirement, setting it accepted, writing ADRs 0073-0079. On its report: commit `rfc:0080 accepted`, pass any send-backs to the S4 agent. Implementation (step 3) waits for the S2 push.
