# Task 0031: inspector viewer built in Keel

**Spec:** k.cli (Inspect; RFC 0017) · k.reactive `inspect()` · k.store `stores()`/`snapshot()` · k.compiler artifacts · k.server dev · **Gate:** G2 · **Status:** closed · **Branch:** jdforsythe/test-impl · **Packages:** compiler, server, cli; app `apps/inspector`

## Deliverables
- [x] RFC 0017 committed alone (`rfc:0017 cli: inspect endpoint and viewer`)
- [x] spec: k.cli Inspect paragraph, `inspect [url]` row, E1056, conformance lines; k.server dev line; explain row E1056
- [x] compiler: `/__keel/inspect` middleware on Vite dev and preview servers; dev entry posts the live half
- [x] server: `createApp` dev route `GET /__keel/inspect` (`artifacts` option)
- [x] cli: `keel inspect [url]` fetches and summarizes (`Io.fetch`)
- [x] `apps/inspector`: route `inspector.index` (`url` search), loader through a `services` client, `GraphView`, `StoresView`, `IdsView`, tests with sim net fixtures
- [x] smoke `tooling/smoke/inspector.mjs` against golden-1 (4180) and the inspector (4182)
- [x] changeset, READMEs, backlog tick

## Steps
1. [x] RFC written and committed alone.
2. [x] spec edits (k.cli Inspect, row, E1056, 2 conformance lines; k.server dev line; explain E1056)
3. [x] compiler endpoint + entry (`internal/inspectMiddleware.ts`, `INSPECT_PATH.ts`, `entryCode.ts`; test/inspect.test.ts 8)
4. [x] server dev route (`internal/inspectResponse.ts`; test/inspect.test.ts 4)
5. [x] cli command (`internal/inspectCommand.ts`, `InspectDocSchema`, `InspectStoreSchema`, `Io.fetch`; test/inspect.test.ts 6)
6. [x] apps/inspector: `keel scaffold project inspector --workspace` (writes into the cwd, so run from apps/ and moved into apps/inspector), `scaffold module inspector`, module `app` removed, `scaffold route inspector.index --path /`, `codemod rename IndexPage InspectorPage`, `scaffold component inspector/{GraphView,StoresView,IdsView}`; the loader was renamed by hand (`codemod rename` takes route ids, not loaders: E1052). Tests: routes 4, components 10 (properties for the three views and the page).
7. [x] smoke `tooling/smoke/inspector.mjs`: golden-1 (dev build) previewed on 4183 because another agent's golden-1 preview held 4180; inspector on 4182. Graph 49 nodes / 20 edges in 4 kinds, store `todos.board` with 1 entry and the undo marker, 29 ids / 29 a11y, no console errors. `keel inspect http://localhost:4183`: `todos.board 1 entries, last todos.addList` / `ok inspect live 49 nodes, 20 edges, 1 stores, 29 ids, 29 a11y, 4 routes`. Servers stopped; golden-1 dist rebuilt for production.
8. [x] verification, commit

## Decisions
- D1: Live data for a client-only app comes from the page, not an iframe: the inspector is Keel app code and may not touch `window` (E1252), and target and viewer have different origins. The generated entry, when `import.meta.env.DEV`, posts `{ graph: inspect(), stores }` to `/__keel/inspect` after mount and then at most once a second when the serialized body changed (an interval, not an `effect`, so the reporter never appears in the graph it reports). The plugin keeps the last post per server; `live: false` until one arrives.
- D2: The plugin serves the endpoint on the dev server and on `vite preview` (both local-only). Artifacts are read from `.keel/` on each GET (`data` field). A production build has no reporter (`import.meta.env.DEV` false), so the smoke builds golden-1 with `NODE_ENV=development`.
- D3: CORS: the endpoint answers cross-origin reads only for loopback origins (`http://localhost|127.0.0.1|[::1]`, any port), echoing the origin; anything else gets no CORS header (the browser blocks it). POST is same-origin only.
- D4: `createApp` serves the route when `mode` is `dev` (the default), before the route table; `artifacts` (a directory, e.g. `.keel`) supplies ids/a11y/routes, read per request; absent, they are `{}`. `live` is always true there (`inspect()` and `stores()` of the process).
- D5: `keel inspect [url]` (default `http://localhost:5173`) needs `Io.fetch`; the binary passes `globalThis.fetch`; without it the engine reports I1055 as before. Unreachable, non-2xx, or a body that is not an inspect document: E1056 (exit 1). Records: one `inspect.store` per store, then a summary `inspect live` or `inspect (no live page)` with counts nodes, edges, stores, ids, a11y, routes.
- D7: k.schema has no unknown/JSON type, so the viewer's schema declares a store's `log` and the artifact entries' known fields; `state` (any JSON) is read by `"state" in entry` narrowing and shown as JSON text. Undeclared keys pass through `parse`/`decode` today (unspecified); a `s.json()` type would make this declared (backlog 0056).
- D6: The inspector fetches through a `@keel/services` client (`inspectApi`, E1651) built at call time with `base` = the `url` search param, in the route loader (client-only deployable: loaders run in the browser).
- D8: Conformance tests for the two new k.cli clauses are not in `packages/*/conformance/` (this task may not edit conformance/); they are covered by `packages/server/test/inspect.test.ts` and `packages/cli/test/inspect.test.ts`. A conformance-writer pass is follow-up work.
- D9: The compiler half (inspectMiddleware, INSPECT_PATH, entryCode, vite.ts, test/inspect.test.ts) landed inside commit 9a5b8c1 (feat(0032)), which a concurrent agent staged while this task was in flight; the rest is in this task's implementation commit.

## Verification
- [x] spec section cited (k.cli Inspect, RFC 0017); `keel spec k.cli` within 1,500 tokens (~1,075)
- [x] `pnpm check` green (33 tasks, structure-lint, generate, docs-freshness, budgets)
- [x] `pnpm test` green (31 tasks); `pnpm test --filter inspector` 14/14
- [x] property tests present: `properties()` for GraphView, StoresView, IdsView, InspectorPage
- [x] ledger `--diff` clean; unsafe count unchanged (no casts, no `any`, no `!`)
- [x] smoke shows the three views populated
