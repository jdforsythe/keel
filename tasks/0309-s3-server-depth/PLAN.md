# Task 0309: S3 Server depth (std-jobs, std-schedules, std-streams, topology split, generated Docker/CI, compat check)

**Spec:** std.jobs, std.schedules, std.streams (new, from the design RFC) · k.server, k.module (kernel touch) · **Gate:** S3 exit: split topology without source changes (eval) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-10), implementation started after the S2 push (4f6dc1e)

## Shape (tasks/PROGRAM.md)
1. [x] Design RFC 0080 `docs/rfc/0080-s3-server-depth.md` accepted (9611941; ADR-0073 to ADR-0079; std-streams dropped: live loaders in k.server are the one stream transport, std.channels builds on them).
2. [x] Orchestrator accepts the RFC; user answered D2-D5.
3. [x] Conformance first: all three lanes committed, skipped (8c7ebe4, cf47dd4, 5ddedf1).
4. [~] Implementation batch: kernel (1994873), deploy + compat (3f4c23c, 7b6dcab), jobs-schedules (ee00ecd, 479948b) committed; golden lane next.
5. [ ] Exit proof eval.

## Decisions
- D1 (user, 2026-11-10): design RFCs for later stages run concurrently with the S2 batch; implementation waits for the S2 push because the kernel lanes overlap (server, check, cli, scaffold) and the per-batch agent budget is five plus one.

- D2 (user, 2026-11-10): API shapes accepted as a set: `service({ module })`, `events` endpoints and SSE live loaders, `runners.server.ts`, `job()`/`queue()`/`jobs.enqueue()`, cron `schedule()` in a time zone, `keel codemod place`, `keel check --base`.
- D3 (user, 2026-11-10): generated bundled entries replace every hand-written `server.ts`; golden-1, golden-2, apps/sessions drop theirs; golden-1 gains a `digest` module.
- D4 (user, 2026-11-10): Docker/CI approved: digest-pinned `node:22-slim`, generated build-only workflow, golden-1 image-build job in this repo's CI.
- D5 (user, 2026-11-10): one `KEEL_SECRET` shared by all of an app's deployables.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green; ledger not regressed; reviewer approved; red-team filed; exit eval green

## Golden lane brief (launch when the kernel lane is committed; opus, high)
Owns `apps/golden-1/**`, `apps/golden-2/**`, `apps/sessions/**`, `evals/tasks/golden-1*/**` (new task folder for the split proof if the RFC names one), `.changeset/golden-*.md`. Reads: CLAUDE.md, BRAND.md, skills keel and keel-api, RFC 0080 sections "Topology split", "Exit proof", "Lanes", "Migration" (D2: generated entries replace every hand-written `server.ts`; D3 golden-1 gains a `digest` module with a runner; D5 one `KEEL_SECRET`), ADR-0073 to 0079, `pnpm spec k.topology`, `k.server`, `k.services`, `k.compat`, `std.jobs`, `std.schedules`. Work: (1) golden-1: add `modules/digest` (a runner using std-jobs or std-schedules; `service({ module })` call from another module), declare the topology as one deployable and as two (`{ one: [...] }` vs `{ x: [...], y: [...] }`) per the RFC's eval, remove `server.ts`, run through `dist/<name>/server.mjs`; `keel check --base` clean; deploy files regenerated (`node tooling/generate.mjs`). (2) golden-2 and apps/sessions: remove `server.ts`, start from the generated entry; READMEs updated (apps/sessions/README.md has the deployment steps). (3) The exit eval: the same app built as one deployable and as two, driven by the same request script under sim ctxs of one seed, transcripts equal after id normalisation, no source diff between the two layouts except `topology.ts`; `pnpm eval --task <golden-1 task> --runner none --strict` converged. Rules: every effect through ctx; no literal copy (E2406 where message sets apply); no `any`/casts outside `unsafe/`; report blockers in the kernel as exact failures, no workarounds in apps. Verify: `pnpm --filter golden-1 --filter golden-2 --filter sessions run check` and `run test`, `node tooling/generate.mjs --check`, the eval. Ride-along: 0292 is done for golden-2; check golden-1's `check` script runs `keel check` too.

## Next action
Golden lane launched 2026-11-11 from a clean tree at 145f280 (root check 57 tasks and test 55 tasks green before launch); it stages nothing, the orchestrator commits by explicit path. If a fresh start finds no golden-lane changes in `git status`, relaunch it from the brief above. When it reports, step 5: root `pnpm check && pnpm test && pnpm build`, `node packages/cli/src/bin.ts ledger --diff` then `pnpm ledger`, spec status flips (k.topology, k.compat, std.jobs, std.schedules to conformance-covered in the files and in spec/00-map.md or spec/std/README.md), reviewer + red-team over `git diff 4f6dc1e...HEAD` scoped to S3, in-batch fixes, push, mutation alone (server, router 80%; check 70%), close 0309, tick in BACKLOG. Backlog filed in-batch: 0339-0348 (0347 done: the shared fixture `packages/cli/conformance/topology-modules.ts` declares the `{ id, results }` envelope, the equivalence test is un-skipped and compares both bodies; cli 545 tests, 0 skipped). Conformance guard: HEAD subject must carry rfc:0080 for edits to tracked conformance files.
