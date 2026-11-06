# k.ctx: Capabilities
status: implemented

**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?): Promise<void>` (sim: resolved by `advance` in deadline order; abort rejects with the reason), `ctx.random.uuid()/float()`, `ctx.random.id(brand): Id<B>` (a fresh uuid typed as `s.id(brand)`; `id` for schema ids, `uuid` for raw strings), `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns a typed accessor `(ctx) => Impl`, the only access path (no `ctx[name]`); each factory's seed is derived from the ctx seed and the name; `capabilities()` lists names; re-registering a name with the identical implementations object is idempotent (returns the same accessor), any other duplicate name is E1602.

**Rules.** `Date.now`, `new Date()`, `Math.random`, `crypto.randomUUID`, bare `fetch`, `localStorage` in app code are E1601 with a fix to the `ctx` equivalent.

**Conformance.** `after(ms)` under sim resolves exactly when `advance` crosses the deadline, never before, and an aborted waiter rejects. `random.id(brand)` under sim is deterministic by seed and parses with `s.id(brand)`. Simulated implementations are deterministic by seed; every capability has all three implementations; `keel test` runs under sim by default.
