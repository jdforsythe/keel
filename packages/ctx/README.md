# @keel/ctx

**Spec:** k.ctx · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `createCtx({ mode?, seed? })` returns a frozen `Ctx`: `clock.now()`, `random.uuid()/float()`, `net.fetch(req)`, `storage.get/set` (async; `get` resolves `null` when missing). `mode: 'sim'` returns `SimCtx`: `clock.advance(ms)`, `net.route(pattern, handler)`. `register(name, { real, shell, sim })`, `capabilities()`. Types: `Ctx`, `SimCtx`, `Capability<T>`, `CtxOptions`, `Mode`, `Clock`, `SimClock`, `Random`, `Net`, `SimNet`, `RouteHandler`, `KeyValueStorage`.
- **Invariants:** mode defaults to `sim` when `KEEL_TEST=1`, else `real`; seed defaults to 0, coerced to uint32. Sim: clock starts at 0, `advance` rejects negative or non-finite ms (RangeError); random is xoshiro128** seeded via splitmix32, same seed same sequence; net is an in-memory route table (exact URL, or prefix ending `*`; first match wins; else 404); storage is an in-memory map per ctx. Every capability object is fresh per ctx. `shell` delegates to `real` until native adapters exist. Real storage throws where `localStorage` is absent.
- **Dependencies:** none at runtime.
- **Rungs:** conformance (example + probabilistic), properties for PRNG and sim clock.

## Extension points

**Capability registry.** `register(name, { real, shell, sim })` where each factory is `({ seed }) => Impl` and runs once per ctx created afterwards. The capability appears as `ctx[name]`; `register` returns a typed accessor `(ctx) => Impl` (use it instead of indexing). A name already taken, kernel or registered, throws `Error` with `code: 'E1602'`. The registry is process-wide.

## Unsafe

count: 0
