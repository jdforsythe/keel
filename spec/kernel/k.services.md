# k.services: Thin services
status: conformance-covered

**API.**
```ts
// modules/orders/OrdersApi.schema.ts
export const OrdersApi = endpoints({
  getOrder: { method: 'GET', path: '/orders/:id', params: s.object({ id: s.id('Order') }), output: Order },
  addNote: { method: 'POST', path: '/orders/:id/notes', params: s.object({ id: s.id('Order') }),
    body: NoteInput, output: Note, errors: { 409: Conflict } },
})
// modules/orders/api.server.ts
import { OrdersApi } from './OrdersApi.schema.ts'
export const api = service({ base: 'https://api.example.com', schema: OrdersApi, timeout: 5000 })
const r = await api.getOrder({ params: { id } }, ctx) // Result<Order, ApiError>
```
- `endpoints` and `service` come from `@keel/services`. Endpoint keys: `method`, `path`, `params?`, `query?`, `body?`, `output`, `errors?` (status to schema), `timeout?`, `events?`.
- `service({ base, schema, timeout? })` calls another service; `service({ module, schema, timeout? })` calls the routes of app module `module` (k.module `deps` and `public.routes` apply), resolved by k.topology: in process, a peer, or in a browser the peer's (k.hosting) or the document's origin; on a ctx no `createApp` bound, `http://<module>.keel.invalid`. It follows no redirect: a 3xx is `api.status` (in a browser `status` 0, an opaque redirect). The timeout defaults to 10,000 ms; an endpoint's `timeout` overrides it; none is per call.
- A client method takes `{ params?, query?, body?, signal?, bearer? }` and `ctx`. `bearer`, a `Secret<string>`, is sent as `authorization: Bearer <token>`; a token outside k.api's Bearer form is `api.input` at `bearer`. Requests go through `ctx.net.fetch` (k.ctx), so tests run under sim.
- A GET endpoint with `events: true` is an event stream (a k.server live loader): its method returns an `AsyncIterable` of `Result<T, ApiError>`, sends `accept: text/event-stream` and decodes each `data:` line, a k.server `Result`: an `ok` value with `output`, an `err` as `api.status` (200, `body` the error). It ends when the stream ends, after an `err`, or when `signal` aborts; it never reconnects or resumes. Its timeout applies until the response starts.

**ApiError.** A union of KeelErrors (k.errors), matched on `code`:
- `api.timeout` `{ ms }`: no response within the timeout, measured on `ctx.clock`; the request is aborted.
- `api.network` `{}`: `fetch` rejected, or a `module` service got a 502 JSON `keel.unreachable` err of at most 1 KiB.
- `api.status` `{ status, body }`: non-2xx; `body` decoded by `errors[status]` when declared, else `null`.
- `api.decode` `{ issues }`: a 2xx body that fails `output`.
- `api.input` `{ issues }`: the call's `params`, `query`, or `body` fail their schemas; nothing is sent.

The client never throws; every failure is an `err`.

**Encoding.** Path params are URL-encoded; `query` is encoded by its schema; `body` is JSON by its schema. Every request sends `accept: application/json` and `x-keel: 1`. A `base` service decodes a body with `output`; a `module` service reads the route's `Result` (GET: `results[id]`, the matched route's own) and decodes its `ok` value with `output` and, on a non-2xx, its `error` with `errors[status]`.

**Not here** (stdlib): retries, caching, getting and refreshing tokens, interceptors.

**Rules.** On `endpoints({...})` literals from `@keel/services` and app code. E1651 `ctx.net.fetch` in app code (no fix; declare an endpoint) · E1652 a `:param` in a literal `path` without a field in a literal `params`, or a `params` field missing from `path` (fix adds or removes the field) · E1653 `body` on a `GET` or `HEAD` endpoint (fix removes it).

**Conformance.**
- A 2xx response whose body matches `output` yields `ok` with the decoded value.
- A 2xx response whose body fails `output` yields `err` with `api.decode`, never `ok`.
- Invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request.
- Under sim, with no response, advancing the clock to `timeout - 1` leaves the call pending; advancing to `timeout` yields `api.timeout` and aborts the request signal.
- A 409 with `errors: { 409: Conflict }` yields `api.status` with a decoded body; an undeclared 500 yields `api.status` with `body: null`.
- A rejected `fetch`, or a 502 `keel.unreachable` err to a `module` service, yields `api.network`; to a `base` service, `api.status`.
- Param value `a/b` is sent as `a%2Fb`.
- For generated responses of any status and body, no client call throws.
- An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request.
- On an unbound sim ctx, `service({ module: 'b' })` sends its request to `http://b.keel.invalid` plus the endpoint path.
- A `module` GET endpoint whose `output` is the loader's `output` yields `ok(v)` for a loader `ok(v)`; a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`.
- With `bearer` a secret of `abc`, the request carries `authorization: Bearer abc`; with `a b`, the call is `api.input` with issue path `bearer` and sends no request.
