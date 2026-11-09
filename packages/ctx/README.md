# @keel/ctx

**Spec:** k.ctx · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `createCtx({ mode?, seed? })` returns a frozen `Ctx`: `clock.now()`, `clock.after(ms, signal?)`, `random.float()`, `random.id(brand)` (a v4 uuid typed `Id<B>` from `@keel/schema`, parses with `s.id(brand)`; the only way to mint an id or token, RFC 0043), `net.fetch(req)`, `storage.get/set` (async; `get` resolves `null` when missing). `mode: 'sim'` returns `SimCtx`: `clock.advance(ms)` (resolves due `after` waiters in deadline order, ties by registration, before returning), `net.route(pattern, handler)`. `register(name, { real, shell, sim })`, `capabilities()`. Types: `Ctx`, `SimCtx`, `Capability<T>`, `CtxOptions`, `Mode`, `Clock`, `SimClock`, `Random`, `Net`, `SimNet`, `RouteHandler`, `KeyValueStorage`. RFC 0070: `observe(ctx, fn) -> stop` (events `nav`, `fire`, `resource`, `error`; types `CtxEvent`, `FireEvent`) and `seedOf(ctx)`; kernel producers use `@keel/ctx/internal` (`report`, `observed`, `quiet`). rfc:0071: `observe` is a capability, declared as `observe` in a module's `capabilities` and enforced statically by E1156 (a ctx has no module identity, so the runtime does not gate it); `resume` reports the served route as the first `nav` (params and search encoded, `schemas` `{}`).
- **Invariants:** mode defaults to `sim` when `KEEL_TEST=1`, else `real`; seed defaults to 0, coerced to uint32. Sim: clock starts at 0, `advance` and `after` reject negative or non-finite ms (RangeError); an aborted `after` rejects with `signal.reason`; real `after` is `setTimeout` clamped to 2^31-1, cleared on abort; random is xoshiro128** seeded via splitmix32, same seed same sequence; net is an in-memory route table (exact URL, or prefix ending `*`; first match wins; else 404); storage is an in-memory map per ctx. Every capability object is fresh per ctx. `shell` delegates to `real` until native adapters exist. Real storage throws where `localStorage` is absent.
- **Dependencies:** none at runtime.
- **Rungs:** conformance (example + probabilistic), properties for PRNG and sim clock.

## Extension points

**Capability registry.** `register(name, { real, shell, sim })` where each factory is `({ seed }) => Impl` and runs once per ctx created afterwards. `register` returns a typed accessor `(ctx) => Impl`, the only way to reach the capability (it is not attached as `ctx[name]`). Each factory's `seed` is derived from the ctx seed and the name, so streams do not correlate. Registering the same name again with the identical implementations object (reference equality) is idempotent and returns the same accessor (HMR safe); a different object, or a kernel name, throws `Error` with `code: 'E1602'`. The registry is process-wide.

## Unsafe

count: 0
