# k.server: Thin server
status: conformance-covered

**API.** App code imports only `topology` from `@keel/server`; `loader` and `action` (`@keel/router`) run over HTTP.
```ts
export const load = loader({ output: Order, params: Params }, ({ params }, ctx) => api.getOrder({ params }, ctx))
export const update = action({ input: Edit, params: Params }, (_, { params }) => ok(routes.href('orders.show', params)))
```
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>`, data encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }`, and `ctx`; returns `Result<Href | null, KeelError>`.
- `params`/`search` are `Infer` of the declared schemas (else `unknown`), the route's own (E1507); `fn` is never annotated. `url` is the absolute request URL, never `location`.

**Server state** (rfc:0044, 0054). `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once; its stores restore from `ctx.storage` `keel.store.<id>` (`snapshot({ meta: true })`); `fn` gets that `S`. An action's `ok` saves the changed stores, none if another request saved any of the factory's since (409 `keel.conflict`); `err` or a throw saves none. `caller` is the base64url SHA-256 of the `keel-caller` cookie (minted on a cookieless write, set `HttpOnly; SameSite=Lax; Path=/`, `Secure` on https), else `""`; `tx` meta `{ caller }` scopes `undoWhere`. Factory stores skip `#k-state` and inspect; server code never writes module stores; the client router refuses `stores`.

**Request flow.** Match the route table -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the matched chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither header; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is 413 `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData or JSON by the action's input schema (fail: `keel.fields`, action not called), run the action, then 303 to the target (document request) or return the `Result` as JSON (runtime request).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 as `keel.unexpected`. In production: message `unexpected`, no stack. `mode` defaults to `production`. `#k-state` holds every store created in the request scope.

**Document.** Each route level is a candidate island root by route id.

**Topology.** `export default topology({ web: { modules: ['app'], adapter: 'node' } })` in `topology.ts`.
Adapters: `node` (Hono on Node; no DOM global; serves the resume entry), `static` (prerendered HTML only), and `client` (loaders and actions run in the browser; the entry calls `mount(App, el)` with a real `ctx`). A deployable's modules share one process; calls between deployables are stdlib.

**Build** (rfc:0048, 0052). `keel build` Vite-bundles each `node` deployable's resume entry and islands into `dist/<name>/` with `.vite/manifest.json`. Production `createApp({ assets: 'dist/<name>' })` loads it at startup, scripts the built entry, serves `/assets/*` `immutable`; dev, or no `assets` in development or test, serves `/@keel/entry.ts`.

**Dev server.** `keel dev`: Vite and Hono, one process, HMR, real `ctx`. Stdout log (OUTPUT.md), a record per event: `req`, `diag` for every diagnostic and uncaught throw (app frames only, max 5), `reload`. `createApp({ log: { format: 'compact' | 'json', write } })` writes it, a line per `write`. Dev serves `/__keel/inspect` (k.cli).

**Rules.** E1551 `loader` or `action` declared outside a `*.server.ts` file (any deployable) · E1552 topology names an unknown module or one module in two deployables · E1553 `static` deployable has a route with params or actions · E1554 loader data fails its output schema (dev diagnostic; 500 in production) · E1555 production `assets` without a manifest entry, or no `assets` unless `NODE_ENV` is `development` or `test` (`createApp` rejects).

**Conformance.**
- A GET with params that fail the params schema returns 404 and calls no loader.
- All loaders of a matched chain start before any of them resolves.
- A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
- A POST with invalid FormData returns 422, does not call the action, and lists the field errors.
- For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
- An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame.
- The dev log stream emits exactly one `req` record per request; in json mode every line parses.
- A JSON or FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action.
- A loader's `url` is the absolute URL of the request it serves.
- Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`. A conflicting or `err` action and an unchanged store save nothing.
- `caller` is the hash of the sent cookie's token, else of a fresh one set as a cookie on a write, else `""`.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
