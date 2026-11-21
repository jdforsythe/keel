# W13 step 2: the build of the module contract and the component signature

The build plan for RFC 0157 and RFC 0162, from the design pass of 2026-11-21. The RFCs and their conformance are on `lane-r157`.

## Strategy
One integration branch, lanes landing bottom-up in dependency order; the main line sees one merge. Old and new shapes never coexist (one way per thing), and the suites depend on each other in a cycle (check imports server, server imports testing, testing imports check; check and cli read the golden apps), so the whole tree is green only at the end. The gate at each lane merge is a red list: stage 0 records every failing test file per suite, and the failing set may only shrink.

## Stages and lanes
Each lane owns its paths; no lane edits `packages/*/conformance/**`. At most three lanes run tests at once. A lane touching check, compiler or schema runs the full cli suite and reports the red-list change. Budgets are re-based, not squeezed.
- Stage 0 (orchestrator): rebase `lane-r157` onto the main line after RFC 0160, 0161 and 0168 land; the conformance-writer converts conformance that arrived in the old shapes; record the red list.
- Stage 1: L1 router core (opus; `packages/router/**`): rebuild the RFC's type prototype first, then `@keel/router/contract`, `manifest(contract, binding)`, `loader` and `action` naming their entry, `routeTable`, several methods at one path, the page component called `(props, ctx)`; hands L6 a note on where each type error lands. L2 component signature (sonnet): `runtime-dom/**`, the compiler's `lowerFile` and `isSlotCall`, testing's `render`, the E1407 rule, `std-headless/**`, `std-tables/**`, `ui/**`. L1 merges before L2.
- Stage 2 (after L1): L3 server, forms and the rest of testing (opus core, haiku for `server/test`). L4 compiler and every `packages/std-*/module.ts` (opus). L5 services and std-offline (sonnet). Merge order L4, L3, L5.
- Stage 3 (after L3 and L4): L6 check and the cli's compat files (opus). L7 scaffold (sonnet). L8 std-health, std-sessions, std-channels (sonnet). Merge order L6, L8, L7.
- Stage 4: L9 golden-1, L10 golden-2, L11 apps/sessions and apps/inspector (haiku with a throwaway script), L12 the published skills (no tests). Each app takes both RFCs.
- Stage 5 (orchestrator): root check, test and build; ledger; ADR-0052 superseded; reviewer and red-team; the merge.

## Riskiest points
L1: binding types that infer the handler id with no annotation and place each type error where k.routes says; several methods per path in matching and the 405 `allow` header. L3: the request order (405, params 404, guard 403, query and body 422). L4: `routeLiterals` over contract and binding literals; E1558 over the new loader shape. L6: mapping TypeScript errors to E1506, E1510, E1515; E1562 over `surface.json` v2. L8: std-sessions' `replay`, `minimize`, `redact`, `commandJob`, `toTest` over a route table.

## At each merge
The diff stays inside the lane's paths; touched packages type-check and lint; the lane's green list passes; the red list did not grow; the cli suite ran where required; format, the `unsafe` count and orphan processes are clean.

## Size
Twelve lanes, about 550 files. The bulk is mechanical (server and router tests, the golden apps); the hard parts are L1's types and L6's code mapping.
