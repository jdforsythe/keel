# RFC 0093: `renderRoute` runs server stores

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 3, 5, 7; tasks/0312-s6-compliance/PLAN.md D14). For backlog 0546. Each decision cites the WORKFLOW RFC default it applies; none of the points the defaults escalate arise (Questions).

## Decision
`renderRoute` runs a loader's or action's `stores` factory over the harness ctx's `ctx.storage` through the same runner `createApp` uses, each navigation or submit being one request. The runner (`openStores`, `saveStores` and their helpers) moves from `packages/server/src/internal/` down to a new internal subpath, `@keel/store/internal`, which `@keel/server` and `@keel/testing` both import; the in-process copy of saved snapshots is kept per `ctx.storage`, so a harness and a `createApp` on one ctx see one state. The router gains an internal entry, `createRouterWith(routes, options, state)`, that takes the runner; the public `createRouter` passes none and keeps refusing `stores`.

## Problem
Measured on `jdforsythe/test-impl` at `9f1a2c7`.
- `packages/router/src/internal/runLoaders.ts:17`: `if (l.stores !== undefined) return err(unexpected(STORES_SERVER_ONLY));` and `packages/router/src/createRouter.ts:280`: `else if (act.stores !== undefined) result = err(unexpected(STORES_SERVER_ONLY));`, with the message "stores (server state) run on a node deployable only" (`packages/router/src/internal/STORES_SERVER_ONLY.ts:2`).
- `packages/testing/src/renderRoute.ts:41` builds its page with that router: `createRouter(options.routes, { ctx, history: memoryHistory(url), caller: options.caller ?? "" })`. A route whose loader names `stores` renders its `errorElement` with `keel.unexpected`, and the render check fails with it.
- The runner lives in `packages/server/src/internal/`: `openStores.ts:23-60` (the factory runs once per request in an isolated child scope; each store restores from `keel.store.<id>`, all keys read in one `inOrder` section), `saveStores.ts:54-65` (after an action's `ok`: conflict check over the read set, then `ctx.storage.set` and a `save` event), called from `runLoaders.ts:20` and `runAction.ts:68-75`. The copy of each saved key is per app: `createApp.ts:145-146` (`saved: new Map(), saving: new Map()`).
- `tooling/deps.json` orders `router` (6th) < `testing` (11th) < `server` (12th), and imports point downward only (S0003), so `@keel/testing` cannot import the runner where it is.
- k.server Server state: "client routers refuse `stores`". k.testing Harness: `renderRoute` "runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain". Nothing says the harness is a client router, and nothing lets it run server state.
- Effect: a page that a `node` deployable renders from server stores has no `renderRoute` test, so no `a11y:` claims (docs/COMPLIANCE.md: "a route nobody renders claims nothing"), no focus checks and no form tests. golden-1 works around it: `apps/golden-1/test/ssrNode.test.ts:22-27` fetches documents from `createApp` and matches HTML strings, and `apps/golden-1/test/api.test.ts:39-43` calls `fn` with stores it builds by hand. The S6 exit-proof app cannot: `evals/tasks/golden-3/TASK.md:23` declares `stores: boardStores` on every loader and action of its one `node` deployable, and `:49` asks for a `renderRoute` test of each of its six pages, a Form sign-up that lands on `shifts.mine`, and focus checks.

## Proposal
Defaults applied: 1 (the stdlib-stage need is met by a kernel change), 3 (one runner for the server and the harness; one router for the browser and the harness), 5 (server state still never runs in a browser router).

### The runner moves to `@keel/store/internal`
- Moved from `packages/server/src/internal/` to `packages/store/src/internal/`, unchanged in behavior: `openStores`, `saveStores`, `inOrder`, `Saved`, `savedOf`, `Held`, `Opened`, `Factory`, with their unit tests.
- Generalized at the seams:
  - The request the runner needs is `StateRequest` `{ scope: Scope; held: Map<Factory, Promise<Held>> }`; the server's `RequestScope` keeps its other fields (`caller`, `allowed`, `pii`) and satisfies it.
  - `openStores(copy, rq, factory, seen?)` calls `seen(schema, state)` for each restored store; the server passes its `notePii` into `rq.pii`, the harness passes nothing. Privacy tracking stays in `@keel/server`.
  - `copyOf(storage)`: the in-process copy (`saved`, `saving`) of one `ctx.storage`, held in a `WeakMap` keyed by the storage object. `createApp` drops `Served.saved` and `Served.saving` and uses `copyOf(ctx.storage)`.
  - `serverState(ctx): ServerState` with `request(): { stores(factory): Promise<unknown>; save(): Promise<Conflict | null>; end(): void }`. `request()` opens a root scope, isolated (k.store `isolate`); `stores` is `openStores` on it; `save` is `saveStores`; `end` disposes the scope. `ServerState` is declared here; the router imports it as a type.
- New export `"./internal"` in `packages/store/package.json` (not public, as `@keel/router/internal`); `@keel/store` gains the dependency `@keel/ctx` (the `Ctx` type and `report` for `save` events). `ctx` may be imported from any package (`tooling/deps.json` rule), and `@keel/ctx` depends on `@keel/schema` only, so no cycle.
- Boundary: the code moves from `server` (12th) to `store` (3rd). `server` and `testing` import it downward; `router` (6th) imports one type from `store` (3rd), downward. `tooling/deps.json` is unchanged.

### The router takes the runner through an internal entry
- `@keel/router/internal` exports `createRouterWith(routes, options, state?: ServerState)`; `createRouter(routes, options)` from `@keel/router` is `createRouterWith(routes, options, undefined)`. The public signature and types are unchanged.
- With `state` absent, a loader or action naming `stores` answers `keel.unexpected` "stores (server state) run on a node deployable only", as today.
- With `state`: each loader run (a navigation, a guard's redirect target, a revalidation after `ok(null)`) is one `request()`: every loader of the chain naming a factory gets its one instance (`stores(factory)`), as the loaders of one GET share one instance on the server; `end()` runs once every loader settled. A submit is one `request()`: the action gets its instance; `ok` calls `save()`, and a conflict replaces the result with `err(keel.conflict)`; `err` or a throw saves nothing; `end()` runs before the router revalidates or navigates, so the next page reads what was saved.

### `renderRoute`
`packages/testing/src/renderRoute.ts` calls `createRouterWith(options.routes, { ctx, history, caller }, serverState(ctx))`. Nothing else in `@keel/testing` changes.

### Semantics
- **Where the state comes from.** `ctx.storage` of the render's ctx, key `keel.store.<id>`, as on the server. A test seeds a server store by writing its snapshot JSON there before the first render (golden-1's `seedBoard` in `apps/golden-1/test/simApi.ts:27-28` already does: `storage.set(BOARD_KEY, JSON.stringify({ state, log: [], initial: state }))`). With no `ctx`, the default sim ctx has empty storage, so each factory store starts at its initial state.
- **`state?` and `state()`.** `state` seeds the stores of the harness registry, as today. Factory stores are made per request in isolated scopes, so `state` cannot name them and `state()` never lists them, as `#k-state` never holds them (k.server). A test reads saved server state from `ctx.storage`, or through the page.
- **Writes.** An action's `ok` saves its changed stores to `ctx.storage` and reports `save` to the ctx's observers (k.sync); `err` or a throw saves none. A read set saved by another request since is `keel.conflict`, which reaches the Form as any action `err` does in a client router. `dispose` restores the `state` stores and leaves storage as the test made it: the ctx belongs to the test.
- **`caller`.** `options.caller` (default `''`) is the `caller` every guard, loader and action gets. The harness has no cookie; a test names the caller hash it means. `tx` meta `{ caller }` and `undoWhere` work as on the server, since `fn` passes it.
- **`fire`.** A `submit` (or a click on a submit button) goes through the router's Form path: input decoding (`keel.fields` in place), then the action with its instance, then the save, then the revalidation or navigation to the returned `Href`. `fire` resolves when that settles, since the router stays `pending` until then.
- **Isolation.** Each request has its own instances. Two renders on one ctx share its storage and its copy, as two requests to one app do; a `createApp` on that ctx shares them too (`copyOf` is per storage). Renders on different ctxs share nothing.
- **Sim ctx and schedules.** Factories get the harness ctx (sim by default: clock, random ids). A sim storage schedule (k.sim `storage[n]`) applies to the runner's `get` and `set`: a failed `get` makes the loader `keel.unexpected`; a failed `set` rejects the save, so the action is `keel.unexpected` (the server's 500). In `simulate`, a scenario passes its `ctx` to `renderRoute` and the same holds.
- **Unchanged rules.** A factory store with a default id throws (`keel.unexpected`); E1554 applies to loader output; a live loader gives its first yield, as the router does now.

