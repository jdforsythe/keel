# W13 L6 (check, cli): what it leaves for others

Branch `w13-l6`, built in ten commits; merges into `lane-r157` after the layout fix there (D73).

## Result
check: type errors map by position to E1510, E1506, E1515, never E1751; E1513, E1514, E1502 to E1504 and E1653 on contracts; E1509 per deployable table; E1155, E1111, E1508, E1511, E1567 read contracts; E1562 over `surface.json` version 2, W1568 for a base that is not one; E1507, E1512, E1561, E1157 no longer reported; `routesMismatch` compares `method`. `keel explain` keeps a row for each retired code, worded as retired (the RFC says so and cli `E1561-retired` requires it). E1502 to E1504 and E1506 are reported and not in `reportedCodes()`, since no fixture exists for them: they need fixtures. E1111 also counts an API `query` (k.privacy is silent: state it).
cli: `surface.json` version 2 assembled from the contracts with `callers` from `contractCallers`; a throwing contract is the surface step's E1006, exit 1.
Red list: check 13 failing files to 6 (2,124 pass, 6 fail), type errors 2 to 0; cli 61 failing files to 15 (1,210 pass, 21 fail). Turned green: compiler `shell-entry`; server build-assets, deploy-env-keys-0092, e1560-deploy-env, hosting-0087, start-database-url, topology-server-mjs, `test/productionEntryBundle`. Budgets: `@keel/check` 53.2 kB (54,460 B), its explain entry 14 kB (14,290 B). `unsafe` unchanged.

## For the conformance-writer
- check `fixtures-by-code.ts:517` (E1513): a `routes.ts` exporting `a` is also E1752; put the call in `modules/a/a.ts`.
- check `where-codes-check:79`: the GET entry needs a `body`. `module-stdlib-schema-and-rules:168`: expect `contract.ts`, not `routes.ts`. `privacy-e1111:125`: it replaces the text `"export const app"`, which is gone.
- cli `E1562-base-route-change:41,67`: an open `s.object` gains an optional field, which k.compat's Accepts refuses; use closed bodies. `compat-output-0104:91`: `load.server.ts` still loads the removed `y.load`. `boundary-build-gate:12` replaces a path that now sits in the contract. `boundary-assertion:197` replaces a View import that no longer exists. `boundary-limits:48`: no page imports `routes.ts` any more. `host-code-css-build`: old `manifest({`. `artifact-routes-literals:39-55`: the contract is written inside `routes.ts`. `schema-format-json-schema:33`: the format import belongs in the contract. `module-std-config-createapp:77`: a type error. `mcp-build-0092:60`: `input` should be `body`.
- server `deploy-frames-source-map:22-34`: the contract must move to `a.contract.ts`. `leave-process-fixture.ts:67`: `new Promise` has no type argument.

## For the compiler (a defect)
- check `test/routes-fragment-root` expects W1005: `packages/compiler/src/.../projectManifests.ts:23` drops an unresolvable stdlib module instead of naming it unread. cli `boundary-assertion:103` is the compiler's vite E1007.

## Clears in stage 4 or with L7
cli `test/golden.test.ts`, `check-budget-injected10` (golden-1 old shape); cli `test/scaffold.test.ts`, `scaffold-api-route-run` (scaffold, merged on the lane). Load-related in the full cli run, green alone: `a11y-ledger-claims`, `bundle-names`.

## For the app lanes
Pages import their module's contract; E1155 reads contract keys; `surface.json` is version 2.
