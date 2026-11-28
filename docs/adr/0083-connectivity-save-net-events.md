# ADR-0083: connectivity on `ctx.net`, and `save` and `net` observer events (RFC 0081)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1 and 6.

**Context.** `ctx.net` has no online state, the sim net cannot go offline, and `navigator.onLine` in app code would be an ambient read. A push needs to know a write landed, which only the server knows after its save. A replay needs to reproduce an offline window.

**Decision.** In k.sync. `ctx.net.online()`: real and shell read `navigator.onLine` and the window's `online` and `offline` events (true without a `navigator`); sim starts online and `setOnline(b)` on the sim net makes `fetch` reject with a `TypeError` and errors each open sim response body. Each change is `{ kind: 'net', online }` to `observe`. After an action's save, k.server reports each saved store as `{ kind: 'save', store, head }` on the server ctx, in save order; a refused or `err` action reports none. Neither event is replayed to a later observer. std.sessions records `net` as an input, and replay applies it with `setOnline`.

**Alternatives.**
- A connectivity capability registered by std-offline, rejected: it could not make the sim `fetch` fail, and channels and live would depend on the offline package.
- An explicit `publish` from actions, rejected: it runs before the save, which can still be 409.
- A `createApp({ onSave })` option, rejected: `observe` is the kernel's existing event tap.

**Consequences.**
- k.ctx goes to 1,496 tokens and k.server to 1,499 (after RFC 0080), each a pointer to k.sync; `SessionEvent` gains `net`.
- The only `CtxEvent` consumer outside `@keel/ctx`, `@keel/std-sessions`, records `net` and ignores `save`.
- `@keel/ctx` grows about 0.15 kB inside its budget.
