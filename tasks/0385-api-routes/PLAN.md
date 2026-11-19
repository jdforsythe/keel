# Task 0385: API routes (RFC 0086)

**Spec:** k.api (new), k.router, k.topology · **Principles:** 1, 4, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-11)

## Decisions
- D1 E1510 and E1511 are both defined in k.api: the map gives the E150x block to k.router and k.prefix, and k.topology owns E155x. k.topology's Rules carry a pointer to E1511.
- D2 the `@keel/server` budget is re-based for the API request branch (WORKFLOW RFC default 7); the reason goes in the commit.

- D3 a guard's `redirect` becomes optional; a guard without one guards API routes only (E1508 on a page or layout, type and `manifest()`). Reason: std-sessions' `reader` guard names `sessions.ingest`, which becomes an API route, and the package has no page to name; an API route never follows `redirect`. Chosen over leaving a dead `redirect` on API-only guards. Made without the user (away); listed in HANDOFF for confirmation.
- D4 golden-2 `kitchen` carries the same stub (`KitchenApi`); it migrates with golden-1 and std-sessions.
- D5 `@keel/router` has 2 B of headroom and `@keel/server` 20 B: both are re-based after the kernel change, with the measured sizes in the commit.

## Steps
- [x] 1 ADR-0109, k.api spec text, k.router and k.topology pointers, map row
- [x] 2 conformance-writer: `packages/router/conformance/api-routes-0086.test.ts`, `packages/server/conformance/api-routes-0086.test.ts`
- [x] 3 kernel: router (`RouteDef` arms, `manifest()` E1510, `href`, `matchHref`), compiler (`routes.json` `api: true`), server (API request flow, E1511 in `createApp`), check (E1510, E1511 rules, explain, fixtures), scaffold (`route --api`, templates)
- [x] 4 migration: golden-1 `api` and `digest`, std-sessions; guide, `keel-api` skill
- [x] 5 reviewer and red-team; findings to the backlog
- [x] 6 spec status, changeset, ledger, budgets, backlog, handoff

## Verification
- [x] `pnpm check` green
- [x] `pnpm test` green, both `api-routes-0086` conformance files included
- [x] `pnpm build` green; eval `golden-1-api` converges
- [x] ledger not lowered, 0 uncovered; unsafe count unchanged
- [x] no stub view left in golden-1 or std-sessions

## Outcome
- D6 the reviewer approved; its low findings and the red-team's five are backlog 0408 to 0418, with 0408, 0410, 0411, 0412 fixed in the batch.
- D7 k.api also states: `api` other than `true` is E1510; a guard `redirect` naming an API route is E1508 at the first read of the table.
- Trailers: `ok check 57 tasks`, `ok test 56 tasks`, `ok build 32 tasks`, `ok ledger --diff 634 items, 622 verified, 7 unsafe, 0 warnings, 0 lowered, 0 uncovered`; evals `golden-1-api` and `golden-2` converged (runner none).
- Not run: mutation on router, server, check, scaffold after this change; Docker and compose.

## Next action
None here. RFC 0087 (client hosting) is `tasks/0375-client-hosting/PLAN.md`.
