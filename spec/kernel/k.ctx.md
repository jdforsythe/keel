# k.ctx: Capabilities
status: proposed

**API.** `ctx.clock.now()`, `ctx.random.uuid()/float()`, `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `ctx.register(name, iface, { real, shell, sim })`.

**Rules.** `Date.now`, `new Date()`, `Math.random`, `crypto.randomUUID`, bare `fetch`, `localStorage` in app code are E1601 with a fix to the `ctx` equivalent.

**Conformance.** Simulated implementations are deterministic by seed; every capability has all three implementations; `keel test` runs under sim by default.
