# Task 0432: hand-build friction and browser findings, batch 1

**Spec:** k.server, k.forms, k.topology, k.ctx, k.router, k.head, k.runtime · **Principles:** 2, 5, 9 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-12)

## Decisions
- D1 lanes of disjoint packages, run together: (1) server, forms: 0407 submitted secrets in `#k-state`; (2) cli, ctx: 0374 `keel dev` storage; (3) router: 0393 client `keel.notFound` default, 0382 E1505 import order; (4) golden-1 and its guide: 0384, the safe parts of 0386 and 0396; (5) runtime-dom: 0392 keyed `For` rows keep their element.
- D2 a lane that needs spec text or a conformance edit reports the wording; the orchestrator writes the RFC (WORKFLOW RFC defaults), the spec and briefs the conformance-writer.
- D3 left for a later batch because each needs a new API shape or a user answer: 0376, 0377, 0378, 0380, 0381, 0383, 0387, 0388, 0389, 0394, 0395, 0397, 0398, 0399, 0400.

## Steps
- [x] 1 lanes 1 to 5
- [x] 2 RFC, spec and conformance for what the lanes report
- [x] 3 reviewer and red-team; findings to the backlog
- [x] 4 ledger, budgets, backlog, handoff, push

## Verification
- [x] `pnpm check`, `pnpm test`, `pnpm build` green
- [x] ledger not lowered, 0 uncovered; unsafe count unchanged

## Outcome
- D4 lane 1: RFC 0089, ADR-0112: a submitted password-input value, or one that may reach an `s.secret`, never returns in a response; the submission is restored only when the route's own component rendered. Lane 2: RFC 0088, ADR-0111: `createCtx({ storage })`, `@keel/ctx/node` `fileStorage`, a file per `node` deployable under `.keel-dev/` in `keel dev` (a new API shape: the user confirms). Lane 3: the client `keel.notFound` default is the server's heading; E1505's import-order hint is pinned (the order is an ESM cycle). Lane 4: golden-1 comments, titles, one nav, link names, `errorElement`.
- D5 lane 5 (0392) is held: the fix needs a design RFC (backlog 0439); its patches are in this directory.
- D6 reviewer approved; its findings and the red-team's six: fixed in the batch (errorElement leak, exponential `secretKey`, dotted record keys, `fileStorage` read and parse errors), filed 0433 to 0442.
- Trailers: `ok check 57 tasks`, `ok test 56 tasks`, `ok build 32 tasks`, `ok ledger --diff 642 items, 630 verified, 7 unsafe, 0 warnings, 0 lowered, 0 uncovered`.
- Not run: mutation on server, forms, ctx, router; a browser pass; evals after this batch.
- Left in the working tree, uncommitted, by a formatter run no lane owned (backlog 0438): `evals/tasks/golden-1-api/pass.ts`, `splitBuilt.ts`, `tooling/ci.source.json`, `tooling/mutate.mjs`, `tooling/test/mutate.test.ts`, `packages/router/conformance/api-routes-0086.test.ts`, `packages/server/conformance/secret-submission-0089.test.ts`. Whitespace only.

## Next action
None here. Next: D3's list, and 0439 (design RFC for keyed rows).
