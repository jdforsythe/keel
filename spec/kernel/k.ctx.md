# k.ctx: Capabilities
status: implemented

**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?): Promise<void>` (sim: resolved by `advance` in deadline order; abort rejects with the reason), `ctx.random.float()`, `ctx.random.id(brand): Id<B>` (a fresh v4 uuid typed as `s.id(brand)`; the one way to mint an id or token, no `uuid()`; rfc:0043), `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns a typed accessor `(ctx) => Impl`, the only access path (no `ctx[name]`); resolution is lazy, the first access on a ctx builds the implementation for that ctx's mode, so `createCtx` and `register` may run in either order and a ctx made earlier sees later registrations; each factory's seed is derived from the ctx seed and the name; `capabilities()` lists names; re-registering a name with the identical implementations object is idempotent (returns the same accessor), any other duplicate name is E1602.

**Rules.** Ambient clock, random, net, and storage effects in app code are E1601: `Date` (`Date.now`, `new Date()`, `Date()`), `Temporal.Now`, `Intl.DateTimeFormat` `format()`/`formatToParts()` with no date, `performance.now`/`timeOrigin`, `Math.random`, `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`, `navigator.sendBeacon`, `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`. They are found through `globalThis`/`window`/`self`, a literal computed key (`Date['now']`, `` Date[`now`] ``, a `const` string), and same-file bindings (`const D = Date`, a parameter default, `const { random } = Math`), each name resolved by lexical scope, so a local `Date` is not the global. An alias is reported at its uses, not where it is declared, unless it is exported there. The fix is the `ctx` equivalent where one is exact; `crypto.randomUUID` names `ctx.random.id(brand)` without a fix. E1603 `eval`, `Function(...)`, or `new Function(...)` in app code, also aliased or as a function's `constructor`, and `import()` of a `data:` URL: code from a string reaches every ambient. Neither follows values through calls, object literals, a reassigned binding, or another file (rfc:0053, 0058).

**Conformance.**
- `after(ms)` under sim resolves exactly when `advance` crosses the deadline, never before, and an aborted waiter rejects.
- `random.id(brand)` under sim is deterministic by seed and parses with `s.id(brand)`; `random` has no `uuid`.
- A ctx created before `register(name)` and one created after both reach it in real, shell, and sim.
- Simulated implementations are deterministic by seed.
- Every capability has all three implementations.
- `keel test` runs under sim by default: a ctx created with no options inside a test is sim, with seed 0.
- `const D = Date; D.now()`, `` Date[`now`]() ``, and `const { random } = Math; random()` are each one E1601, at the call; after `const Date = ctx.clock`, `Date.now()` is not E1601.
- For an alias chain of depth 1 to 4 to `Date.now` or `Math.random`, E1601 is reported exactly once, at the call.
- `eval(s)`, `Function(s)`, `new Function(s)`, and `const e = eval; e(s)` are each one E1603; a locally declared `Function` is not.
- `Temporal.Now.instant()`, `performance.timeOrigin`, `navigator.sendBeacon(u, b)`, and `new Intl.DateTimeFormat('en').format()` are each one E1601; `.format(d)` is not.
- `(() => {}).constructor(s)`, `(async () => {}).constructor(s)`, `Function.prototype.constructor(s)`, and `import('data:text/javascript,' + s)` are each one E1603; `import('./a.ts')` is not.
