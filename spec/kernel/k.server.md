# k.server: Thin server
status: conformance-covered

**API.** App code imports only `topology` and `commitStores` (k.persist) from `@keel/server` (a test also imports `createApp`); `loader`/`action` (`@keel/router`) run over HTTP.
- `loader(contract, id, { output?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, user, bearer, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>` encoded with `output` (the entry's on an API entry, k.contract).
- `action(contract, id, { input?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, user, stores, routes }` and `ctx`, `routes` the route table it is served from (k.router Return targets); returns `Result<Href | null, KeelError>` on a page (an API entry's `output` on one: k.api); the binding places it (k.contract).
- A loader's `run(args, ctx)` and an action's `run(input, args, ctx)` call `fn` directly, outside a request (tests). `args.url` is the absolute request URL as a string. `args.stores` is optional: absent, `fn` gets the value the declared factory returns for `ctx` (Server state), `undefined` without one; `run` saves nothing. An action's `args.routes` is optional: absent, `fn` gets `routeTable()`, a table with no pages.
- Only an `events: true` entry's loader is live (E1515, E1558), `fn` an async generator: a JSON GET takes its first yield, event-stream GET all; args add `signal` and `currentUser` (k.user).

**Server state.** `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; `fn` gets `S`. A request holds one live store per id (k.store Registries), so the loaders of one route chain share a store by naming one factory; two factories they name that create one id are E1550. An action's `ok` saves its changed stores unless another request saved any of the factory's since (409 `keel.conflict`), in one `commit`; `err` or a throw saves none; saves reach `observe` (k.sync). `caller` is the base64url SHA-256 of the cookie token, HMAC-signed with `createApp({ secret })` (<32 bytes: E1556; default per process, W1556 in production); `tx` meta `{ caller }` scopes `undoWhere`. Factory stores skip `#k-state` and inspect; server code never writes module stores; client routers refuse `stores`.

**Request flow.** Match routes -> parse params (fail: 404), search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`; past `createApp({ maxStreams })` (default 1,000) open streams 503 `keel.busy` (`data: { limit }`); else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). Other routes: 406.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin` or an allowed one (k.hosting), `accept: application/json` with `x-keel: 1`, or neither; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is `keel.payloadTooLarge` (`data: { limit }`). Then decode FormData or JSON (empty: `{}`) by `input` (fail: `keel.fields`), run it, 303 to the target (document; one no `Href` (k.router Links) is 500 with no `Location`) or `Result` JSON (runtime).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · `keel.unreachable` 502 (names no host) · `keel.busy` 503 · other `err` 400 · uncaught throw 500 `keel.unexpected` (production: message `unexpected`). `mode` defaults to `production`. `#k-state` stores: k.leave.

**Document.** Each route level is a candidate island root by route id. Head, `<html lang>`, the `keel.notFound` alert: k.head. Headers, policy, caller cookie, `/__keel/csp`: k.security.

**Build.** k.deploy, k.topology.

**Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (personal data dropped, k.privacy; a throw's `frames`: k.deploy), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line. A throw past the handler's guards (a throwing `log.write`) is a bare 500 and one fixed `keel.unexpected` `diag` naming the matched route id, if any; if that write throws, one fixed stderr line, once per process. Neither holds a thrown or request value.

**Rules.** E1550 two `stores` factories the loaders of one route chain (its layouts' and its page's) name create one store id: `keel check` at the deeper loader's `stores` value, naming both factories, the id and the other route id, reading a factory as E1558 reads a loader `fn` (a top-level function or `const`, or an import of one; its ids the literal `id` of each `store` call in its body and in each factory it calls); one it cannot read is not judged there; `keel build` and `createApp` run each factory once on a sim ctx (k.compat Surface) and refuse it (`createApp` throws) · E1551 `loader`/`action` outside `*.server.ts` · E1554 loader or action data fails its output schema (dev diag; production 500) · E1558 (k.topology).

**Conformance.**
- A GET with params that fail the params schema returns 404 and calls no loader.
- All loaders of a matched chain start before any of them resolves.
- A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
- A POST with invalid FormData or JSON (empty JSON too) returns 422, does not call the action, and lists the field errors.
- For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
- An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame.
- The dev log stream emits exactly one `req` record per request; in json mode every line parses.
- A JSON or FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action.
- A loader's `url` is the absolute URL of the request it serves.
- Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`. A conflicting or `err` action and an unchanged store save nothing.
- `caller` is the hash of a server-signed cookie token, else of a fresh one set as a cookie on a write, else `""`.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a JSON GET answers `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.
- With `maxStreams: 2`, a third open event-stream GET is 503 `keel.busy` and runs no loader; once one closes, the next is served.
- With a `client` and a `node` deployable in dev, the `node` one's island document scripts `/@keel/entry.ts?d=<name>`, which resumes its islands.
- A `log.write` that throws on the `req` record gives a 500 and one `keel.unexpected` `diag` naming the route id; one that always throws gives one fixed stderr line per process.
- A loader without `stores`, called as `run({ params, search, url, caller }, ctx)`, compiles and its `fn` gets `stores` `undefined`; one declaring `stores: f`, called so, gets the value `f(ctx)` returns; an action alike, and after one whose `fn` runs a transaction on its stores, `ctx.storage` is unchanged.
- A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id, and `createApp` throws E1550; with both loaders naming `a`, neither, and a GET of the page answers 200 with `a` run once.
