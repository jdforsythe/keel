# k.owner: Ctx owner
status: conformance-covered

Only the code that made a ctx ends it. Every island, the router and the root share the page's ctx (k.runtime), so an ending any holder could call would let one island cut every other island's `net` events.

**API.** `createCtx({ ..., signal?: AbortSignal })`. A real or shell ctx whose net is its own adds its window `online` and `offline` listeners when made and removes each once when `signal` aborts; made with an aborted `signal`, it adds none. A sim ctx and a ctx whose net comes from `drivers` add none, and `signal` changes nothing on them. `Ctx` and `SimCtx` have no `dispose`, and nothing reachable from a ctx ends it: a holder that did not make the ctx gets its capabilities and no way to remove its listeners. The ctx stays usable after the abort.

**Owners.** The generated resume, client and shell entries make the page ctx with no `signal`: it lives as long as the page. A server's ctx (`createApp`, `keel dev`, `server.mjs`) has no window and takes none. `@keel/std-sessions`' real and shell sinks make a ctx only for `random`, with `AbortSignal.abort()`, so it adds no listener. A test making real ctxs under one window passes a `signal` and aborts it when done. An object literal typed `Ctx` (a test's wrapper) lists `clock`, `random`, `net` and `storage`.

**Conformance.**
- Under a stub `window`, a real ctx made with a `signal` adds one `online` and one `offline` listener; aborting the signal removes each once and a second abort removes nothing; made with `AbortSignal.abort()` it adds none. A shell ctx behaves the same.
- A sim ctx and a real ctx with a `drivers` net, each made with a `signal` aborted or not, add and remove no window listener.
- Before the abort a dispatched `online` reaches `observe` as one `net` event; after it, none; the ctx's `clock`, `random` and `storage` still work.
- `Ctx` and `SimCtx` have no `dispose` (type-level: `// @ts-expect-error` on `ctx.dispose()`), and `'dispose' in ctx` is false for a real, shell and sim ctx.
- A served page of two islands resumed with the generated entry under a stub `window`: when one island's component has run with its `ctx`, a dispatched `offline` still reaches `observe` as one `net` event.
