# W13 L3 (server, forms, testing): what it leaves for others

Branch `w13-l3`, built; merges into `lane-r157` after the main line's merge there and after L4.

## Red list (failing files, type errors)
server 115, 455 to 44, 36 (all 36 in conformance; 1,384 of 1,575 tests pass); testing 43, 91 to 3, 9; forms 14, 10 to 0, 0.

## For the conformance-writer (defects in conformance)
- server `contract-support.ts:28`: `ctx` is undefined; give `boot` a fourth parameter `ctx: Ctx = createCtx({ mode: "sim", seed: SEED })`. That turns api-routes-0086, contract-action-303, contract-api-query-422, path-methods-allow, render-passes-app-ctx and route-table-serve green (checked on copies).
- server `resume-app.ts:47,72`: old `loader({ output })` and `manifest(entries)`; it takes down the claim-*, owner-page and resume-* files.
- server, same old shapes: `place-routes.ts:7`, `e1555:19`, `guard-redirect-loop-e1508:31`, `module-std-config-client:109`, `privacy-diag-scrub:75`.
- server `identity-e1579:13` uses `route` before it exists; `log-record-bounds:2` does not import `contract`; `e1552:31` and `e1553:11` name module `app` where the fixture has only `orders`.
- testing `render-route-stores-0093:99` binds `read` under a second contract and needs its own loader; `build-untracked:77` lacks the `createCtx` and `simCtx` imports; `harness-passes-ctx` needs `render().ctx` plus `clock.advance` and `html`, which do not exist: check the spec sentence it quotes.

## Waits for the cli and compiler lanes
server conformance build-assets, deploy-env-keys-0092, deploy-frames-source-map, e1560-deploy-env, leave-process, start-database-url, topology-server-mjs, hosting-0087; server `test/productionEntryBundle` (its fixture `topology-build-fixture.ts` is old-shape).

## For the check, cli, std and services lanes
- An API 422 carries its fields under `query.` and, for a write, `body.`: the service client (L5, merged) must map them; check its decoding against a real server once both are on the lane.
- `createApp`'s modules come from `routes.contracts`; `start` takes `routes: RouteTable[]` and joins them with `routeTable(...)`.
- Only an `events: true` API GET streams; anything else asked for a stream is 406. E1558 is checked before E1511, since a live loader is always an API entry.
- A page POST with any verb bound goes on to `runAction`, so `_method` still works. HEAD answers through the GET entry; OPTIONS is never an entry method.

## Budgets
`@keel/server` 26.5 kB (27,126 B); `@keel/testing` 13.65 kB (13,943 B) before the main line's host element work is merged in.
