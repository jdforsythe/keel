# RFC 0041: Guards by reference, manifest-typed `routes.href`, scroll keyed by history entry, `Image src` as an asset

Status: accepted

## Problem
Backlog 0044 (router PLAN D19, D20, D23; freeze review rows 1-2) and 0103.
- Guards are declared by name, `guard('auth', { redirect }, fn)`, and routes name them as strings (`guard: 'auth'`), resolved at navigation through a process-wide table (`guardTable`). The server adds a second registration path, `createApp({ guards })`. That makes two ways to reach a guard (principle 1). A route's behavior also depends on whichever module last registered that name (principle 2). An unknown name fails only at navigation.
- `href(id, params?, search?)` is a free function. Its `id` is `string` and resolves in the most recently declared manifest that contains it (a global map). Nothing is typed: an unknown id, a layout id, or wrong params fail at runtime or in `keel check`.
- Scroll positions are keyed by URL, so two history entries with the same URL share one position, and back cannot be told from forward.
- `Image src` is typed `Href`, so `<Image src="logo.png">` is a type error that `keel check` maps to E1501. The k.compiler URL policy says asset attributes take relative literals. k.router Links restates that policy instead of citing it.

## Proposal
1. **Guards by reference.** `guard({ redirect }, fn)` declares a guard, consistent with `loader({...}, fn)` and `action({...}, fn)` (RFC 0027): a declaration object, then `fn`, and no name. A route holds the value: `guard: auth` (`RouteDef.guard?: Guard`). `guardTable`, the name lookup, and `createApp({ guards })` are removed. The id that `routes.json` needs comes from the reference: the artifact's `guard` field is the guard's `redirect` route id, or `null`. E1506 keeps its number but covers less: an unknown `layout` name, a layout with a `path`, or a layout cycle. An unknown guard cannot be written, because a guard is a value and TypeScript reports a missing import.
2. **Manifest-typed `routes.href`.** `manifest()` returns `{ kind, routes, href }`. `routes.href(id, params?, search?)` is typed from the manifest: `id` is one of its keys whose entry has a `path`, `params` is required iff the route declares params and is `Infer` of that schema, and `search` is optional and typed by the route's search schema. Encoding is unchanged. `href` resolves only in its own manifest. The free `href` and its global `latest` lookup are removed. The `latest` map stays only so that a `Form` rendered outside any router (server rendering, native post) can find its `action` route; `Form`'s API does not change. `Link to` still takes an `Href`. A link into another module uses that module's `routes` (import of its `routes.ts`).
3. **Scroll keyed by history entry (D23).** `RouterHistory` becomes `push(url, key)`, `replace(url, key)`, `current()`, `onPop(fn(url, key?))`. The router mints a key per entry (`k1`, `k2`, ...), so no randomness is needed. The initial load stamps its entry with `replace(url, key)`. Before a push, pop, or replace commits, the router saves the scroll position of the entry it leaves. A pop restores the arriving entry's saved position, or 0 if it has no key or no saved position. A push goes to the top or to the hash target, as before. `browserHistory` keeps `{ keel: "<load nonce>:<key>" }` in `history.state`; an entry made before a reload pops without a key. Histories that never pop (`@keel/testing`, forms fixtures) may ignore the key.
4. **`Image src` is an asset (0103).** `Image src?: string`. Unsafe schemes still render `about:blank` (`safeUrl`). `keel check` no longer reports E1501 for `src="logo.png"`. k.router Links cites the k.compiler URL policy and no longer restates it.

Known TypeScript limit: an action in a module that the manifest imports, or one written inline in the manifest initializer, cannot `return ok(routes.href(...))`, because the return type would depend on `routes` (TS7022). The fix is to bind first: `const to: Href = routes.href(...); return ok(to)`. The keel skills teach this. Components are not affected, because JSX bodies are checked lazily.

