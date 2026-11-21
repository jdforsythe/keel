# k.router: Routes
status: conformance-covered

**Manifest.** One per module, in `routes.ts`, binding the module's contract (k.contract); a deployable's route table is their union (k.routes).
```ts
export const routes = manifest(orders, {
  'orders.show': { component: OrderPage, loader: loadOrder, guard: auth, POST: updateOrder },
})
```
A layout's `component` renders a `children` slot; an API entry has no view (k.api). A chain is the route and its layouts, outermost first. `component` receives `{ params, search, data }` and a ctx: in a browser the router's, on the server the `createApp({ ctx })` object itself, the one its loaders get; `data` being its loader's `ok` value; `search` and `data` are getters that revalidation and a kept page update in place (a top-level read keeps the value at build, k.component); `errorElement` receives `{ error: KeelError }`. A page's `title` names its document (k.head).

**Matching.** Segment by segment; static beats `:param`; no wildcards; k.prefix elides a leading param. A trailing slash is a 308 to the canonical path. Params that fail their schema: 404 `keel.notFound`, no guard or loader run, in the chain's nearest `errorElement`, inside the layouts above it unless one declares a loader or guard (then alone). Failing search keys drop; the rest parse.

**Links.** A contract's `href(id, params?, search?)` returns a branded `Href` to its page `id`, `params` (required iff declared) and `search` typed by its schemas. Params are encoded by schema then URL-encoded, one segment each (`''` throws E1503); search keys are sorted and absent optionals omitted. An `Href` starts with one `/` and holds no `\`, control character or `#`. `Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops. Other URL attributes: k.compiler. A contract's `href`, a router, and guard redirects resolve ids only in their own module.

**Execution.** Guards (k.guards), loaders and actions run on the server, or in a client-only app's browser. API: `@keel/router`; `@keel/router/match`: `matchHref(routes, href)` is `{ id, params, search }` as navigation matches, or `null`; `@keel/router/internal` is not public.

**Client.** `navigate(href, { replace? })` pushes or replaces a history entry of the router whose `App` encloses the caller, else of the only one mounted; else nothing. `route()` is a computed `{ id, params, search, pending }` discriminated by `id`; `pending` is true while a navigation or action runs; the previous page stays rendered until the new chain's loaders finish, and the last navigation started wins. A navigation changing only the search or hash keeps the page (no node rebuilt) if its guards and loaders succeed, else renders anew. Focus and scroll: k.head. `createRouter(routes, { ctx, history, mode? })` takes `mount`'s `mode`; unless `'dev'`, a `keel.unexpected` it renders or gives an `errorElement` or `Form` has message `unexpected` and data `{}`.

**Form.** `<Form method action form? error?>`. Without JS it posts natively (`PUT`/`PATCH`/`DELETE` via a hidden `_method`). Inside a router it submits FormData to its route's action and applies the `Result`: `ok(href)` navigates; `ok(null)` re-runs every loader in the current chain once.

**Artifacts.** In `routes.json` (k.compiler), `actions` lists a page's bound verbs or an API entry's `method`; `guard` is the guard's `redirect`; layouts have `path: null`.

**Rules.** E1501 string path where an `Href` is required · E1502 two routes with the same path pattern · E1503 `:name` in a contract entry's `path` without a `params` field, or the reverse · E1504 required field in a page's `search` schema (an API entry's `query` may require one) · E1505 a `<Form method>` not `POST`/`PUT`/`PATCH`/`DELETE`, or with no action for it on the target page · E1506 unknown `layout` id or a layout cycle (k.routes).

**Conformance.**
- For every route and generated `p`, `q`, `navigate(c.href(id, p, q))` makes `route()` equal `{ id, params: p, search: q, pending: false }`.
- `c.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile.
- A path whose params fail the schema yields 404 and calls no loader.
- `?tab=bogus&x=1` on `orders.show` yields `search` `{}`.
- A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay.
- A thrown page or loader gives an `errorElement`, and the default alert, message `unexpected` and data `{}`; with `mode: 'dev'`, its message.
- After an `ok(null)` action, each loader in the current chain runs exactly once more; after `ok(href)`, `route().id` is the target's id.
- E1501-E1506 each have a triggering fixture and a clean one.
- Outside any router a `Form` renders `action` unchanged and lets submit through; inside one, an `action` route lacking `method` throws E1505.
- A loader of an entry with `params: P` gives `fn` `params` of type `Infer<typeof P>`.
- An action returning `ok(c.href(id))` compiles unannotated and navigates to `id`.
- `matchHref(routes, c.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`.
- After an `ok(null)` action, a binding reading `props.data` shows the new value and the page keeps its nodes and focus.
- After a search-only navigation each guard and loader of the chain ran once more and the page keeps its nodes, focus and local signals, and its `props.search` and `props.data` bindings update; a loader `err` renders the `errorElement`, a params change a new page.
- Of two navigations started before either settles, the later one's page shows in either settle order.
- On the server a page component and its loader get the `createApp({ ctx })` object itself (`===`), on every request.
