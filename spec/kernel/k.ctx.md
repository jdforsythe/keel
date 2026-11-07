# k.ctx: Capabilities
status: conformance-covered

**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?): Promise<void>` (sim: resolved by `advance` in deadline order; abort rejects with the reason), `ctx.random.uuid()/float()`, `ctx.random.id(brand): Id<B>` (a fresh uuid typed as `s.id(brand)`; `id` for schema ids, `uuid` for raw strings), `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns a typed accessor `(ctx) => Impl`, the only access path (no `ctx[name]`); resolution is lazy, the first access on a ctx builds the implementation for that ctx's mode, so `createCtx` and `register` may run in either order and a ctx made earlier sees later registrations; each factory's seed is derived from the ctx seed and the name; `capabilities()` lists names; re-registering a name with the identical implementations object is idempotent (returns the same accessor), any other duplicate name is E1602.

**Rules.** Ambient clock, random, net, and storage effects in app code are E1601, also via `globalThis`/`window`/`self` or computed access: `Date` (`Date.now`, `new Date()`, `Date()`), `performance.now`, `Math.random`, `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`, `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`. The fix is the `ctx` equivalent where one is exact.

**Conformance.**
- `after(ms)` under sim resolves exactly when `advance` crosses the deadline, never before, and an aborted waiter rejects.
- `random.id(brand)` under sim is deterministic by seed and parses with `s.id(brand)`.
- A ctx created before `register(name)` and one created after both reach it in real, shell, and sim.
- Simulated implementations are deterministic by seed.
- Every capability has all three implementations.
- `keel test` runs under sim by default: a ctx created with no options inside a test is sim, with seed 0.
