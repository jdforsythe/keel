# k.router: Routes
status: conformance-covered

**Manifest.** Each module's `routes.ts` (k.module) exports one manifest; a deployable's route table is their union.
```ts
import { manifest } from '@keel/router'
export const routes = manifest({
  'orders.shell': { component: OrdersShell, layout: 'app.shell' }, // no path: a layout
  'orders.show': {
    path: '/orders/:id',
    params: OrderParams, // s.object({ id: s.id('Order') })
    search: OrderSearch, // s.object({ tab: s.enum(['items', 'history']).optional() })
    loader: loadOrder, // loader({ output, params, search }, fn) (k.server)
    actions: { POST: updateOrder, DELETE: removeOrder }, // action, loader, guard: @keel/router
    component: OrderPage, layout: 'orders.shell', guard: auth, errorElement: OrderError,
  },
})
```
An entry without `path` is a layout: its `component` renders a `children` slot. A route's chain is the route plus its layouts, outermost first. `component` receives `{ params, search, data }`, where `data` is its loader's `ok` value; `errorElement` receives `{ error: KeelError }`.

**Matching.** Segment by segment; a static segment beats `:param`; no wildcards. A trailing slash redirects (308) to the canonical path. Params that fail their schema: 404 with `keel.notFound`; no guard or loader runs. It renders in the chain's nearest `errorElement`, inside the layouts above it unless one declares a loader or guard (then alone). Search keys that fail are dropped and the rest parsed.

**Links.** `routes.href(id, params?, search?)` returns a branded `Href`: `id` is a route of that manifest with a `path`; `params` (required iff declared) and `search` are typed by its schemas. Params are encoded by schema then URL-encoded; search keys are sorted and absent optionals omitted. `Link to`, `navigate`, and `Form action` take `Href` only; other URL attributes follow the k.compiler URL policy. `routes.href`, a router, and guard redirects resolve ids only in their own manifest (a deployable's router gets their union).

**Guards.**
```ts
// modules/app/auth.guard.ts
export const auth = guard({ redirect: 'app.login' }, async ({ url }, ctx) => ok(null))
```
Routes hold the value (`guard: auth`), not a name. A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect` with search `{ next: url }`.

**Execution.** Guards, loaders, and actions run on the server (k.server); client navigation fetches their results; in a client-only app (`mount`) the router runs them in the browser. Server-only internals are in `@keel/router/internal` (not public API).

**Client.** `navigate(href, { replace? })` pushes or replaces a history entry. `route()` is a computed of the current match `{ id, params, search, pending }`, discriminated by `id`; `pending` is true while a navigation or action is in flight (a form's own is `f.pending()`, k.forms), and the previous page stays rendered until the new chain's loaders finish. After a push: scroll to the top (or the hash target) and focus `main`, which gets `tabindex="-1"`. Scroll is saved per history entry (a router-minted key `RouterHistory` keeps); back or forward restores that entry's. Revalidation changes neither scroll nor focus. Clicks on same-origin links inside the router navigate client-side.

**Form.** `<Form method action form? error?>` from `@keel/router`; `action` is an `Href`. Without JS it posts natively (`PUT`/`PATCH`/`DELETE` via a hidden `_method`). Inside a router it submits FormData to the action of the route `action` matches and applies its `Result` (k.forms): `ok(href)` navigates there; `ok(null)` revalidates, re-running every loader in the current chain once.

**Artifacts.** `routes.json` (k.compiler): `{ [routeId]: { path, params, search, actions, layout, guard, module } }`. `actions` lists methods; `guard` is the guard's `redirect`; layouts have `path: null`.

**Rules.** E1501 string path where an `Href` is required · E1502 two routes with the same path pattern · E1503 `:name` in `path` without a `params` field, or the reverse · E1504 required field in a `search` schema · E1505 `actions` key or `<Form method>` that is not `POST`/`PUT`/`PATCH`/`DELETE`, or not declared on the target route · E1506 unknown `layout` name, a layout with a `path`, or a layout cycle · E1507 loader or action `params`/`search` typed by hand, or declared with another schema than the route's (`manifest` throws for the latter).

**Conformance.**
- For every route and every generated `params` and `search`, `navigate(routes.href(id, p, q))` makes `route()` equal `{ id, params: p, search: q, pending: false }`.
- `routes.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile.
- A path whose params fail the schema yields 404 and calls no loader.
- `?tab=bogus&x=1` on `orders.show` yields `search` `{}`.
- A guard returning `err` redirects to its `redirect` route with `next`; no loader runs and the route component never renders.
- A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay rendered.
- After an `ok(null)` action, each loader in the current chain runs exactly once more; after `ok(href)`, `route().id` is the target's id.
- After a push navigation, `document.activeElement` is `main` and the scroll position is 0; back and forward restore each entry's own position, also for two entries with one URL.
- Each of E1501-E1506 has a fixture that triggers it and a clean counterpart.
- Outside any router a `Form` renders `action` unchanged and does not intercept submit; inside one, an `action` whose matched route lacks `method` throws E1505.
- A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`; `manifest` throws E1507 when the route's `params` is another schema value.
