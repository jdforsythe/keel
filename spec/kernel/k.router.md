# k.router: Routes
status: implemented

**Manifest.** One per module, in `routes.ts`, binding the module's contract (k.contract); a deployable's route table is their union (k.routes).
```ts
export const routes = manifest(orders, {
  'orders.show': { component: OrderPage, loader: loadOrder, guard: auth, POST: updateOrder },
})
```
A layout's `component` renders a `children` slot; an API entry has no view (k.api). A chain is the route and its layouts, outermost first. `component` receives `{ params, search, data }` and a ctx: in a browser the router's, on the server the `createApp({ ctx })` object itself, the one its loaders get; `data` being its loader's `ok` value; `search` and `data` are getters that revalidation and a kept page update in place (a top-level read keeps the value at build, k.component); `errorElement` receives `{ error: KeelError }`. A page's `title` names its document (k.head).

**Matching.** Segment by segment; static beats `:param`; no wildcards; k.prefix elides a leading param. A trailing slash is a 308 to the canonical path. Params that fail their schema: 404 `keel.notFound`, no guard or loader run, in the chain's nearest `errorElement`, inside the layouts above it unless one declares a loader or guard (then alone). Failing search keys drop; the rest parse.

**Links.** A contract's `href(id, params?, search?)` returns a branded `Href` to its page `id`, `params` (required iff declared) and `search` typed by its schemas. Params are encoded by schema then URL-encoded, one segment each (`''` throws E1503); search keys are sorted and absent optionals omitted. An `Href` starts with one `/` and holds no `\`, control character or `#`. `Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops. Other URL attributes: k.compiler. A contract's `href`, a router, and guard redirects resolve ids only in their own module. A string becomes an `Href` only through a contract's `href`, an identity mount's `href` (k.mount) or `pageHref` (Return targets).

**Return targets.** `pageHref(routes, text)` (`@keel/router/match`) reads a string, such as the `next` a guard redirect carries (k.guards), into an `Href` of a page of route table `routes`: `Result<Href, KeelError<'keel.notFound', null>>`, message `not a page`. It refuses `text` that:
- is longer than 2,048 characters, or does not start with exactly one `/` (an absolute URL, `//host`, a relative path, `''`);
- holds a `\` or a control character (C0, DEL or C1) anywhere;
- holds `%2F` or `%5C`, in either case, before its first `?` or `#`, or a path segment that is `.` or `..` once percent-decoded;
- names no page of `routes` as `matchHref` matches: an API entry's path, the identity mount's, a path no contract declares, params that fail their schema;
- names a page that is the `redirect` route of a guard in `routes`: a return to the page a guard sends the person to would loop.

Otherwise it is `ok` of the `Href` the page's contract's `href(id, params, search)` gives for `matchHref`'s match: the path re-encoded, the search keys the page's schema declares and parses kept, sorted, every other key and the hash dropped. The answer is built from the match, never copied from `text`, so it names a page of the app's own origin. An action's args carry `routes`, the table it is served from (k.server), and an identity source's `handle.fn` gets it as its third argument (k.user). A deployable is served at its origin's root, so an `Href` carries no base path. `matchHref` is the navigation matcher and returns no `Href`.

**Execution.** Guards (k.guards), loaders and actions run on the server, or in a client-only app's browser. API: `@keel/router`; `@keel/router/match`: `matchHref(routes, href)` is `{ id, params, search }` as navigation matches, or `null`, and `pageHref` (Return targets); `@keel/router/internal` is not public.

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
- Over table `t`, module `shop`'s manifest with pages `shop.list` (`/list`, search `s.object({ tab: s.enum(['a', 'b']).optional() })`, `POST: a`, `a` an action whose `fn` records the `routes` it gets and returns `ok(null)`), `shop.item` (`/items/:id`, params `s.object({ id: s.int({ min: 1 }) })`, guard `g` with `redirect: 'shop.signin'`) and `shop.signin` (`/signin`, search `s.object({ next: s.string().optional() })`), and API entry `shop.items` (`/api/items`, `GET`): `pageHref(t, x)` is `ok('/list')` for each `x` of `'/list'`, `'/list/'`, `'/list?tab=zzz'`, `'/list?x=1#top'` and `'/list?p='` followed by 2,040 `a` characters (2,048 in all); `ok('/list?tab=b')` for `'/list?x=1&tab=b#top'`; `ok('/items/7')` for `'/items/7'`; each `ok` value equals `shop.href` of the same id, params and search.
- Over `t` as above, `pageHref(t, x)` is `err` with code `keel.notFound`, message `not a page` and data `null` for each `x` of these JavaScript string literals: `''`, `'list'`, `' /list'`, `'https://evil.example/list'`, `'javascript:alert(1)'`, `'//evil.example/list'`, `'/\\evil.example/list'`, `'/list\\'`, `'/\t/evil.example/list'`, `'/list\n'`, `'/list\u007f'`, `'/list\u0085'`, `'/%2F%2Fevil.example'`, `'/%2f%2fevil.example'`, `'/items/1%2F2'`, `'/items/%5C7'`, `'/list/../items/7'`, `'/items/%2E%2E'`, `'/api/items'`, `'/nowhere'`, `'/items/0'`, `'/items/x'`, `'/signin'`, `'/signin?next=%2Flist'`, and `'/list?p='` followed by 2,041 `a` characters (2,049 in all).
- Over `t` as above, under `createRouter(t, { ctx, history })` a `Form` submit to `shop.list` runs `a` with `routes` `t` itself (`===`); `a.run(input, args, ctx)` with no `routes` in `args` gives `fn` a route table on which `pageHref(routes, '/list')` is `err` `keel.notFound`.
- Over `t` as above, `createApp({ routes: t, ctx, identity })` runs `a` on a POST to `/list` with `routes` `===` `t`. With `identity` `identity({ identify: async () => '', handle: { path: '/auth', fn } })`, a POST to `/auth/in` calls `fn(request, ctx, { routes })` with `routes` `===` `t`. A `fn` answering 303 with `location` the `ok` value of `pageHref(routes, next)` (`next` the request's `next` search value, `''` without one), else `'/list'`, answers `location: /items/7` for `/auth/in?next=%2Fitems%2F7`, and `location: /list` for `/auth/in?next=%2F%09%2Fevil.example`, `/auth/in?next=https%3A%2F%2Fevil.example`, `/auth/in?next=%2Fsignin` and `/auth/in`.
