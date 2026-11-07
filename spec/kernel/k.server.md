# k.server: Thin server
status: conformance-covered

**API.** Hono underneath; app code sees only `topology` from `@keel/server`; `loader` and `action` come from `@keel/router` (run in-process in a client-only deployable); the server runs them over HTTP.
```ts
// modules/orders/show.server.ts
export const loadOrder = loader({ output: Order, params: OrderParams, search: OrderSearch }, async ({ params }, ctx) => api.getOrder({ params }, ctx))
export const updateOrder = action({ input: OrderEdit, params: OrderParams }, async (input, { params }, ctx) => {
  const to: Href = routes.href('orders.show', params)
  return ok(to)
})
```
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>`. Data is encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }`, and `ctx`; returns `Result<Href | null, KeelError>`. `ok(href)` redirects there; `ok(null)` stays.
- `params`/`search` are `Infer` of the declared schemas (`unknown` when omitted), the route's own (k.router E1507); `fn` is never annotated. `url` is the absolute request URL; server code never reads `location`.
- Both live in `*.server.ts` and are referenced from `routes.ts` (k.router).

**Server state** (rfc:0044). `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once and its stores restore from `ctx.storage` `keel.store.<id>` (`snapshot({ meta: true })`); `fn` gets that `S`. An action's `ok` saves the changed stores, none if another request saved one since (409 `keel.conflict`); `err` or a throw saves none. `caller` is the `keel-caller` cookie (minted on a cookieless write, set `HttpOnly; SameSite=Lax; Path=/`, `Secure` on https), else `""`; record it as `tx` meta `{ caller }` and `undoWhere` by it (k.store). Factory stores skip `#k-state` and inspect; server code never writes module stores; the client router refuses `stores`.

**Request flow.** Match the path in the route table -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the matched chain's loaders concurrently, then stream HTML with islands and serialized state (k.runtime). A loader `err` renders the route's `errorElement`.
- POST, PUT, PATCH, DELETE: first the same-site check (RFC 0022: `Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither header; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is 413 `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData (or a k.services JSON body) with the action's input schema (fail: `keel.fields`, action not called), run the action, then 303 to the target (document request) or return the `Result` as JSON (runtime request).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 as `keel.unexpected`. In production its message is `unexpected` and no stack leaves the server. `mode` defaults to `production`. `#k-state` holds every store created in the request scope.

**Document.** Island roots, markers and the entry script follow k.runtime; each route level is a candidate island root keyed by its route id (RFC 0037).

**Topology.**
```ts
// topology.ts
export default topology({ web: { modules: ['app', 'orders'], adapter: 'node' } })
```
Each deployable builds to one artifact. Adapters: `node` (Hono on Node; renders without a DOM global; serves the resume entry, k.runtime), `static` (prerendered HTML only), and `client` (no server: loaders and actions run in the browser, the compiler generates the entry that calls `mount(App, el)` with the router's `App`, and `ctx` is `createCtx({ mode: 'real' })`). Local only: a deployable's modules run in one process; calls between deployables are stdlib (split topology).

**Dev server.** `keel dev`: Vite and Hono in one process, HMR, real `ctx`. Log stream on stdout per OUTPUT.md, a record per event: `req` (compact `GET /orders/7 orders.show 200 12ms`), `diag` for every diagnostic and uncaught throw (app frames only, max 5), `reload`. `createApp({ log: { format: 'compact' | 'json', write } })` writes it, a line per `write` (rfc:0034). In dev it serves `/__keel/inspect`, gated per k.cli Inspect.

**Rules.** E1551 `loader` or `action` declared outside a `*.server.ts` file (also in a client-only deployable) · E1552 topology names an unknown module or one module in two deployables · E1553 `static` deployable contains a route with params or actions · E1554 loader data fails its output schema (dev diagnostic; 500 in production).

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
- `caller` is the sent cookie's token, else a fresh one set as a cookie on a write, else `""`.
