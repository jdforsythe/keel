# k.router: Routes
status: conformance-covered

**Manifest.** Each module's `routes.ts` (k.module) exports one manifest; a deployable's route table is their union.
```ts
import { manifest } from '@keel/router'
export const routes = manifest({
  'orders.shell': { component: OrdersShell, layout: 'app.shell' },             // no path: a layout
  'orders.show': {
    path: '/orders/:id',
    params: OrderParams,                                 // s.object({ id: s.id('Order') }); loadOrder declares the same value
    search: OrderSearch,                                 // s.object({ tab: s.enum(['items', 'history']).optional() })
    loader: loadOrder,                                   // loader({ output, params, search }, fn), show.server.ts (k.server)
    actions: { POST: updateOrder, DELETE: removeOrder }, // action and loader come from @keel/router; k.server runs them over HTTP
    component: OrderPage, layout: 'orders.shell', guard: 'auth', errorElement: OrderError,
  },
})
```
Keys: `path`, `params` (required iff `path` has `:name`), `search` (every field optional), `loader`, `actions` keyed by `POST`/`PUT`/`PATCH`/`DELETE`, `component`, `layout`, `guard`, `errorElement`. An entry without `path` is a layout: its `component` renders a `children` slot. A route's chain is the route plus its layouts, outermost first. `component` receives `{ params, search, data }`, where `data` is its loader's `ok` value; `errorElement` receives `{ error: KeelError }`.

**Matching.** Segment by segment; a static segment beats `:param`; no wildcards. A trailing slash redirects (308) to the canonical path. Params that fail their schema: 404 with `keel.notFound`; no guard or loader runs. It renders in the nearest `errorElement` of the chain, inside the layouts above it when none of them declares a loader or guard, otherwise alone. Search keys that fail are dropped and the rest parsed.

**Links.** `href(id, params?, search?)` returns a branded `Href`. Params are encoded by schema then URL-encoded; search keys are sorted and absent optionals omitted. `Link to`, `navigate`, and URL attributes take `Href` only (E1501). `href` resolves `id` in the most recently declared manifest containing it; a router, its `Form`s, and guard redirects use only their own manifest. A manifest sees only its own entries: layouts are named within it (a deployable passes the union to its router).

**Guards.**
```ts
// modules/app/auth.guard.ts
export const auth = guard('auth', { redirect: 'app.login' }, async ({ url }, ctx) => ok(null))
```
A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect` with search `{ next: url }`.

**Execution.** Guards, loaders, and actions run on the server (k.server); client navigation fetches their results. In a client-only app (`mount`, golden app 1) the router runs the same functions in the browser.

**Client.** `navigate(href, { replace? })` pushes or replaces a history entry. `route()` is a computed of the current match `{ id, params, search, pending }`, discriminated by `id`; `pending` is true while a navigation or action is in flight, and the previous page stays rendered until the new chain's loaders finish. After a push: scroll to the top (or the hash target) and focus `main`, which gets `tabindex="-1"`. On back or forward, the entry's saved scroll position is restored. Revalidation changes neither scroll nor focus. Clicks on same-origin links inside the router navigate client-side.

**Form.** `<Form method action params? form? loading? error?>` from `@keel/router`; `action` is a route id. Without JS it posts natively (`PUT`/`PATCH`/`DELETE` via a hidden `_method`). With the runtime it submits FormData and applies the action's `Result` (k.forms): `ok(href)` navigates there; `ok(null)` revalidates, re-running every loader in the current chain once.

**Artifacts.** `routes.json` (k.compiler): `{ [routeId]: { path, params, search, actions, layout, guard, module } }`. `actions` lists methods; layouts have `path: null`.

**Rules.** E1501 string path where an `Href` is required · E1502 two routes with the same path pattern · E1503 `:name` in `path` without a `params` field, or the reverse · E1504 required field in a `search` schema · E1505 `actions` key or `<Form method>` that is not `POST`/`PUT`/`PATCH`/`DELETE`, or not declared on the target route · E1506 unknown `guard` or `layout` name, or a layout cycle · E1507 loader or action `params`/`search` typed by hand, or declared with a schema other than the route's; inferred from the route's schema (`manifest` throws for the latter).

**Conformance.**
- For every route and every generated `params` and `search`, `navigate(href(id, p, q))` makes `route()` equal `{ id, params: p, search: q, pending: false }`.
- `href` output is identical for equal inputs and omits absent optional search keys.
- A path whose params fail the schema yields 404 and calls no loader.
- `?tab=bogus&x=1` on `orders.show` yields `search` `{}`.
- A guard returning `err` redirects to its `redirect` route with `next`; no loader runs and the route component never renders.
- A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay rendered.
- After an `ok(null)` action, each loader in the current chain runs exactly once more; after `ok(href)`, `route().id` is the target's id.
- After a push navigation, `document.activeElement` is `main` and the scroll position is 0; back restores the previous entry's scroll position.
- Each of E1501-E1506 has a fixture that triggers it and a clean counterpart.
- A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`; `manifest` throws E1507 when the route's `params` is another schema value.