### What stays refused
- A browser router: `createRouter` from `@keel/router` passes no runner, so a `client` deployable's loader or action naming `stores` is still `keel.unexpected` with the same message (k.server: "client routers refuse `stores`").
- `render` and `resumeDocument` run no loaders or actions and are unchanged.
- HTTP behavior stays with `createApp` tests: status codes, the 303, the caller cookie, the same-site check, `maxBodyBytes`, the document re-render at 422, and the scrubbed `diag` log.

### Files
`packages/store/src/internal/{openStores,saveStores,inOrder,savedOf,copyOf,serverState}.ts` and types, `packages/store/src/internal/index.ts`, `packages/store/package.json`; `packages/server/src/createApp.ts`, `internal/{runLoaders,runAction,liveStream,Served,RequestScope}.ts` (imports, `copyOf`); `packages/router/src/createRouter.ts`, `internal/runLoaders.ts`, `internal/index.ts`, `package.json` (`@keel/store`, type only); `packages/testing/src/renderRoute.ts`; `packages/testing/README.md` (`renderRoute` line), `.claude/skills/keel-testing/SKILL.md` and `.claude/skills/keel-api/SKILL.md` (one line each: seed `ctx.storage`, render, submit).

## Alternatives
- **Tests go through `createApp` and a DOM render of its document** (`resumeDocument`, or a full-page variant). Rejected: every step is an HTTP round trip and a fresh document, so the client-navigation checks (focus to the new page's `h1`, `navigate`, Form errors in place) do not exist; it is a second way to render a page for its claims (default 2).
- **A `@keel/server/testing` helper.** `server` may import `testing`, so `renderNodeRoute` there could wrap `renderRoute` with the runner. Rejected: two functions that render a page (default 2), a test that imports from two packages for one page, and `@keel/server` with about 100 B left of its budget.
- **Reorder `tooling/deps.json` so `testing` follows `server`**, and import the runner from a new `@keel/server/internal`. Smaller diff. Rejected: the harness, loaded by every component test, then depends on the HTTP server package (hono, the node adapter); the runner depends only on `reactive`, `store` and `ctx`, so its home is the lowest package that has all three; and the order is a shared file whose rule other packages lean on.
- **The runner in `@keel/router/internal`.** Rejected: the runner snapshots and restores stores and does no routing; `router` would gain a runtime dependency on `store` for code its browser entry never runs.
- **A public `createRouter({ stores })` option.** Rejected: a new user-facing API shape that lets a browser router run server state over browser storage (default 5).
- **Loader data stubs in `renderRoute`** (`data: { [routeId]: value }`). Rejected: the loaders and actions under test never run, and Form tests cannot save.
- **One copy per `createApp` and one per render.** Rejected: on one ctx, a harness save is invisible to an app that already read the key, and that app's next save overwrites it without a conflict (a lost update the shared copy prevents).

## Spec diff
Sizes are `tooling/spec.mjs`'s count (ceil(characters / 4)) of each section with the change applied, measured on the current files.

**k.testing** (1,094 to 1,229)
- Harness, replace "- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready." with "- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready. Loaders and actions naming `stores` run their factories over `ctx.storage` as a `node` deployable does (k.server Server state), each navigation or submit one request; `state` and `state()` hold no factory store."
- Conformance, insert before "- `resumeDocument` of an island document from `createApp` …":
  - "- `renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state."
  - "- On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation."
- Status stays `conformance-covered` once both clauses have tests (written before the implementation).

**k.server** (1,442, unchanged). "client routers refuse `stores`" stays true: the harness is not a client router, and the browser router still refuses.

No other section changes. The map is unchanged.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:
- New: `packages/testing/conformance/render-route-stores-0093.test.ts`, citing the first new k.testing clause. A sim ctx whose storage holds a factory store's snapshot; `renderRoute` shows it (`find`); a Form submit through `fire` saves (the storage key changes; an observer gets one `save`); the page shows the new state; an action `err` saves nothing. Counterpart in the same file, citing k.server Server state ("client routers refuse `stores`"): `createRouter` from `@keel/router` over the same routes answers `keel.unexpected`.
- New: `packages/server/conformance/render-route-shared-copy-0093.test.ts`, citing the second new k.testing clause. It lives under `server` because `testing` may not import `@keel/server` (S0003).
- Changed: none. No conformance file encodes the refusal: `packages/*/conformance` has no hit for "node deployable only" or `STORES_SERVER_ONLY`, and the `stores` hits under `packages/testing/conformance` are `#k-state` fixtures (`stores: {}`). No unit test encodes it either (`packages/*/test`, same search).
- Kept green, guarding the move: `packages/server/conformance/server-state-instances.test.ts`, `read-set-conflict.test.ts`, `sync-save-observe.test.ts`, and `packages/router/conformance/internal-subpath.test.ts` (its listed names stay exported).
- Ledger: two new k.testing clause items; no clause number shifts.

## Diagnostics
No code is taken. The browser router keeps `keel.unexpected` with its message; the harness's failures are the existing ones (`keel.unexpected`, `keel.conflict`, `keel.fields`, E1554, the render checks).

## Token impact
k.testing 1,229 and k.server 1,442, both under 1,500; the map is unchanged. Package sizes (gzip, own code, dependencies external, as `tooling/budgets.mjs` measures; current figures measured at `9f1a2c7`):
- `@keel/server` 19,871 of 19,968: about 1,100 B smaller (`openStores` and `saveStores` measure 724 B and 652 B alone; they share imports).
- `@keel/testing` 12,377 of 12,544: about +60 B (two imports and one argument).
- `@keel/router` 10,102 of 10,240: about +150 B (the `state` parameter, one request per loader run and per submit, `save` and `end`). If the measure passes 10,240 B, `@keel/router` is re-based to 10.25kb with this reason in the commit (default 7). These bytes reach browsers in every client router, which never passes a runner; the alternative is a second router for the harness (default 3).
- `@keel/store` (`.`) unchanged. New entry `@keel/store/internal`, about 1,500 B: `tooling/budgets.json` gains `"@keel/store/internal": { "max": "1.75kb", "platform": "node" }` (the orchestrator's file).

## Migration
None for the golden apps or projects outside the repo: `renderRoute` of a route without `stores` runs as before, and the public `createRouter` is unchanged. golden-1's workarounds (`ssrNode.test.ts`, `api.test.ts`) keep working and may move to `renderRoute` later. golden-3 becomes buildable as `evals/tasks/golden-3/TASK.md` states it.

One behavior change for `createApp`: two apps over one ctx now share the copy of each saved key, so a save by one is read by the other and a stale save is `keel.conflict`. Before, each kept its own copy and could read a stale snapshot or overwrite the other's save. A test that relied on separate copies would be one that builds two apps whose factories share a key on one ctx; the implementer runs the server, cli and golden suites to confirm none does.

## Known limits
- A route of a `client` deployable that names `stores` now renders in a test and refuses in the browser. Nothing checks it before run time today (E1558 covers live loaders, and only in `createApp`). Default 6 asks for the guard: the orchestrator files a backlog line for a `keel check` and `keel build` rule, by E1558's widening to "a loader or action naming `stores` that a non-`node` deployable serves", read from the module's `*.server.ts` sources as E1559 reads routes.
- The copy reads a key from storage once: a `ctx.storage.set` of a `keel.store.<id>` key after a request read it is not seen, as on the server. Seed before the first render.
- A factory store passed in `state` seeds an instance no request reads; the harness does not report it.
- A loader or action throw in the harness is `keel.unexpected` with the throw's message, as in the client router; the server's scrubbing of `.pii()` values (k.privacy Server log) applies to `createApp` only. Tests that check log privacy keep using `createApp`, as golden-3's `privacy.test.ts` does.

## Questions
None. The defaults decide each point (1, 3, 5, 6, 7 above). No new user-facing API shape (the new names are under `/internal` subpaths, not public), no privacy or auth change (the browser router still refuses; the harness runs server state only in the test process), no external integration, and no golden-app migration.
