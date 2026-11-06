# k.server: Thin server
status: implemented

**API.** Hono underneath; app code sees only `topology` from `@keel/server`; `loader(output, fn)` and `action(input, fn)` are declared by `@keel/router` (they run in-process in a client-only deployable) and the server executes them over HTTP.
```ts
// modules/orders/show.server.ts
export const loadOrder = loader(Order, async ({ params, search }, ctx) => api.getOrder({ params }, ctx))
export const updateOrder = action(OrderEdit, async (input, { params }, ctx) => ok(href('orders.show', params)))
```
- `loader(output, fn)`: `fn` gets parsed `params`, `search`, and `ctx`; returns `Promise<Result<T, KeelError>>`. Data is encoded with `output`.
- `action(input, fn)`: `fn` gets the decoded input, `{ params }`, and `ctx`; returns `Result<Href | null, KeelError>`. `ok(href)` redirects there; `ok(null)` stays on the current route.
- Both live in `*.server.ts` and are referenced from `routes.ts` (k.router).

**Request flow.** Match the path in the route table -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run every loader in the matched layout chain concurrently, then stream HTML with islands and serialized state (k.runtime). A loader `err` renders the route's `errorElement`.
- POST, PUT, PATCH, DELETE: decode FormData with the action's input schema (fail: `keel.fields`, action not called), run the action, then 303 to the target for a document request or return the `Result` as JSON for a runtime request.

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · other `err` 400 · uncaught throw 500 as `keel.unexpected`. In production its message becomes `unexpected` and no stack leaves the server.

**Topology.**
```ts
// topology.ts
export default topology({ web: { modules: ['app', 'orders'], adapter: 'node' } })
```
Each deployable builds to one artifact. Adapters: `node` (Hono on Node), `static` (prerendered HTML only), and `client` (no server: loaders and actions run in the browser, the compiler generates the entry that calls `mount(App, el)` with the router's `App`, and `ctx` is `createCtx({ mode: 'real' })`; golden app 1 uses it). Local only: a deployable's modules run in one process; calls between deployables are stdlib (split topology).

**Dev server.** `keel dev`: Vite and Hono in one process, HMR, real `ctx`. Log stream on stdout per OUTPUT.md, one record per event: `req` (compact `GET /orders/7 orders.show 200 12ms`), `diag` for every diagnostic and uncaught throw (app frames only, max 5), `reload`. `keel inspect log` reads the same stream.

**Rules.** E1551 `loader` or `action` declared outside a `*.server.ts` file (in a client-only deployable those files are bundled to the browser; E1551 still applies) · E1552 topology names an unknown module or one module in two deployables · E1553 `static` deployable contains a route with params or actions · E1554 loader data fails its output schema (dev diagnostic; 500 in production).

**Conformance.**
- A GET with params that fail the params schema returns 404 and calls no loader.
- All loaders of a matched chain start before any of them resolves.
- A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
- A POST with invalid FormData returns 422, does not call the action, and lists the field errors.
- For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
- An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame.
- The dev log stream emits exactly one `req` record per request; in json mode every line parses.
