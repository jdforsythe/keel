# ADR-0158: a ctx is ended only by the code that made it (RFC 0136)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** `Ctx.dispose()` removes a real or shell ctx's window `online`/`offline` listeners. The page has one ctx, which `resume` hands to every island and the client entry to the router and root, so any component can call `dispose` and end `net` events for the whole page. The ctx is frozen and identity-keyed by the registry, `ctxMeta` and `observe`, so no second object can stand in for it. The only callers are `std-sessions`' sinks, which dispose a ctx they made.

**Decision.**
- C1: `createCtx({ signal })`: aborting `signal` removes the listeners once; an aborted signal adds none; sim and `drivers` nets ignore it. `Ctx` and `SimCtx` have no `dispose`, at the type and at runtime: the `AbortController` is the ownership, and no holder of the ctx reaches it.
- C2: generated entries and servers pass no signal; `std-sessions`' sinks pass `AbortSignal.abort()`.
- C3: k.ctx's `dispose` API entry and conformance bullet 18 are rewritten with the conformance and build commits, so the ledger never lowers.
- C4: the contract lives in a new section, k.owner.

**Alternatives.** A view per island (breaks every identity-keyed table). A type split only (the shared object still carries a callable `dispose`). `createCtx` returning `{ ctx, dispose }` (changes every caller for two). An internal `disposeCtx` (any package holding the ctx could call it). A no-op `dispose` for islands (a silent member).

**Consequences.**
- `@keel/ctx` removes a public member; test wrappers drop a `dispose` property; the golden-1-api eval helper changes call shape only.
- A test that makes real ctxs under one window passes and aborts a signal.
