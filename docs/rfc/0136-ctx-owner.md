# RFC 0136: a ctx is ended only by the code that made it: `createCtx` takes a `signal`, and `Ctx` has no `dispose`

Status: implemented (ADR-0158).

## Problem
Each claim below was read in the code on 2026-11-18.

`dispose` is a member of the public `Ctx` (`packages/ctx/src/Ctx.ts`), added for `@keel/std-sessions` (rfc:0115) so a sink could drop the window `online`/`offline` listeners of a ctx it made only for `random`. On a real or shell ctx whose net is its own it removes those two listeners (`packages/ctx/src/internal/realNet.ts`); on a sim ctx or a `drivers` net it does nothing.

The page has one ctx: the generated resume entry (`packages/compiler/src/entry/resumeEntry.ts`) makes `createCtx({ mode: "real" })` and `resume` passes it to every island root (`packages/runtime-dom/src/ops/resume.ts`); the client entry (`packages/compiler/src/internal/entryCode.ts`) gives the same ctx to `createRouter` and `mount`. A component gets it as its third argument, typed `Ctx`, so any island can call `ctx.dispose()`, and from then on no island, no `@keel/std-offline` outbox and no `observe` sees a `net` event: one component cuts connectivity reporting for the whole page. The ctx is frozen and identity-keyed (`register`'s instances, `ctxMeta`, `hubs` are `WeakMap`s keyed by the ctx), so a second object cannot stand in for it.

No entry and no server ever calls `dispose` (a server ctx has no window). The only callers in source are `std-sessions`' real and shell sinks (`session.ts`, lines 17 to 19 and 47 to 49), each disposing a ctx it made. Everything else passes it through in object literals typed `Ctx` (Migration).

## Proposal
A new section `k.owner` (status proposed), since k.ctx (5,993 characters) is full.

### D1. `createCtx` takes `signal`; `Ctx` has no `dispose`
`createCtx({ ..., signal?: AbortSignal })`. A real or shell ctx with its own net adds its listeners when made and removes each once when `signal` aborts; made with an aborted signal it adds none. Sim and `drivers` nets ignore it. `Ctx` and `SimCtx` lose `dispose`, and the object `createCtx` returns has no such property. Ownership is the `AbortController`: the maker holds it, and nothing reachable from the ctx reaches it, so a non-owner gets `clock`, `random`, `net`, `storage` (and the registry and `observe` through it) and no way to end the listeners. The ctx stays usable after the abort.

Why `signal`: it is how the platform already ends a listener (`addEventListener(type, fn, { signal })`) and how this package already cancels (`clock.after(ms, signal)`), so it adds no new idea (principle 9). It is one optional field: no `createCtx` call changes except the one that needs an ending. The type and the runtime agree: no cast, `in` test or reflection finds an ending on the ctx.

### D2. Owners
The generated entries make the page ctx with no signal (it lives with the page). Servers take none. `std-sessions`' sinks pass `AbortSignal.abort()`: the ctx never adds a listener, which is what the sink wanted from `dispose()` at once. A test making many real ctxs under one window passes a signal and aborts it.

### D3. k.ctx's clauses move with the conformance
k.ctx's API entry ("`ctx.dispose()` (removes only ...)") and its conformance bullet 18 ("Under a stub `window`, a real ctx's `dispose()` removes its `online` and `offline` listeners once each; a repeat removes nothing.") describe the code until the build. Rewording bullet 18 now lowers the ledger (`k.ctx#18 example -> none`, measured), so commit 1 leaves k.ctx as it is and the change lands in two steps:
- Commit 2 (conformance, `rfc:0136`): bullet 18 becomes "Under a stub `window`, aborting the `signal` a real ctx was made with removes its `online` and `offline` listeners once each; a second abort removes nothing.", with `packages/ctx/conformance/dispose-listeners.test.ts` rewritten to quote it; k.ctx goes to `implemented` in the section and the map.
- Commit 3 (build): the API entry's `ctx.dispose()` clause becomes "no `dispose`: only the ctx's maker ends it, with `createCtx`'s `signal` (k.owner)" (5,947 characters with both edits, measured); k.ctx and k.owner go to `conformance-covered`.

## Alternatives
- **A view per island** (a frozen copy without `dispose`). Breaks every identity-keyed table (`register` instances, `ctxMeta`, `observe` hubs, `seedOf`): each would need to map a view to its root, and a capability would get a second instance per view.
- **Type split only** (`Ctx` without `dispose`, `createCtx` returning `OwnedCtx`). Smallest diff, but the shared object still carries `dispose`, and `'dispose' in ctx && typeof ctx.dispose === 'function'` calls it with no cast; the hole stays open at runtime.
- **`createCtx` returns `{ ctx, dispose }`.** Changes the return of the most-called kernel function in every test and entry for a need of two call sites.
- **`disposeCtx(ctx)` in `@keel/ctx/internal`.** E1576 keeps it out of app code, but any package holding the page ctx (a std widget) could still call it; ownership by import rule, not by holding.
- **A no-op `dispose` on the ctx islands get.** A member that silently does nothing invites the bug it hides.

## Spec diff
- New `spec/kernel/k.owner.md`, status proposed: intro, API, Owners, five Conformance bullets. 2,223 characters, 556 tokens; `pnpm spec k.owner` prints the same.
- `spec/00-map.md`: a row `k.owner | Ctx owner | proposed | only its maker ends a ctx`; one-line cells trimmed (k.prefix, k.router, k.forms, k.sync, k.shell, k.aria, k.head), no title or status changed. 1,199 to 1,200 tokens.
- k.ctx unchanged in this commit (D3 gives its later text). No bullet reordered or renumbered; no status changes, so the ledger does not move.

## Conformance diff
One `rfc:0136` commit by the `conformance-writer`, files headed `Spec: k.owner` (and `Spec: k.ctx` for bullet 18).

**Listeners** (`packages/ctx/conformance/owner-signal.test.ts`, a stub `window` counting `addEventListener`/`removeEventListener` by type):
- `createCtx({ mode: 'real', signal })`: one `online` and one `offline` added; `abort()`: each removed once; a second `abort()` (a no-op on an `AbortController`) and a later `online` dispatch remove nothing more.
- `createCtx({ mode: 'real', signal: AbortSignal.abort() })`: none added, none removed.
- `mode: 'shell'`: as real.
- Negative: `mode: 'sim'` with a live and with an aborted signal; `mode: 'real'` with `drivers: { net }` and a signal, aborted: no listener added or removed. A real ctx with no `signal`: the two added, none removed after any number of events.
- Before `abort()`, dispatching `offline` gives one `observe` event `{ kind: 'net', online: false }`; after it, none. After the abort `clock.now()`, `random.float()` and `storage.set`/`get` still work.

**No member** (`packages/ctx/conformance/owner-type.test.ts`):
- `ctx.dispose()` does not typecheck for `Ctx` and for `SimCtx` (`expectTypeOf<Ctx>().not.toHaveProperty('dispose')`).
- `'dispose' in createCtx({ mode })` is false for `real`, `shell` and `sim`; `Object.keys` of each is `clock`, `random`, `net`, `storage`.
- A `Ctx` object literal with exactly `clock`, `random`, `net`, `storage` type-checks.

**Page** (`packages/server/conformance/owner-page.test.ts`, happy-dom with a stub `window`): a served page with two islands, resumed through the generated resume entry; island A's component enumerates its `ctx` (own and prototype properties) and finds no function other than the four capabilities' members; after both islands render, dispatching `offline` on the window reaches an `observe` on the page ctx as one `net` event.

**Bullet 18** (`packages/ctx/conformance/dispose-listeners.test.ts`, rewritten): the D3 text, with `signal` in place of `dispose()`.

## Migration
- `@keel/ctx`: `Ctx.ts` and `SimCtx.ts` drop `dispose`; `CtxOptions` gains `signal`; `createCtx.ts` and `internal/realNet.ts` add the listeners with the signal (`addEventListener(..., { signal })`, or a listener on `abort`); `README.md` Public API and Invariants (`dispose()` and "calls `dispose()` on each when done") move to `signal`.
- `@keel/std-sessions` `src/session.ts` (real and shell sinks): `createCtx({ mode: 'real', signal: AbortSignal.abort() })` (and `'shell'`), the `own.dispose()` lines removed; `test/session-listeners.test.ts` asserts no listener added.
- Tests that pass `dispose` through an object literal drop the property: `packages/server/test/saveFixture.ts` (line 57), `packages/server/test/serializable.property.test.ts` (87), `apps/golden-1/test/removal.test.ts` (147), `apps/golden-1/test/removalParts.test.ts` (85), `packages/std-jobs/test/twoProcesses.property.test.ts` (27), `packages/std-offline/test/storageFaults.test.ts` (41 and 79).
- `packages/ctx/test/dispose.property.test.ts`: aborts a signal instead of calling `dispose()`.
- `evals/tasks/golden-1-api/acceptance.test.ts` `gated(sim)` (lines 96 to 118): the `Ctx` literal drops `dispose: sim.dispose`; a call-shape change only, nothing else in the helper moves.
- `.claude/skills/keel-testing/SKILL.md`: "calls `ctx.dispose()` when done" becomes "passes a `signal` and aborts it when done".
- Entries (`resumeEntry.ts`, `entryCode.ts`, `devEntryCode.ts`), `server/src/internal/start.ts`: unchanged (no signal).
- App code: nothing under `apps/*/modules` or `apps/*/src` calls `ctx.dispose`.

## Build order
1. This RFC, ADR-0158 and k.owner (commit 1).
2. `conformance-writer`: the conformance diff and bullet 18 (commit 2), red; k.ctx to `implemented`.
3. Builders (commit 3): `@keel/ctx`, `@keel/std-sessions`, the Migration, a changeset (`@keel/ctx` major in the semver sense: a public member removed), k.ctx's API entry (D3); k.ctx and k.owner to `conformance-covered`.

## Token impact
k.owner 556 tokens (new). k.ctx 1,499 to 1,487 after D3. Map 1,199 to 1,200.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: `createCtx`'s `signal` ends a ctx; `Ctx` and `SimCtx` have no `dispose`, at the type and at runtime.
- C2: entries and servers pass no signal; `std-sessions` passes an aborted one.
- C3: k.ctx's `dispose` text changes with the conformance and the build (D3), so commit 1 lowers no rung.
- C4: a new section, k.owner, because k.ctx is full.

## Amendment (bullet 4 without the directive)
Bullet 4 of k.owner states the type fact without quoting a compiler directive: a verbatim quote of the directive in a conformance header is read as the directive by the structure lint (S0004), and a header without the quote leaves the bullet uncovered. The bullet now reads: "A call to `dispose` on a `Ctx` or a `SimCtx` does not typecheck, and neither type has a `dispose` member. `'dispose' in ctx` is false for a real, shell and sim ctx."
