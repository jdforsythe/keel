# RFC 0115: k.ctx: `ctx.dispose()` removes the window listeners

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0496. ADR-0137 records it.

## Problem
`packages/ctx/src/internal/realNet.ts` adds a window `online` and a window `offline` listener for each real or shell ctx whose net is the platform one (no `drivers.net`), and nothing removes them. `createCtx` holds the ctx through a `WeakRef` so the listener does not keep the ctx alive, but the two closures stay on `window` for the life of the page. A page or test that creates many real ctxs in one window (a test file under happy-dom creating one per case, a dev page re-created on reload of a module) gathers two listeners per ctx, each reading `navigator.onLine` on every connectivity change. `Ctx` has no member that ends a ctx, so a caller has no way to take them off.

The sim net keeps a kill function per open response body until the body ends; that is a separate retention and is deferred (see Alternatives).

## Proposal
`Ctx` gains one required member, `dispose(): void`.

- On a real or shell ctx whose net `createCtx` built, it calls `window.removeEventListener` with the `online` and `offline` listeners that net added, once each. After it, the ctx reports no further `net` event to `observe`; `ctx.net.online()` still reads `navigator.onLine` at call time, so it stays correct.
- It stops nothing else: `clock.after` waiters, fetches in flight, storage, observers and registered capabilities keep working, and the ctx stays usable. It ends the window's hold on the ctx, not the ctx.
- A second call does nothing. A sim ctx's `dispose` does nothing observable (its net adds no window listener), and neither does a ctx whose net came from `drivers` (that net is the caller's; `createCtx` added no listener for it). Where there is no `window`, no listener was added and `dispose` does nothing.

`createCtx` builds `dispose` as a closure over the listener pair (`realNet` returns its remover beside the `Net`), so the frozen ctx keeps its shape: `{ clock, random, net, storage, dispose }`.

## Alternatives
- A free function `disposeCtx(ctx)` beside `seedOf`: no new required member, so no object literal breaks; but a ctx's teardown would sit outside the type that owns the listeners, and a hand-built ctx could not say what it holds. Rejected for the member the backlog line names.
- Removing the listeners when the ctx is garbage collected (`FinalizationRegistry`): timing is up to the engine, and a test cannot rely on it.
- A `dispose` that also aborts `clock.after` waiters and fetches: a second meaning beside a scope's dispose (k.reactive); nothing needs it.
- The sim net's retained kill function for each open body: deferred. It is released when the body ends or errors, and the sim ctx is not tied to a window; a later backlog line takes it if a long sim run shows the cost.

## Spec diff
k.ctx, the API paragraph, whole new text (before 5,736 characters; after 5,993):
```
**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?): Promise<void>`, `ctx.random.float()`, `ctx.random.id(brand): Id<B>` (a v4 uuid as `s.id(brand)`; the one way to mint an id or token), `ctx.net.fetch(req)`, `ctx.storage` (k.persist), `ctx.dispose()` (removes only the window `online`/`offline` listeners a real or shell ctx's own net added; a repeat call or a sim ctx does nothing). Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns the accessor `(ctx) => Impl`, the only access path; a factory's seed derives from the ctx seed and the name; `capabilities()` lists names; re-registering the identical implementations object returns the same accessor; another duplicate is E1602. Sim mode, schedules and plans: k.sim.
```
To pay for it, three sentences tighten with their meaning unchanged:
- Observers, first sentence: "`observe(ctx, fn): () => void` calls `fn` synchronously with each kernel event on `ctx`, in order, until the returned function runs; its throws are dropped."
- Rules, first list: "`Date` (`.now`, `new Date()`, `Date()`)"; "Found through `globalThis`/`window`/`self`, literal computed keys (`const` strings too) and same-file bindings (aliases, parameter defaults, destructuring), by lexical scope."
- Rules: "E1603 `eval`, `Function(...)` or `new Function(...)` in app code, …" and "Neither follows values through calls or files, nor E1601 through object literals or a reassigned binding."

No conformance header quotes a tightened sentence. Conformance, appended as the last bullet:
```
- Under a stub `window`, a real ctx's `dispose()` removes its `online` and `offline` listeners once each; a repeat removes nothing.
```

## Conformance diff
One `rfc:0115` commit by the `conformance-writer`:
- New `packages/ctx/conformance/dispose-listeners.test.ts`, citing the new bullet: `vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() })` and a `navigator` stub; `createCtx({ mode: "real", seed: 1337 })`; `dispose()` calls `removeEventListener` twice, with `"online"` and `"offline"` and the same function objects `addEventListener` received; a second `dispose()` adds no call. The same for `mode: "shell"`; under `mode: "sim"` and with `drivers: { net }`, `dispose()` calls neither spy. After `dispose()`, `ctx.net.online()` still returns `navigator.onLine`.
- No existing conformance file changes: none builds a `Ctx` object literal or asserts the ctx's keys.

## Migration
`Ctx` has a new required member, so an object literal typed `Ctx` that names each field fails to type-check until it carries `dispose` (from the ctx it wraps: `dispose: base.dispose`). In this repo, no source file outside `packages/ctx` builds a `Ctx`; these test files do:
- `packages/std-jobs/test/twoProcesses.property.test.ts:27`
- `packages/server/test/serializable.property.test.ts:87`
- `packages/server/test/saveFixture.ts:57`
- `apps/golden-1/test/removal.test.ts:147`
- `apps/golden-1/test/removalParts.test.ts:85`

Literals that spread a ctx (`{ ...base, storage }`) copy `dispose` and need no change: `packages/std-offline/test/lifetime.test.ts:104`, `packages/std-channels/test/channelRouteRecheck.test.ts:37`, `packages/services/test/client.example.test.ts:92` and `:116`. `SimCtx` extends `Ctx` and gains the member through `createCtx`. An app holding one ctx for the page needs no call; code that creates real ctxs repeatedly in one window calls `dispose` when done.

## Build order
1. Orchestrator: `spec/kernel/k.ctx.md` (done with this RFC). The `conformance-writer`: the new file above.
2. One ctx lane owns `packages/ctx/src/Ctx.ts`, `packages/ctx/src/createCtx.ts`, `packages/ctx/src/internal/realNet.ts`, `packages/ctx/test/**`, `packages/ctx/README.md`, the five test files under Migration, and a changeset (`@keel/ctx` minor: a new required member). It runs `check`, `build`, the ctx suite and the suites of `std-jobs`, `server` and `golden-1` once, and `pnpm budgets` (`@keel/ctx` grows by the remover).
3. Orchestrator: ledger, backlog 0496 closed (the sim-net part stays open as its own line), HANDOFF.

## Token impact
k.ctx 1,434 to 1,499 tokens (5,736 to 5,993 characters). No other section changes.

## Known limits
`packages/std-sessions/src/session.ts` builds its own real ctx inside its `real` and `shell` capability factories (lines 17 and 45) to mint session ids; each adds a listener pair that no one disposes, one per app ctx that reaches std.sessions. A capability factory has no teardown in k.ctx, so this RFC leaves them; the orchestrator files a backlog line for them.
