# Task 0032: golden app 1 with a real API

**Spec:** k.server, k.services, k.router, k.module · **Gate:** G2 · **Branch:** jdforsythe/test-impl · **Package:** apps/golden-1

## Deliverables
- [x] Second deployable `api` (adapter `node`, module `api`) beside `web` (client, `todos`) in `topology.ts`
- [x] `api.suggestions` route at `/api/suggestions`: `loadSuggestions.server.ts`, `SuggestionsApi.ts`
- [x] Client declares the endpoint with `@keel/services` (`suggestions.service.ts`, `SuggestionsReply.schema.ts`); `Suggestions.tsx` calls the typed client with its `ctx` (no `ctx.net.fetch` in app code)
- [x] `server.ts` + script `api` (`node server.ts`, port 4181, `@hono/node-server`); Vite dev/preview proxy `/api`; dev stub deleted
- [ ] `keel check` golden test green (blocked: 0027 D25, compiler E1004)
- [ ] Evals rerun (not started)

## Steps
1. [x] Design recorded: 0027 D22-D26.
2. [x] Implement api module, client service, server entry, proxy; tests on sim net with the real wire body.
3. [x] Verify: golden-1 tests, build, end to end (curl + smoke through the preview proxy).
4. [ ] Compiler E1004 fix (separate task, conformance first) -> golden test green.
5. [ ] Rerun golden-1 evals.

## Decisions
- D1: see tasks/0027-golden-app/PLAN.md D22-D26 (module `api` instead of `todos` in two deployables; plain `.ts` route component; endpoint output is the k.server runtime `Result` envelope; client built at call time; E1004 blocker; `server.ts` passes only its own deployable to `createApp`).
- D2: `pnpm check` 2026-11-06: only `@keel/check#check` fails, on the untracked `packages/check/test/mutants.test.ts` (biome; not this task's file, another session's work). structure-lint, generate, docs-freshness, budgets ok.

## Verification
- [x] `pnpm test --filter golden-1`: ok 31 tests, 0 failed
- [x] `pnpm --filter golden-1 build`: built
- [x] `pnpm --filter golden-1 check` clean; `node tooling/ledger.mjs --diff --scope golden-1` ok
- [x] `curl -s -H 'accept: application/json' http://localhost:4181/api/suggestions` -> `{"id":"api.suggestions","results":{"api.suggestions":{"ok":true,"value":[{"title":"Bread"},{"title":"Eggs"},{"title":"Milk"}]}}}`
- [x] `tooling/smoke/interact.mjs` against `vite preview` (port 4182: 4180 was held by an older preview): list page text ends `Suggestions\nBread\nEggs\nMilk`, no page errors
- [ ] `pnpm --filter @keel/cli test`: golden test fails with 7 x E1004 (D25)

## Next action
Backlog item for the compiler E1004 fix (0027 D25) and the createApp E1552 cross-check (D26); then rerun the cli golden test and the evals, tick 0032.
