# @keel/server

**Spec:** k.server · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `topology(def)` (app code uses only this) · `createApp({ topology, routes, ctx, mode?, deployable?, guards?, expose?, log?, artifacts? }) -> Promise<{ fetch(req) }>` (generated entry, `keel dev`; Hono) · types `AppOptions`, `ServerApp`, `LogSink`, `Topology`, `TopologySchema`.
- **Invariants:** `topology` throws E1552 for a bad shape or empty `modules`. `createApp` rejects with E1552 (unknown module, module in two deployables, no `deployable` among several) or E1553 (`static` with params or actions). Flow mirrors k.router (404, 308, guards then concurrent loaders; deny 302/303 with `?next=`). Status: notFound 404, denied 403, fields 422, unexpected 500, other 400. Actions by verb or `_method`; a `content-type: application/json` body (k.services client) is parsed with the action input instead of FormData; bad FormData or JSON 422, action not run; documents get 303, `accept: application/json` the `Result`. Production scrubs `keel.unexpected` to `unexpected`; dev adds a panel. Documents hold one `#k-state` `{ stores, islands, form? }`; element roots get `data-k-island`. `log` gets one `req` per request after any `diag` (E1554). In `dev`, `GET /__keel/inspect` returns `{ live: true, graph: inspect(), stores: { [id]: { state, log } }, ids, a11y, routes }` (artifacts read from the `artifacts` dir per request, `{}` without it), echoing loopback origins for CORS; production: route-table 404.
- **Dependencies:** `hono`, `@keel/schema`, `@keel/router`, `@keel/store`, `@keel/reactive`, `@keel/ctx`.
- **Rungs:** conformance; properties (seed 1337): status by code, FormData round trip, topology round trip, one `req` per request.
- **Scope:** string renderer (string, or a DOM node serialized); server-mode compile, streaming and `<!--[-->` regions are later work.

## Server state

Module-level stores on a server are process-shared data (single-process dev/demo API). Per-request state is created inside the request scope (loader, action or component, before any `await`); `#k-state` snapshots only stores created there plus those in `createApp({ expose })`. Request-scope stores are disposed after the response. Action results and 303/302 redirects send `cache-control: no-store`. Per-request store instances are backlog 0054.

## Extension points

`guards`: route `guard` names resolve here, then in the router registry. `expose`: module-level stores to snapshot into `#k-state`. `LogSink`: any `{ format, write(line) }`.

## Unsafe

count: 0
