# Task 0385: API routes (RFC 0086)

**Spec:** k.api (new), k.router, k.topology · **Principles:** 1, 4, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 E1510 and E1511 are both defined in k.api: the map gives the E150x block to k.router and k.prefix, and k.topology owns E155x. k.topology's Rules carry a pointer to E1511.
- D2 the `@keel/server` budget is re-based for the API request branch (WORKFLOW RFC default 7); the reason goes in the commit.

## Steps
- [x] 1 ADR-0109, k.api spec text, k.router and k.topology pointers, map row
- [x] 2 conformance-writer: `packages/router/conformance/api-routes-0086.test.ts`, `packages/server/conformance/api-routes-0086.test.ts`
- [ ] 3 kernel: router (`RouteDef` arms, `manifest()` E1510, `href`, `matchHref`), compiler (`routes.json` `api: true`), server (API request flow, E1511 in `createApp`), check (E1510, E1511 rules, explain, fixtures), scaffold (`route --api`, templates)
- [ ] 4 migration: golden-1 `api` and `digest`, std-sessions; guide, `keel-api` skill
- [ ] 5 reviewer and red-team; findings to the backlog
- [ ] 6 spec status, changeset, ledger, budgets, backlog, handoff

## Verification
- [ ] `pnpm check` green
- [ ] `pnpm test` green, both `api-routes-0086` conformance files included
- [ ] `pnpm build` green; eval `golden-1-api` converges
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] no stub view left in golden-1 or std-sessions

## Next action
Step 3: brief the kernel agent with the code map; the conformance files are committed and fail until it lands.
