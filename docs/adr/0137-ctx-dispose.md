# ADR-0137: `ctx.dispose()` removes the window listeners (RFC 0115)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** Each real or shell ctx whose net `createCtx` built adds a window `online` and `offline` listener, and nothing removed them; `Ctx` had no member that ends a ctx. A window that sees many real ctxs (tests under happy-dom, dev reloads) gathered two listeners per ctx.

**Decision.**
- D1: `Ctx` gains a required `dispose(): void`.
- D2: on a real or shell ctx it removes the `online` and `offline` listeners its own net added, once each, and stops nothing else; the ctx stays usable and `online()` still reads `navigator.onLine`.
- D3: a repeat call, a sim ctx, a `drivers` net and a runtime without `window` do nothing.

**Alternatives.**
- A free `disposeCtx(ctx)`: keeps object literals compiling, but puts the teardown outside the type that holds the listeners.
- `FinalizationRegistry`: timing is the engine's.
- A `dispose` that also aborts waits and fetches: a second meaning nothing needs.
- The sim net's retained kill functions: deferred to its own line.

**Consequences.**
- A caller that creates real ctxs repeatedly can release their window listeners.
- An object literal typed `Ctx` must carry `dispose`; five test files in the repo change, and spreads of a ctx carry it already.
