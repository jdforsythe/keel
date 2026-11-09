# k.router: Routes
status: conformance-covered

**Manifest.** One per module, in `routes.ts`; a deployable's route table is their union.
```ts
export const routes = manifest({
  'orders.show': {
    path: '/orders/:id',
    params: OrderParams, search: OrderSearch,
    loader: loadOrder,
    component: OrderPage, guard: auth, errorElement: OrderError,
  },
})
routes.actions({ 'orders.show': { POST: updateOrder } })
```
`routes.actions`, a statement after the manifest, attaches path routes' actions once each. An entry without `path` is a layout: its `component` renders a `children` slot. A route's chain is the route plus its layouts, outermost first. `component` receives `{ params, search, data }`, where `data` is its loader's `ok` value; `errorElement` receives `{ error: KeelError }`.

**Matching.** Segment by segment; static beats `:param`; no wildcards. A trailing slash redirects (308) to the canonical path. Params that fail their schema: 404 with `keel.notFound`; no guard or loader runs. It renders in the chain's nearest `errorElement`, inside the layouts above it unless one declares a loader or guard (then alone). Failing search keys are dropped; the rest parse.

**Links.** `routes.href(id, params?, search?)` returns a branded `Href`: `id` is a path route of that manifest; `params` (required iff declared) and `search` are typed by its schemas. Params are encoded by schema then URL-encoded; search keys are sorted and absent optionals omitted. `Link to`, `navigate`, and `Form action` take `Href` only; other URL attributes follow the k.compiler URL policy. `routes.href`, a router, and guard redirects resolve ids only in their own manifest.

**Guards.**
```ts
export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))
```
Routes hold the value (`guard: auth`). `caller` is k.server's `caller` (`''` if none or client-only). A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect` with search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested).

**Execution.** Guards, loaders, and actions run on the server (client navigation fetches results), or in the browser in a client-only app. API: `@keel/router`; `@keel/router/match`: `matchHref(routes, href)` matches as navigation does: `{ id, params, search }` or `null`; `@keel/router/internal` is not public.

**Client.** `navigate(href, { replace? })` pushes or replaces a history entry. `route()` is a computed of the match `{ id, params, search, pending }`, discriminated by `id`; `pending` is true while a navigation or action is in flight; the previous page stays rendered until the new chain's loaders finish. After a push: scroll to the top (or the hash target) and focus `main` (`tabindex="-1"`). Back or forward restores each history entry's scroll. Revalidation changes neither scroll nor focus. Same-origin link clicks inside the router navigate client-side.

**Form.** `<Form method action form? error?>`; `action` is an `Href`. Without JS it posts natively (`PUT`/`PATCH`/`DELETE` via a hidden `_method`). Inside a router it submits FormData to the matched route's action and applies its `Result`: `ok(href)` navigates; `ok(null)` re-runs every loader in the current chain once.

**Artifacts.** `routes.json`: `{ [routeId]: { path, params, search, actions, layout, guard, module } }`. `actions` lists methods; `guard` is the guard's `redirect`; layouts have `path: null`.

**Rules.** E1501 string path where an `Href` is required · E1502 two routes with the same path pattern · E1503 `:name` in `path` without a `params` field, or the reverse · E1504 required field in a `search` schema · E1505 `actions` in an entry, or a `routes.actions` key or `<Form method>` not `POST`/`PUT`/`PATCH`/`DELETE` or not on the target route · E1506 unknown `layout` name, a layout with a `path`, or a layout cycle · E1507 loader or action `params`/`search` typed by hand, or declared with another schema than the route's (that throws) · E1508 a guard's literal `redirect` route is under that guard, or (runtime) a guard redirect loop.

**Conformance.**
- For every route and generated `p`, `q`, `navigate(routes.href(id, p, q))` makes `route()` equal `{ id, params: p, search: q, pending: false }`.
- `routes.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile.
- A path whose params fail the schema yields 404 and calls no loader.
- `?tab=bogus&x=1` on `orders.show` yields `search` `{}`.
- A guard returning `err` redirects to its `redirect` route with `next`; no loader or route component runs.
- A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay.
- After an `ok(null)` action, each loader in the current chain runs exactly once more; after `ok(href)`, `route().id` is the target's id.
- After a push, `document.activeElement` is `main` and scroll is 0; back and forward restore each entry's position, also for two entries with one URL.
- E1501-E1506 each have a triggering fixture and a clean one.
- Outside any router a `Form` renders `action` unchanged and lets submit through; inside one, an `action` route lacking `method` throws E1505.
- A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`; `manifest` throws E1507 for another schema value.
- A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`.
- An action returning `ok(routes.href(id))` compiles unannotated and navigates to `id`; an entry with `actions` throws E1505.
- A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`).
- `matchHref(routes, routes.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`.
