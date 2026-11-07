---
name: keel-api
description: "Build a Keel data API: node api module, loaders/actions with stores, @keel/services client, hydrate and syncAfter, createApp, server tests"
---

# API module + client

Spec: `pnpm spec k.server`, `k.services`. Deployables `web` (client) and `api` (node; owns the data).

**Server stores:** factory `boardStores = () => { const board = store(Board, init, { id: 'api.board' }); invariant(board, fn); return { board, addTodo: addTodo(board) } }`, `addTodo = (board) => transaction(board, 'api.addTodo', schema, fn)`. Per request: restored from `ctx.storage`, saved after `ok` (race: 409 `keel.conflict`).
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ stores }) => ok(...))
export const postTodo = action({ input: TodoDraft, params: ListParams, stores: boardStores }, (input, { params, caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
`routes.ts`: `'api.lists': { path: '/api/lists', loader: loadBoard, actions: { POST: postList }, component: BoardApi }` (plain `.ts`). Undo: `stores.board.undoWhere((e) => e.meta?.caller === caller)`. Status: notFound 404, denied 403, `keel.fields` 422, conflict 409, else 400; bodies are `application/json` Results.

**Serve:** `createApp({ topology, routes, ctx: createCtx({ mode: 'real' }), deployable: 'api' })`; `node --experimental-webstorage server.ts`.

**Client:** `endpoints({ lists: { method: 'GET', path: '/api/lists', output: BoardReply, errors: { 422: FieldsReply } } })`; `service({ base, schema })` built per call: base `new URL(url).origin` in `*.server.ts` (never `location` there), `location.origin` in components. `await api(origin).lists({}, ctx)` gives `Result<Out, ApiError>`. Bodies: GET `{ id, results: { 'api.lists': { ok: true, value } } }`; action `{ ok: true, value }`.

**View store** (optional): only `hydrate = transaction(view, 'todos.hydrate', BoardView, (_s, d) => d)` changes it; `syncAfter(ctx, write)` writes, then re-reads. Client actions return `ok(null)` or `ok(to)`.

**Tests:** `app = await createApp(...)` (sim ctx); `app.fetch(new Request(url, { method, headers: { accept: 'application/json', 'content-type': 'application/json' }, body }))`. Client tests route sim `ctx.net` `/api/*` to `app.fetch`.
