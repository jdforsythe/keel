# @keel/services

**Spec:** k.services · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `endpoints({ name: { method, path, params?, query?, body?, output, errors?: { [status]: schema }, timeout?, events? } })` returns the frozen declarations. `service({ base, schema, timeout? })` or `service({ module, schema, timeout? })` returns a client with one method per endpoint: `(input: { params?, query?, body?, signal? }, ctx) => Promise<Result<Out, ApiError>>`, or for an `events: true` GET an `AsyncIterable<Result<Out, ApiError>>`. Types: `ApiError`, `Client`, `Endpoint`, `EndpointMap`, `Method`, `ServiceOptions`.
- **Invariants:** a call never throws or rejects. Requests go through `ctx.net.fetch`. `ApiError` by `code`: `api.timeout { ms }` (default 10,000 ms, endpoint overrides service; measured by `ctx.clock.after`; aborts the request signal), `api.network {}` (fetch or body read rejected, or the platform refused the Request), `api.status { status, body }` (`body` decoded by `errors[status]`, else or on failure `null`), `api.decode { issues }` (2xx body fails `output`), `api.input { issues }` (call input fails its schema: paths prefixed `params`/`query`/`body`, nothing sent). Path params are `encodeURIComponent`ed; query is the inverse of `decodeStrings` (dotted keys, repeated keys, null absent); body is JSON; every request sends `accept: application/json` and `x-keel: 1` (RFC 0022). An empty 2xx body is `null`. `service` throws at construction on a relative `base`, a `module` that is not an id, or a timeout that is not a finite ms > 0. `signal` aborts the request.
- **Module calls** (k.topology Calls and peers): `module` resolves per call. On a ctx a `createApp` bound (the `globalThis` key `Symbol.for("keel.modules")`, written by `@keel/server`), the app serving the module in this process answers through its `fetch` with no `ctx.net.fetch`, and a peer by URL through `ctx.net.fetch` to that URL; otherwise a browser calls `location.origin`, anything else `http://<module>.keel.invalid`. Every path encodes, sends the same headers and decodes alike.
- **Events** (k.services, a k.server live loader): one request with `accept: text/event-stream`; the timeout applies until the response starts. A non-2xx answer is one `api.status` and the end. Each event's `data` is a `Result` JSON: `ok` decoded with `output` (`api.decode` then the end), `err` as `api.status` 200 with the error as `body`, then the end. A body error is `api.network`; an aborted `signal` ends it with no further result; it never reconnects or resumes, and leaving the loop aborts the request.
- **OpenAPI** (rfc:0034): `openapi(doc, { name })` from `@keel/services/openapi` (build time) returns `Result<{ schema, service }, SchemaError>`, the sources of `<Name>Api.schema.ts` (`<Name>Api = endpoints(...)`, filename equals export, rfc:0039, one endpoint per `operationId`, refs inlined, unsupported schemas `s.json()`) and `api.ts` (imports `./<Name>Api.schema.ts`); a doc outside the subset is `schema.invalid` with paths into the doc. Types: `OpenApiFiles`, `OpenApiOptions`.
- **Dependencies:** `@keel/schema`, `@keel/ctx`.
- **Rungs:** conformance; properties (seed 1337): query/param/body round trips, never-throws, openapi one-endpoint-per-operation and biome-stable output; mutation 88.0%.

## Extension points

None. Retries, caching, auth and interceptors are stdlib. E1651-E1653 are `@keel/check` rules (RFC 0031), asserted in this suite through `check()`.

## Unsafe

count: 1 (`unsafe/asClient.ts`: Object.fromEntries typed as the mapped `Client<D>`)
