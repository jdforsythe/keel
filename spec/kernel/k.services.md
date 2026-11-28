# k.services: Thin services
status: conformance-covered

**API.**
```ts
// modules/recipes/kitchenApi.ts: a client of the kitchen module's contract (k.contract)
export const kitchenApi = service({ contract: kitchen, timeout: 5000 })
const r = await kitchenApi.box({}, ctx) // Result<Box, ApiError>
// a service no app module serves
const Geo = endpoints({ lookup: { method: 'GET', path: '/v1/:q', params: GeoQ, output: Place, errors: { 404: NotFound } } })
export const geoApi = service({ base: 'https://geo.example.com', schema: Geo })
```
- `endpoints` and `service` come from `@keel/services`, which takes a contract's types from `@keel/router/contract` (k.contract) and loads no other router code. Endpoint keys, and a contract's API entry members: `method`, `path`, `params?`, `query?`, `body?`, `output`, `errors?` (status to schema), `timeout?`, `events?`.
- `service({ contract, timeout? })` calls the API entries of the contract's module, one method per entry named by its id after the module (k.module `deps` applies), resolved by k.topology: in process, a peer, or in a browser the peer's (k.hosting) or the document's origin; on a ctx no `createApp` bound, `http://<module>.keel.invalid`. `service({ base, schema, timeout? })` calls another service. Neither follows a redirect: a 3xx is `api.status` (in a browser `status` 0, an opaque redirect). The timeout defaults to 10,000 ms; an endpoint's `timeout` overrides it; none is per call. A call reads at most `maxBytes` (a `service` option, default 1 MiB) of a response body; a longer 2xx body is `api.decode`, another `api.status` with `body` `null`.
- A client method takes `{ params?, query?, body?, signal?, bearer?, user? }` and `ctx`. `bearer`, a `Secret<string>`, is sent as `authorization: Bearer <token>`; a token outside k.api's Bearer form is `api.input` at `bearer`. `user` is k.user's, on a `contract` service only; a `base` service call naming it is `api.input` at `user` and sends nothing. Requests go through `ctx.net.fetch` (k.ctx), so tests run under sim.
- A GET endpoint with `events: true` is an event stream (a k.server live loader): its method returns an `AsyncIterable` of `Result<T, ApiError>`, sends `accept: text/event-stream` and decodes each `data:` line, a k.server `Result`: an `ok` value with `output`, an `err` as `api.status` (200, `body` the error). It ends when the stream ends, after an `err`, or when `signal` aborts; it never reconnects or resumes. Its timeout applies until the response starts. One event is at most `maxBytes`: its bytes from the one after the blank line that ends the line block before it (or the body's start) through the blank line that ends it, every line, comment and line end counted. Once a block passes `maxBytes` before its blank line comes, the body is cancelled and the iteration yields one `api.decode` (issues `[{ path: [], rule: 'max' }]`) and ends. The body is read in steps linear in its bytes.

**ApiError.** A union of KeelErrors (k.errors), matched on `code`:
- `api.timeout` `{ ms }`: no response within the timeout, measured on `ctx.clock`; the request is aborted.
- `api.network` `{}`: `fetch` rejected, or a `contract` service got a 502 JSON `keel.unreachable` err of at most 1 KiB.
- `api.status` `{ status, body }`: non-2xx; `body` decoded by `errors[status]` when declared, else `null`.
- `api.decode` `{ issues }`: a 2xx body that fails `output`.
- `api.input` `{ issues }`: the call's `params`, `query`, or `body` fail their schemas; nothing is sent.

The client never throws; every failure is an `err`.

**Encoding.** Path params are URL-encoded, one segment each (`''`, `.` or `..` is `api.input` at the param, nothing sent); `query` is encoded by its schema; `body` is JSON by its schema. A request carries `accept: application/json` (`text/event-stream` for `events`), `authorization` for a `bearer` and `content-type: application/json` with a body; to a Keel origin it also carries `x-keel: 1` (k.server's same-site proof) and a `user`'s `x-keel-user` (k.user). Keel origins: each `contract` service target; for a `base` service, the document's origin in a browser, each `keel-peer` origin (k.hosting) and the origin of each URL peer of the `createApp` that bound `ctx` (k.topology). Any other origin is a third party, declared under `origins.connect` (k.origins) or not, and gets nothing else: a GET with no `bearer` to it is a CORS-simple request. A `base` service sends with the `fetch` default credentials (`same-origin`); a `contract` one with `include` to a cross-origin peer. A `base` service decodes a body with `output` and reads no k.server `Result`: a third party's body shaped like one is data (a 2xx one failing `output` is `api.decode`; a non-2xx one, a 502 `keel.unreachable` too, `api.status`); a `contract` service reads the route's `Result` (GET: `results[id]`, the matched route's own) and decodes its `ok` value with `output` and, on a non-2xx, its `error` with `errors[status]`.

**Not here** (stdlib): retries, caching, getting and refreshing tokens, interceptors.

**Rules.** On `endpoints({...})` literals from `@keel/services` and app code (a contract's: k.contract). E1651 `ctx.net.fetch` in app code (no fix; declare an endpoint) · E1652 a `:param` in a literal `path` without a field in a literal `params`, or a `params` field missing from `path` (fix adds or removes the field) · E1653 `body` on a `GET` or `HEAD` endpoint or API entry (fix removes it).

**Conformance.**
- A 2xx response whose body matches `output` yields `ok` with the decoded value.
- A 2xx response whose body fails `output` yields `err` with `api.decode`, never `ok`.
- Invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request.
- Under sim, with no response, advancing the clock to `timeout - 1` leaves the call pending; advancing to `timeout` yields `api.timeout` and aborts the request signal.
- A 409 with `errors: { 409: Conflict }` yields `api.status` with a decoded body; an undeclared 500 yields `api.status` with `body: null`.
- A rejected `fetch`, or a 502 `keel.unreachable` err to a `contract` service, yields `api.network`; to a `base` service, `api.status`.
- Param value `a/b` is sent as `a%2Fb`.
- For generated responses of any status and body, no client call throws.
- An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request.
- With `maxBytes: 64`, an `events` endpoint of `output` `s.json()` served the body `data: {"ok":true,"value":1}`, two line feeds, `data: {"ok":true,"value":"<s>"}`, two line feeds, yields `ok(1)` and then `ok(s)` for `s` of 34 `a` (a 64-byte block), and `ok(1)` and then one `api.decode` with issues `[{ path: [], rule: 'max' }]`, then ends with the body cancelled, for 35 `a`; one served `data: {"ok":true,"value":1}`, two line feeds, then 17 lines `: x`, each with its line feed, and no blank line yields `ok(1)` and then that `api.decode`; one served 20 blocks of `: x` and two line feeds (5 bytes each), then `data: {"ok":true,"value":1}` and two line feeds, yields `ok(1)`.
- On an unbound sim ctx, `service({ contract: b })` of module `b` sends its request to `http://b.keel.invalid` plus the entry's path.
- A `contract` GET entry yields `ok(v)` for its loader's `ok(v)`; a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`.
- With `bearer` a secret of `abc`, the request carries `authorization: Bearer abc`; with `a b`, the call is `api.input` with issue path `bearer` and sends no request.
- To a third-party origin (a ctx no `createApp` bound, and a browser whose document is `https://app.test`), `service({ base: 'https://api.example.com' })` sends: for a GET with no `bearer`, a request with exactly the header `accept: application/json` and credentials `same-origin`, a CORS-simple request; with `bearer` `abc`, exactly `accept` and `authorization: Bearer abc`; for a POST with a body, exactly `accept` and `content-type: application/json`; for an `events` GET, exactly `accept: text/event-stream`. None carries `x-keel` or `x-keel-user`.
- The same `base` client with `base` the document's origin in a browser, a `keel-peer` origin, or a URL peer of the `createApp` that bound `ctx` (the app's own `node` deployable) sends `x-keel: 1` besides; every `service({ contract })` request carries `x-keel: 1`, in process too.
- A `base` call naming `user: 'u1'`, on a ctx a `createApp` bound and on one none bound, is `api.input` at `user` and sends nothing; under `renderRoute(id, { user: 'u1' })` a `base` call naming none carries no `x-keel-user`.
- From a third party, a 200 body `{ "ok": false, "error": { "code": "keel.denied", "message": "x" } }` against an `output` it fails is `api.decode`; a 403 with that body and no `errors[403]` is `api.status` 403 with `body: null`; neither is `api.network`.
