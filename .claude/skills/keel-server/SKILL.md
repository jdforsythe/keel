---
name: keel-server
description: "Keel server state: loader/action stores factories, per-request restore and save over ctx.storage, keel.conflict 409, caller and undoWhere, runners; E1558, E1551"
---

# Server state

Spec: `pnpm spec k.server`, `k.topology`. A `node` deployable (e.g. `api`) owns the data.

**Factory:** `boardStores = () => { const board = store(Board, init, { id: 'api.board' }); invariant(board, fn); return { board, addTodo: addTodo(board) } }`, `addTodo = (board) => transaction(board, 'api.addTodo', schema, fn)`; every store has an explicit `id`. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; an action's `ok` saves the changed ones; `err` saves none; when another request saved any of them since, it answers 409 `keel.conflict`.
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ stores }) => ok(...))
export const postTodo = action({ input: TodoDraft, params: ListParams, stores: boardStores }, (input, { params, caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
Undo one caller's writes: `stores.board.undoWhere((e) => e.meta?.caller === caller)`. `caller` is a hash of the signed cookie (`""` before the first write).

An API route's action declares `output` and returns `ok(value)` of its type, and its guards, loaders and actions get `bearer` beside `caller` (keel-api).

**Where:** `loader`/`action` only in `*.server.ts` (E1551). A loader or action naming `stores`, or a live loader, in a module a `client` or `static` deployable serves is E1558; place that module in a `node` deployable. Server code never writes module-level stores.

**Background work:** `export const runners = [...]` (`{ run(ctx, signal) }`) in `modules/<id>/runners.server.ts`; a rejected `run` runs again 1,000 ms later.

**Tests:** `renderRoute` runs `stores` factories over the harness ctx's `ctx.storage` as a `node` deployable does, so a page it renders is tested like any other (keel-testing). Concurrent writes and the outbox: keel-writes.
