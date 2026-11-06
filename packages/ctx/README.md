# @keel/ctx

**Spec:** k.ctx · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `createCtx({ mode?, seed? })` returns a frozen `Ctx`: `clock.now()`, `random.uuid()/float()`, `net.fetch(req)`, `storage.get/set` (async; `get` resolves `null` when missing). `mode: 'sim'` returns `SimCtx`: `clock.advance(ms)`, `net.route(pattern, handler)`. `register(name, { real, shell, sim })`, `capabilities()`. Types: `Ctx`, `SimCtx`, `Capability<T>`, `CtxOptions`, `Mode`, `Clock`, `SimClock`, `Random`, `Net`, `SimNet`, `RouteHandler`, `KeyValueStorage`.
- **Invariants:** mode defaults to `sim` when `KEEL_TEST=1`, else `real`; seed defaults to 0, coerced to uint32. Sim: clock starts at 0, `advance` rejects negative or non-finite ms (RangeError); random is xoshiro128** seeded via splitmix32, same seed same sequence; net is an in-memory route table (exact URL, or prefix ending `*`; first match wins; else 404); storage is an in-memory map per ctx. Every capability object is fresh per ctx. `shell` delegates to `real` until native adapters exist. Real storage throws where `localStorage` is absent.
- **Dependencies:** none at runtime.
- **Rungs:** conformance (example + probabilistic), properties for PRNG and sim clock.

## Extension points

**Capability registry.** `register(name, { real, shell, sim })` where each factory is `({ seed }) => Impl` and runs once per ctx created afterwards. `register` returns a typed accessor `(ctx) => Impl`, the only way to reach the capability (it is not attached as `ctx[name]`). Each factory's `seed` is derived from the ctx seed and the name, so streams do not correlate. Registering the same name again with the identical implementations object (reference equality) is idempotent and returns the same accessor (HMR safe); a different object, or a kernel name, throws `Error` with `code: 'E1602'`. The registry is process-wide.

## Unsafe

count: 0