## Alternatives
- `guard({ id, redirect, run })` with an explicit id. It adds a second name next to the export name and brings back name collisions. Loaders and actions in RFC 0027 carry no id either.
- Keeping the free `href` with codegen-typed ids (D19 follow-up). That needs a generated `Register` type, which is a global and action at a distance (principle 2). Keeping both the free form and `routes.href` would be two ways.
- A `key()` getter on `RouterHistory`, or history-minted keys. Every existing in-memory history (forms conformance, `@keel/testing`) would have to implement it. With keys passed through `push`/`replace`, those histories stay valid.
- Keys from `ctx.random.uuid()`. They would consume the sim random stream and shift seeded app ids in tests.
- Typing `Image src` as `Href | Asset` with a branded `asset()`. That is a second minting API for plain relative strings, which the URL policy already allows.

## Spec diff
k.router: the Manifest example uses `guard: auth` and its comment padding is trimmed. Links: `routes.href` typed from the manifest; `Link to` and `navigate` take `Href`; other URL attributes cite the k.compiler URL policy; the free-`href` resolution sentence is dropped. Guards: `guard({ redirect }, fn)`, "Routes hold the value, not a name". Execution is shortened. Client: scroll is saved per history entry. Artifacts: `guard` is the guard's `redirect`. Rules: E1506 narrowed. Conformance: `routes.href` in the round-trip and determinism bullets, the type-level rejection of layout ids and missing or mistyped params, and back and forward restoring per entry, including two entries with the same URL. k.ui Base elements: `Image src` is an asset URL string. Conformance +1 (Image src string; `javascript:` renders as `about:blank`). k.server's example `ok(href('orders.show', params))` needs `routes.href` with the binding; that section is owned elsewhere (proposal below).

## Conformance diff
Router, migrated: `fixtures.ts` (guards by value; `routes.href`; an in-memory history that keeps entry keys and delivers them on back and forward), and every suite that imported `href`. `rules-e1501-e1506` loses the unknown-guard case and keeps unknown layout. `href-deterministic` gains type-level rejections. `push-focus-scroll` gains per-entry back/forward restore with a `scrollTo`/`scrollY` stub, two entries sharing one URL. UI: an `Image src` asset string test. Server `fixtures.ts`: `guard({ redirect }, fn)`, `guard: auth`, no `guards`, `href: routes.href`. Testing `ui-fixtures.ts`: `routes.href`.

## Migration
- `guard('name', { redirect }, fn)` becomes `guard({ redirect }, fn)`; `guard: 'name'` and `guard: g.name` become `guard: g`; remove `createApp({ guards })`.
- `href(id, p, q)` becomes `routes.href(id, p, q)`, with `routes` imported from the owning module's `routes.ts`. In actions, bind `const to: Href = routes.href(...)` before `ok(to)`.
- A custom `RouterHistory` stores the `key` passed to `push`/`replace` and passes it to `onPop` listeners.
- Done in this RFC: apps/golden-1 (`editable.guard.ts`, `routes.ts`, `AppShell`, `ListsPage`, `ListPage`, `ListError`, `TodoRow`, `updateTodo.server.ts`); server `runGuards`/`Served`/`AppOptions`/`createApp`/`handle` (one line each) and tests; `@keel/testing` `renderRoute` and tests; router tests; the keel and keel-api skills; the router README.
- Proposals for owners elsewhere: `@keel/check` `scanFile` collects `<binding>.href('<id>'` (where the binding is imported from a `routes.ts`, or is the local `manifest()` const) instead of `href('<id>'` imported from `@keel/router`. Its E1501/E1506 explanations and its `mapTsDiagnostic` fix text say `routes.href`, and E1506 drops "guard". The `@keel/compiler` `ruleUrlLiteral` message says "use routes.href(routeId, params)". `@keel/scaffold` `opRename` rewrites the first string argument of `.href(` calls. k.server's example changes as above.

## Token impact
k.router 1449 -> 1477; k.ui 1068 -> 1117. Both are within 1,500.
