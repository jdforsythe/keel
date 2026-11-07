# k.server: Thin server
status: conformance-covered

**API.** Hono underneath; app code sees only `topology`, `undoOwn`, and `canUndoOwn` from `@keel/server`; `loader` and `action` are declared by `@keel/router` (they run in-process in a client-only deployable) and the server executes them over HTTP.
```ts
// modules/orders/show.server.ts
export const loadOrder = loader({ output: Order, params: OrderParams, search: OrderSearch }, async ({ params, search, url }, ctx) => api.getOrder({ params }, ctx))
export const updateOrder = action({ input: OrderEdit, params: OrderParams }, async (input, { params }, ctx) => ok(href('orders.show', params)))
```
- `loader({ output, params?, search? }, fn)`: `fn` gets `{ params, search, url }` and `ctx`; returns `Promise<Result<T, KeelError>>`. Data is encoded with `output`.
- `action({ input, params? }, fn)`: `fn` gets the decoded input, `{ params, url }`, and `ctx`; returns `Result<Href | null, KeelError>`. `ok(href)` redirects there; `ok(null)` stays on the current route.
- `params`/`search` are `Infer` of the declared schemas (`unknown` when omitted), which are the referencing route's own values (k.router E1507); `fn` is never annotated. `url` is the absolute request URL; server code never reads `location`.
- Both live in `*.server.ts` and are referenced from `routes.ts` (k.router).
- `undoOwn(store)` undoes the store's last entry, and `canUndoOwn(store)` is true, only when the current request's caller committed it during an action's synchronous run; else false and nothing changes (also outside a request or after an `await`). The caller is the `keel-caller` cookie, minted on a first write as `HttpOnly; SameSite=Lax; Path=/` (`Secure` on https).

**Request flow.** Match the path in the route table -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run every loader in the matched layout chain concurrently, then stream HTML with islands and serialized state (k.runtime). A loader `err` renders the route's `errorElement`.
- POST, PUT, PATCH, DELETE: first the same-site check (RFC 0022): pass on `Sec-Fetch-Site` `same-origin` or `none`, an `Origin` equal to the request's, `accept: application/json` with `x-keel: 1` (a k.services client sends it), or neither `Origin` nor `Sec-Fetch-Site`; else 403 `keel.denied`, nothing runs. `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is 413 `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData with the action's input schema (a `content-type: application/json` body, as a k.services client sends, is parsed with it instead) (fail: `keel.fields`, action not called), run the action, then 303 to the target for a document request or return the `Result` as JSON for a runtime request.

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · other `err` 400 · uncaught throw 500 as `keel.unexpected`. In production its message becomes `unexpected` and no stack leaves the server. `mode` defaults to `production`. `#k-state` holds every store created in the request scope and the module stores listed in `expose`, each of those as `{ state, log: [], initial: state }` unless exposed with `log: true` (RFC 0022).

**Topology.**
```ts
// topology.ts
export default topology({ web: { modules: ['app', 'orders'], adapter: 'node' } })
```
Each deployable builds to one artifact. Adapters: `node` (Hono on Node; renders without a DOM global), `static` (prerendered HTML only), and `client` (no server: loaders and actions run in the browser, the compiler generates the entry that calls `mount(App, el)` with the router's `App`, and `ctx` is `createCtx({ mode: 'real' })`; golden app 1 uses it). Local only: a deployable's modules run in one process; calls between deployables are stdlib (split topology).

**Dev server.** `keel dev`: Vite and Hono in one process, HMR, real `ctx`. Log stream on stdout per OUTPUT.md, one record per event: `req` (compact `GET /orders/7 orders.show 200 12ms`), `diag` for every diagnostic and uncaught throw (app frames only, max 5), `reload`. `createApp({ log: { format: 'compact' | 'json', write } })` writes the stream, one line per `write`; the dev entry passes stdout (rfc:0034). In dev it also serves `/__keel/inspect`, gated as k.cli Inspect states.

**Rules.** E1551 `loader` or `action` declared outside a `*.server.ts` file (in a client-only deployable those files are bundled to the browser; E1551 still applies) · E1552 topology names an unknown module or one module in two deployables · E1553 `static` deployable contains a route with params or actions · E1554 loader data fails its output schema (dev diagnostic; 500 in production).

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
- `undoOwn` from a caller other than the one that committed the store's last entry returns false and leaves the store unchanged; that caller's own `undoOwn` then succeeds.
