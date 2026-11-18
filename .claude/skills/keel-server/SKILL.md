---
name: keel-server
description: "Keel server state: loader/action stores factories, per-request restore and save over ctx.storage, keel.conflict 409, caller and undoWhere, user and identity.server.ts, runners; E1558, E1551, E1579"
---

# Server state

Spec: `pnpm spec k.server`, `k.topology`, `k.user`. A `node` deployable owns the data.

**Factory:** `boardStores = () => { const board = store(Board, init, { id: 'api.board' }); return { board, addTodo: addTodo(board) } }`; every store has an explicit `id`. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; an action's `ok` saves the changed ones, `err` none; when another request saved any since, 409 `keel.conflict`.
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ stores }) => ok(...))
export const postTodo = action({ input: TodoDraft, params: ListParams, stores: boardStores }, (input, { params, caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
Undo one caller's writes: `stores.board.undoWhere((e) => e.meta?.caller === caller)`. `caller` hashes an anonymous signed cookie (a write with none gets one) and grants nothing.

**User:** Keel authenticates no one. `identity.server.ts` beside `topology.ts`: `export default identity({ identify: async ({ request }) => libSession(request)?.id ?? '', handle: { path: '/auth', fn: (req) => lib.handler(req) } })` (`@keel/server`). Guards, loaders and actions get `user` beside `caller` (`''`: no one); `handle` hosts the library's sign-in endpoints and cookies (E1579: a route under its path).

An API route's action declares `output`; its handlers also get `bearer` (keel-api).

**Where:** `loader`/`action` only in `*.server.ts` (E1551). A loader or action naming `stores`, or a live loader, in a module a `client` or `static` deployable serves is E1558: place it in a `node` one. Server code never writes module-level stores (E1256 in a request and work it schedules).

**Background work:** `export const runners = [...]` (`{ run(ctx, signal) }`) in `modules/<id>/runners.server.ts`; a rejection reruns it 1 s later.

**Tests:** `renderRoute(id, { user })` runs `stores` factories over the harness ctx's `ctx.storage` (keel-testing). Concurrent writes, outbox: keel-writes.
