# Task 0029: services

**Spec:** k.services · **Gate:** G2 · **Branch:** jdforsythe/test-impl · **Package:** packages/services

## Deliverables
- [x] `endpoints(decls)`, `service({ base, schema, timeout? })` -> client `(input, ctx) => Promise<Result<Out, ApiError>>`
- [x] ApiError: `api.timeout` `{ ms }`, `api.network` `{}`, `api.status` `{ status, body }`, `api.decode` `{ issues }`
- [x] encoding: path params URL-encoded, query by schema, body JSON
- [x] property tests (seed 1337); README contract; changeset; spec status stays `proposed`

## Steps
1. [x] conformance-writer wrote packages/services/conformance (commit c2b83b3).
2. [x] Implement; check; test (conformance green: 15 passed, 4 todo).
3. [x] Properties (test/encoding.property, test/neverThrows.property, seed 1337); examples; smoke test removed; README; `.changeset/services-initial.md`; spec status left `proposed`.
4. [x] Follow-ups filed: BACKLOG 0051 (E1651-E1653 in check), 0052 (k.ctx timer rfc), 0053 (input error code rfc).

## Decisions
- D1: API follows spec and conformance, not the task brief: `service({ base, schema, timeout? })` returns the client directly; a method is `(input, ctx)`; `endpoints({...})` takes plain declaration objects (no per-endpoint `endpoint()` builder) and is itself the declaration list (scaffold/OpenAPI read it). One way (P1).
- D2: The declarations type is `EndpointMap`, not `Endpoints`: `Endpoints.ts` and `endpoints.ts` collide on case-insensitive filesystems (macOS).
- D3: `ApiError<B>` is a union on `code`; each variant's `data` also names the other variants' keys as `?: never`, so `error.data.status` etc. type-check without narrowing (the conformance reads them that way).
- D4: Invalid call input (fails `params`/`query`/`body` schema, or a param `encodeURIComponent` rejects) is `api.decode` with issue paths prefixed `params`/`query`/`body`; the request is not sent. The spec's closed union has no input code; spec gap, candidate RFC (`api.input`?). (Superseded by D12.)
- D5: Timeout on `ctx.clock`: k.ctx `Clock` has only `now()` and no timer/subscription. A sim clock (detected by `"advance" in clock`) is polled once per macrotask (`setTimeout(0)`, unref'd); a real clock re-checks `now()` after `setTimeout(min(left, 2^31-1))`. On deadline: `controller.abort()` then `api.timeout { ms }`; a late response is ignored. The timer covers fetch and body read. Follow-up: a k.ctx timer (e.g. `clock.after(ms)`) would remove polling (RFC).
- D6: Response decoding: 2xx text -> JSON (empty body is `null`) -> `output.decode`; JSON parse failure is `api.decode` `[{ path: [], rule: 'type' }]`. Declared non-2xx decodes with `errors[status]`; a body that fails is `body: null`. Undeclared non-2xx: body not read, `null`. A rejected `res.text()` is `api.network`.
- D7: Query encoding: `query.encode(v)` then flattened to URLSearchParams (dotted keys for objects, repeated keys for primitive arrays, null skipped) as the inverse of `decodeStrings`. Path params: `params.encode(v)`, string as is, other JSON as its literal, then `encodeURIComponent`. Body: `JSON.stringify(body.encode(v))` with `content-type: application/json`.
- D8: Never throws: each effect goes through `attempt`; a Request the platform refuses (bad URL, body on GET) or a rejected fetch is `api.network`; any residual unexpected throw in the call (e.g. a malformed ctx) is mapped to `api.network` by an outer `attempt`. `service(...)` itself throws at construction on a non-absolute `base` or a timeout that is not a finite ms > 0 (declaration bug, like `s.string` min > max).
- D9: One `unsafe` (`unsafe/asClient.ts`): Object.fromEntries cannot be typed as the mapped `Client<D>`. Unsafe count 0 -> 1, justified.
- D11 (rfc:0012): D5 superseded. The timeout is `ctx.clock.after(ms, signal)`; `deadline.ts` and the `"advance" in clock` duck-typing are gone, so a sim timeout fires only on `advance` and is unaffected by `vi.useFakeTimers()` (`test/timeout-fake-timers.test.ts`). A cancelled timer's rejection is swallowed.
- D10: E1651-E1653 are static checker rules owned by `@keel/check`; not implemented here (backlog item).
- D12: RFC 0013: invalid call input (and a param `encodeURIComponent` rejects) is `api.input { issues }`, paths prefixed `params`/`query`/`body`, nothing sent; supersedes D4. `api.decode` is response bodies only.

## Verification
- [x] conformance green (E1651-E1653 and OpenAPI fixture are `it.todo` in the suite) · properties present · `pnpm --filter @keel/services check` clean · structure-lint clean · docs-freshness, budgets ok
- [x] Mutation: `ok mutate services score 75.9% (threshold 70%)`
- Unsafe count 0 -> 1 (D9). Backlog 0029 left unchecked pending review.
- Root `pnpm check`/`pnpm test` not run (other tasks' uncommitted work in the tree; biome restricted to services).

Test trailer (`pnpm --filter @keel/services test`): `ok 30 tests, 0 failed, 4 skipped (1.1s)`

## Next action
review
