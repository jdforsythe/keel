# RFC 0181: k.store: a `tx` in a component body is E1304; a view store seeded from loader data is created with it

Status: accepted (ADR-0203). From walkthrough finding L4-1 (`tasks/p1/walkthrough-findings.md`).

## Decisions
- D1: E1304 (k.store, a free number in E130x): `keel check` reports a `tx` call that runs while a component builds. That is a `tx` in the component function's own body outside any nested function, or in a function that is a `For`, `If`, `Match`, `Case` or `Boundary` child, since each of those renders at build (k.component Build). A `tx` in any other nested function (an event handler, an `effect` or `computed` callback, a helper) is none. The rule is partial: it does not follow a call into another function. It is an error, since the write throws E1201 at run time in every render path.
- D2: the fix hint names the way that exists: create the view store in the body with the loader data as `initial`, `store(S, props.data…, { id })`, or call `tx` in an event handler. The rejected alternative, a new seeding API, is in Alternatives.
- D3: k.store states the seeding way in one paragraph, **View stores**. A store a component creates is owned by its scope and disposed with it. It starts from `initial` on the server and in a client router, and from its `#k-state` snapshot at resume (k.resume Stores, "one an island creates"). Transactions on it come from a factory, as a server `stores` factory makes them (k.server). No code changes for this: it is what `store`, `transaction` and resume do now, stated where an author looks.
- D4: E1201 keeps its meaning. A `tx` in a body that E1304 does not see (through a helper) still throws E1201 at render, and `renderRoute` raises it.
- D5: k.store goes from `conformance-covered` to `implemented` until its two new clauses, in the ledger at `none`, are covered. Nothing becomes `frozen`.

## Problem
An app author seeded the client list store from loader data with `run(tx(hydrate, { items: props.items }))` at the top of `ShoppingList`. The keel-server skill led there: "A client view store changes only through a transaction: after a write, re-read through the service and `tx` the result into a `hydrate` transaction". That sentence is about a write's answer, but nothing tells an author how a store gets its first value from a loader.

A store's commit sets its signals in a `batch` (`packages/store/src/store.ts`). The router renders a page inside a reaction, and no effect's `writes` holds a store's signals, so the write throws E1201 "write to a signal not declared in this effect's writes" (`packages/reactive/src/signal.ts`). Before the fix in a68e13e5, `renderRoute` swallowed the throw and rendered an empty page with no diagnostic. It now rejects naming E1201, but only when the page is rendered, and the message names a signal and an effect the author never wrote. `keel check` says nothing.

The way that works exists and is undocumented. `store(schema, initial, { id })` may run in a component's scope (k.store Registries; the store is disposed with the scope), and at resume a store an island creates starts from its snapshot (k.resume Stores; `packages/runtime-dom/conformance/leave-restore.test.ts`). The author instead moved the items into a `signal` seeded from props, losing the store's log and `undo`.

## Proposal
- k.store **View stores** (new paragraph): a component seeds a view store from loader data by creating it in its body with the data as `initial` and an explicit `id`, through a factory that also returns its transactions: `const listStores = (items: Item[]) => { const list = store(List, { items }, { id: 'shopping.list' }); return { list, add: transaction(list, 'shopping.add', AddItem, addFn) } }`, called as `const s = listStores(props.data.items)`. Each render of the component creates it anew from that render's data; at resume it starts from its `#k-state` snapshot. After a write, a handler re-reads and `tx`es the answer into the store (`hydrate`).
- k.store **Rules**: E1304 `tx` called while a component builds. Fix: create the store with the data as `initial`, or call `tx` in an event handler.
- Skill text (the build writes it): keel-server's sentence becomes "A client view store starts from loader data by being created in the component with it as `initial` (`keel docs k.store`, View stores); after a write, re-read through the service and `tx` the answer into a `hydrate` transaction in the handler. A `tx` in a component body is E1304." keel-client gains the same first clause under its store paragraph.

## Alternatives
- **A seeding API** (`seed(store, value)` or a store option read from the route). Rejected: a write at build is the thing E1201 forbids. Server and client would each have to apply it before any reader, and a module store cannot be written during a request (E1256). Creating the store with `initial` already gives that order.
- **Let `tx` run in a body and treat it as initial state.** Rejected: one call would be a logged write in a handler and an unlogged seed in a body, and `undo` would differ by caller.
- **A warning, not an error.** Rejected: the call always throws E1201 at run time.
- **Only a better E1201 message at render.** Rejected as the cure: the fault would still surface only when a test renders the page. The run-time path stays as D4 says.

## Spec diff
Applied in this commit:
- **k.store** (status `implemented`, D5): new paragraph View stores; Rules gain E1304 with its partial note. Conformance gains clauses 24 and 25.
- **Map**: the k.store row reads `implemented`.
- **Ledger**: `k.store#24` and `k.store#25` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0181`, from the spec text alone:
- `packages/check/conformance/`, k.store 24: a component file with `tx(t, p)` at the top of its body is one E1304, and so is one in a `For` row function. Its twins are clean: the call in an `onClick` arrow, in an `effect` callback, or in a top-level helper the body calls.
- `packages/testing/conformance/` (or `packages/store/conformance/`), k.store 25: a page whose component creates `store(S, { items: props.data.items }, { id: 'v.list' })` in its body, under `renderRoute`, shows the loader's items. A click whose handler `tx`es one of its transactions shows the change, and `state()` holds `v.list`. `resumeDocument` of the page's document from `createApp` gives `state()['v.list']` equal to the server's.
Spec topics: `pnpm spec k.store`; for context `pnpm spec k.resume`, `pnpm spec k.component`, `pnpm spec k.reactive`.

## Build
- `@keel/check`: rule E1304 (component files; the build-time positions of D1) and its `EXPLANATIONS` entry with the fix.
- Docs: the keel-server and keel-client skill text above; `apps/household`'s `ShoppingList` may move back to a store.

## Known limits
- E1304 does not follow a call: `seedList(props)` whose body calls `tx` is left to E1201 at render.

## Migration
None: unreleased.

## Token impact
k.store 6,000 to 7,356 characters (1,839 tokens), under the 1,875-token section budget. No budget moves.
