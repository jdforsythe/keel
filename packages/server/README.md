# @keel/server

**Spec:** k.server · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `topology(def)` (app code uses only this) · `createApp({ topology, routes, ctx, mode?, deployable?, guards?, log?, artifacts?, inspect? }) -> Promise<{ fetch(req) }>` (generated entry, `keel dev`; Hono) · types `AppOptions`, `ServerApp`, `LogSink`, `Topology` (re-exported from `@keel/compiler`, its one definition; RFC 0046). A GET of `/@keel/entry.ts` answers the generated resume entry a document with islands loads (RFC 0046). Loaders and actions get `url`, the absolute request URL (RFC 0027), `caller`, and `stores` (RFC 0044).
- **Invariants:** `topology` throws E1552 for a bad shape or empty `modules`. `createApp` rejects with E1552 (unknown module, module in two deployables, no `deployable` among several) or E1553 (`static` with params or actions). Flow mirrors k.router (404, 308, guards then concurrent loaders; deny 302/303 with `?next=`). Status: notFound 404, denied 403, fields 422, unexpected 500, other 400. Writes (POST/PUT/PATCH/DELETE) must be same-site (`Sec-Fetch-Site` same-origin/none, own `Origin`, `accept: application/json` + `x-keel: 1`, or neither header), else 403 `keel.denied`. Actions by verb or a POST's `_method`; submitted values drop `__proto__`, `constructor`, `prototype`; a `content-type: application/json` body (k.services client) is parsed with the action input instead of FormData; bad FormData or JSON 422, action not run; documents get 303, `accept: application/json` the `Result`. `mode` defaults to `production`, which scrubs `keel.unexpected` to `unexpected`; dev adds a panel. Documents hold one `#k-state` `{ stores, islands, form? }`; element roots get `data-k-island`. `log` gets one `req` per request after any `diag` (E1554). In `dev`, `GET /__keel/inspect` returns `{ live: true, graph: inspect(), stores: { [id]: { state, log } }, ids, a11y, routes }` (artifacts read from the `artifacts` dir per request, `{}` without it), only for a loopback or `inspect.origins`-listed host and an absent, own, or listed `Origin` (listed ones echoed for CORS; others 403 `keel.denied`); production: route-table 404.
- **Dependencies:** `hono`, `@keel/schema`, `@keel/router`, `@keel/store`, `@keel/reactive`, `@keel/ctx`.
- **Rungs:** conformance; properties (seed 1337): status by code, FormData round trip, topology round trip, one `req` per request.
- **Scope:** string renderer (string, or a DOM node serialized); server-mode compile, streaming and `<!--[-->` regions are later work.

## Server state

Server state is per request (RFC 0044, k.server Server state): a loader or action names a factory with `stores`; the server runs it once per request in an isolated child scope of the request scope (`openStores`), restores each store from `ctx.storage` `keel.store.<id>` (`snapshot({ meta: true })` JSON) through the deployable's write-through in-process copy (`Served.saved`), and after an action's `ok` saves the changed ones (`saveStores`), or answers 409 `keel.conflict` when another request saved one since this request restored it. `err` or a throw saves nothing and drops the instances, so a re-render reads storage. Factory stores need explicit ids (a default `store.<n>` id throws). `#k-state` snapshots only the request registry (stores created while rendering); module-level stores are process-wide and never written by server code. The caller: a write without a well-formed `keel-caller` cookie gets one minted with `ctx.random.id("Caller")` and set `Path=/; HttpOnly; SameSite=Lax` (`Secure` over https); a cookieless read gets `""`; apps record it as `tx` meta and undo with `undoWhere`. Action results, 303/302 redirects, and 403 refusals send `cache-control: no-store`.

## Extension points

`guards`: route `guard` names resolve here, then in the router registry. `inspect.origins`: extra origins the dev inspect endpoint answers. `LogSink`: any `{ format, write(line) }`.

## Unsafe

count: 0
