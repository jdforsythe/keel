# @keel/services

**Spec:** k.services · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `endpoints({ name: { method, path, params?, query?, body?, output, errors?: { [status]: schema }, timeout? } })` returns the frozen declarations. `service({ base, schema, timeout? })` returns a client with one method per endpoint: `(input: { params?, query?, body? }, ctx) => Promise<Result<Out, ApiError>>`. Types: `ApiError`, `Client`, `Endpoint`, `EndpointMap`, `Method`, `ServiceOptions`.
- **Invariants:** a call never throws or rejects. Requests go through `ctx.net.fetch`. `ApiError` by `code`: `api.timeout { ms }` (default 10,000 ms, endpoint overrides service; measured by `ctx.clock.after`; aborts the request signal), `api.network {}` (fetch or body read rejected, or the platform refused the Request), `api.status { status, body }` (`body` decoded by `errors[status]`, else or on failure `null`), `api.decode { issues }` (2xx body fails `output`), `api.input { issues }` (call input fails its schema: paths prefixed `params`/`query`/`body`, nothing sent). Path params are `encodeURIComponent`ed; query is the inverse of `decodeStrings` (dotted keys, repeated keys, null absent); body is JSON; every request sends `accept: application/json` and `x-keel: 1` (RFC 0022). An empty 2xx body is `null`. `service` throws at construction on a relative `base` or a timeout that is not a finite ms > 0.
- **OpenAPI** (rfc:0034): `openapi(doc, { name })` from `@keel/services/openapi` (build time) returns `Result<{ schema, service }, SchemaError>`, the sources of `api.schema.ts` (`<Name>Api = endpoints(...)`, one endpoint per `operationId`, refs inlined, unsupported schemas `s.json()`) and `api.ts`; a doc outside the subset is `schema.invalid` with paths into the doc. Types: `OpenApiFiles`, `OpenApiOptions`.
- **Dependencies:** `@keel/schema`, `@keel/ctx`.
- **Rungs:** conformance; properties (seed 1337): query/param/body round trips, never-throws, openapi one-endpoint-per-operation and biome-stable output; mutation 88.0%.

## Extension points

None. Retries, caching, auth and interceptors are stdlib. E1651-E1653 are `@keel/check` rules (RFC 0031), asserted in this suite through `check()`.

## Unsafe

count: 1 (`unsafe/asClient.ts`: Object.fromEntries typed as the mapped `Client<D>`)
