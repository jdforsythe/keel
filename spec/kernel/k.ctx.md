# k.ctx: Capabilities
status: implemented

**API.** `ctx.clock.now()`, `ctx.random.uuid()/float()`, `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns a typed accessor `(ctx) => Impl`; `capabilities()` lists names; duplicate name is E1602.

**Rules.** `Date.now`, `new Date()`, `Math.random`, `crypto.randomUUID`, bare `fetch`, `localStorage` in app code are E1601 with a fix to the `ctx` equivalent.

**Conformance.** Simulated implementations are deterministic by seed; every capability has all three implementations; `keel test` runs under sim by default.
