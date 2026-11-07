# k.server: Thin server
status: conformance-covered

**API.** Apps import only `topology` from `@keel/server`; `loader` and `action` (`@keel/router`) run over HTTP.
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>`, data encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }` and `ctx`; returns `Result<Href | null, KeelError>`.
- `params`/`search` are `Infer` of the declared schemas (else `unknown`), the route's own (E1507); `fn` is never annotated. `url` is the absolute request URL.

**Server state** (rfc:0044, 0054, 0057, 0060). `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once; its stores restore from `ctx.storage` `keel.store.<id>`; `fn` gets that `S`. An action's `ok` saves the changed stores, none if another request saved any of the factory's since (409 `keel.conflict`); `err` or a throw saves none. `caller` is the base64url SHA-256 of the cookie token if HMAC-signed with `createApp({ secret })` (<32 bytes: E1556; default per process, W1556 in production), else of one minted on a write, else `""`; `tx` meta `{ caller }` scopes `undoWhere`. The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, `Secure` on https (`createApp({ secure })`; default the URL's or `x-forwarded-proto`, W1557 in production), else `keel-caller`. Factory stores skip `#k-state` and inspect; server code never writes module stores; the client router refuses `stores`.

**Request flow.** Match the route table -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is 413 `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData or JSON by the action's input schema (fail: `keel.fields`, action not called), run it, then 303 to the target (document request) or the `Result` as JSON (runtime).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 `keel.unexpected` (production: message `unexpected`, no stack). `mode` defaults to `production`. `#k-state` holds every store created in the request scope.

**Document.** Each route level is a candidate island root by route id.

**Topology.** `topology.ts` default-exports `topology({ <name>: { modules, adapter } })`.
Adapters: `node` (Hono; serves the resume entry), `static` (prerendered HTML), `client` (loaders and actions run in the browser; the entry calls `mount(App, el)` with a real `ctx`). A deployable's modules share a process; calls between deployables are stdlib.

**Build** (rfc:0048, 0052, 0057). `keel build` bundles each `node` deployable's entry and islands into `dist/<name>/` with `.vite/manifest.json`. Production `createApp({ assets: 'dist/<name>' })` loads it at startup, scripts its entry, serves `/assets/*` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag); dev, or no `assets` in development or test, serves `/@keel/entry.ts`.

**Dev server.** `keel dev`: Vite and Hono, one process, HMR, real `ctx`. Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (app frames only, max 5), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` writes a line per `write`.

**Rules.** E1551 `loader` or `action` outside a `*.server.ts` (any deployable) · E1552 topology names an unknown module or one module in two deployables · E1553 `static` deployable route with params or actions · E1554 loader data fails its output schema (dev diag; 500 in production) · E1555 production `assets` without a manifest entry, or none outside `NODE_ENV` `development`/`test`.

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
- `caller` is the hash of a server-signed cookie token, else of a fresh one set as a cookie on a write, else `""`.
- On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
