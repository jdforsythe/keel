---
name: keel-api
description: "Build a Keel data API: an api module in a node deployable, loaders/actions with JSON Result bodies, @keel/services client, view store with hydrate and syncAfter, createApp, server tests"
---

# API module + client (golden-1 pattern)

Spec: `pnpm spec k.server`, `k.services`.
**Topology:** `topology({ web: { modules: ['todos'], adapter: 'client' }, api: { modules: ['api'], adapter: 'node' } })`.

**api module** (owns the data, RFC 0044): `boardStores.ts` = factory `() => { const board = store(Board, init, { id: 'api.board' }); invariant(board, ...); return { board, addTodo: addTodo(board) } }`; `addTodo.ts` = `(board: Store<Board>) => transaction(board, 'api.addTodo', schema, fn)`; `routes.ts` = `manifest({ 'api.lists': { path: '/api/lists', loader: loadBoard, actions: { POST: postList }, component: BoardApi } })`. Loaders and actions live in `*.server.ts` and name the factory; each request gets its own instance, restored from `ctx.storage` and saved after an `ok` (409 `keel.conflict` if another request saved first):
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ caller, stores }) => ok({ ... }))
export const postTodo = action({ input: TodoDraft, params: ListParams, stores: boardStores }, (input, { params, caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
Undo own writes: `stores.board.undoWhere((e) => e.meta?.caller === caller)`; `canUndo` = `board.log().at(-1)?.meta?.caller === caller`. Never write a module-level store from server code.
`params`/`search` come from the route's own schema values (never annotate `fn`, E1507); `url` is the absolute request URL (use `new URL(url).origin`, never `location`, in `*.server.ts`). Mint ids with `ctx.random.id('Todo')`. Status: notFound 404, denied 403, `keel.fields` 422, `keel.conflict` 409, other err 400.
Api components are plain `.ts` (no JSX).

**Serve:** `createApp({ topology, routes, ctx: createCtx({ mode: 'real' }), deployable: 'api' })` then `serve`; `deployable` is required with several. On Node run `node --experimental-webstorage --localstorage-file=.api.storage server.ts` so `ctx.storage` persists.

**Client** (`todos`): `endpoints({ lists: { method: 'GET', path: '/api/lists', output: BoardReply } })` in `todos.service.ts`; build `service({ base: location.origin, schema: todos })` at call time. Call `await todosApi().createList({ body }, ctx)` -> `Result<Out, ApiError>` (`api.status|decode|input|network|timeout`). Outputs are the runtime Result: `{ ok: true, value }`, loader reply `results['api.lists'].value`, 422 via `errors: { 422: FieldsReply }`.

**View store:** `view = store(BoardView, ...)` changed only by `hydrate = transaction(view, 'todos.hydrate', BoardView, (_s, d) => d)`. `refreshView(ctx)` reads and `tx(hydrate, data)`; `syncAfter(ctx, write)` awaits a write, then refreshes. Client actions: `r.ok ? ok(null) : err(r.error)`; to navigate instead, `const to: Href = routes.href(id, params); return ok(to)` (the module's own `routes`; never a string path).

**Server tests:** `const app = await createApp(...)` with sim ctx; `app.fetch(new Request('http://localhost/api/lists', { headers: { accept: 'application/json', 'content-type': 'application/json' }, method, body: JSON.stringify(b) }))`. Seed/read the board through the api ctx's `storage` (`keel.store.api.board`). Client tests: route `/api/*` of sim `ctx.net` to `app.fetch`. Direct `fn` calls pass `{ params, url, caller, stores }`, stores from the factory inside `scope`.
