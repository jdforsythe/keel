---
name: keel-api
description: "Build a Keel data API: an api module in a node deployable, loaders/actions with JSON Result bodies, @keel/services client, view store with hydrate and syncAfter, createApp, server tests"
---

# API module + client (golden-1 pattern)

Spec: `pnpm spec k.server`, `k.services`.
**Topology:** `topology({ web: { modules: ['todos'], adapter: 'client' }, api: { modules: ['api'], adapter: 'node' } })`.

**api module** (owns the data): `board.ts` = shared `store` + `invariant`; `addTodo.ts` = `transaction(board, 'api.addTodo', schema, fn)`; `routes.ts` = `manifest({ 'api.lists': { path: '/api/lists', loader: loadBoard, actions: { POST: postList }, component: BoardApi } })`. Loaders and actions live in `*.server.ts`:
```ts
export const loadBoard = loader({ output: BoardView }, async () => ok({ ... }))
export const postTodo = action({ input: TodoDraft, params: ListParams }, (input, { params, url }, ctx) =>
  missing ? err({ code: 'keel.notFound', message, data }) : ok(null))
```
`params`/`search` come from the route's own schema values (never annotate `fn`, E1507); `url` is the absolute request URL (use `new URL(url).origin`, never `location`, in `*.server.ts`). Mint ids with `ctx.random.id('Todo')`. Status: notFound 404, denied 403, `keel.fields` 422, other err 400.
Api components are plain `.ts` (no JSX).

**Serve:** `createApp({ topology, routes, ctx: createCtx({ mode: 'real' }), deployable: 'api', expose: [board] })` then `serve`. `deployable` is required with several; `expose` snapshots module stores into `#k-state`.

**Client** (`todos`): `endpoints({ lists: { method: 'GET', path: '/api/lists', output: BoardReply } })` in `todos.service.ts`; build `service({ base: location.origin, schema: todos })` at call time. Call `await todosApi().createList({ body }, ctx)` -> `Result<Out, ApiError>` (`api.status|decode|input|network|timeout`). Outputs are the runtime Result: `{ ok: true, value }`, loader reply `results['api.lists'].value`, 422 via `errors: { 422: FieldsReply }`.

**View store:** `view = store(BoardView, ...)` changed only by `hydrate = transaction(view, 'todos.hydrate', BoardView, (_s, d) => d)`. `refreshView(ctx)` reads and `tx(hydrate, data)`; `syncAfter(ctx, write)` awaits a write, then refreshes. Client actions: `r.ok ? ok(null) : err(r.error)`.

**Server tests:** `const app = await createApp(...)` with sim ctx; `app.fetch(new Request('http://localhost/api/lists', { headers: { accept: 'application/json', 'content-type': 'application/json' }, method, body: JSON.stringify(b) }))`. Client tests: route `/api/*` of sim `ctx.net` to `app.fetch`.
