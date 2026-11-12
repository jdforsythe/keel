---
name: keel-api
description: "Build a Keel data API: node api module, loaders/actions with stores, @keel/services client, hydrate and syncAfter, createApp, server tests"
---

# API module + client

Spec: `pnpm spec k.server`, `k.services`, `k.hosting`. Deployables `web` (client), `api` (node; owns the data).

**Server stores:** factory `boardStores = () => { const board = store(Board, init, { id: 'api.board' }); invariant(board, fn); return { board, addTodo: addTodo(board) } }`, `addTodo = (board) => transaction(board, 'api.addTodo', schema, fn)`. Per request: restored from `ctx.storage`, saved after `ok` (race: `keel.conflict`).
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ stores }) => ok(...))
export const postTodo = action({ input: TodoDraft, params: ListParams, stores: boardStores }, (input, { params, caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
`routes.ts` (plain `.ts`): `'api.lists': { api: true, path: '/api/lists', loader: loadBoard }` (an API route has no `component`; the server answers it with JSON whatever `accept` says), then `routes.actions({ 'api.lists': { POST: postList } })`. Undo: `stores.board.undoWhere((e) => e.meta?.caller === caller)`. Bodies are `application/json` Results (`keel.fields` 422).

**Cycle:** `routes.ts` and an action returning `ok(routes.href(...))` import each other; import `routes.ts` first (tests too).

**Serve:** `keel build` writes `dist/<name>/server.mjs` per `node` deployable (no `server.ts`); run it with `PORT`, `KEEL_SECRET` (32+), `KEEL_ORIGIN`, `KEEL_PEER_<NAME>`. `keel dev` serves every deployable on one origin. A split edits `topology.ts` only (or `keel codemod place`).

**Serve the client:** `keel build` writes `dist/<name>/` per `client` deployable (`index.html`, hashed `assets/`, `keel-mark.svg`). `host: '<node deployable>'` on the client deployable copies it into that server, whose `GET /` then returns the app (`pnpm spec k.hosting`). For a static host, build with `KEEL_PEER_API=<origin>` (a `keel-peer` tag; `service({ module })` in a browser calls it with credentials), set `KEEL_ALLOW_ORIGINS` on the server, and keep both on one registrable domain so the caller cookie works. Guide: `docs/guide/deploy-client.md`.

**Between modules:** `service({ module: 'api', schema })` (module in `deps`, route in its `public.routes`); background work is `export const runners = [...]` in `modules/<id>/runners.server.ts`. A live loader is `loader({ output }, async function* ({ signal }) { yield ok(v) })`, read with an `events: true` GET endpoint (`for await (const r of api.feed({}, ctx))`).

**Client:** `endpoints({ lists: { method: 'GET', path: '/api/lists', output: BoardReply, errors: { 422: FieldsReply } } })`; `service({ base, schema })` per call: base `new URL(url).origin` in `*.server.ts`, `location.origin` in components. `await api(origin).lists({}, ctx)`: `Result<Out, ApiError>`. Bodies: GET `{ id, results: { 'api.lists': { ok: true, value } } }`; action `{ ok: true, value }`.

**View store:** only `hydrate = transaction(view, 'todos.hydrate', BoardView, (_s, d) => d)` changes it; `syncAfter(ctx, write)` writes, then re-reads.

**Concurrent writes:** `transaction(store, name, schema, fn, { concurrent: 'rebase' | 'reject' })`; `'reject'` is the default. A write carries `base` (the head its writer read); when `base` is not the head, `'rebase'` applies it to the current state (use it when the payload holds no value the writer read: a fresh id, a flip), `'reject'` answers 409 `keel.conflict` with `data.head`. Pass `base` to `tx` with the input's `write`.

**Channel (`@keel/std-channels`):** `export const boardChannel = channel('api.board', { path: '/api/board/events', params: s.object({}) })` in a shared file; `message` (a schema) allows `publish`. Server, in `*.server.ts`: `channelRoute(boardChannel, { id: 'api.boardEvents', stores: boardStores, member: () => true })`; list `{ api: true, path, loader }` in the manifest and pass `actions` to `routes.actions`. Client, in a scope: `subscribe(ctx, origin, channel, params, on)` returns `{ status, close }`; `publish(ctx, origin, channel, params, message)`. E2601, E2602.

**Live (`@keel/std-live`):** in a scope, `live(ctx, origin, boardChannel, {}, { read: (c) => api(origin).lists({}, c), hydrate })` re-reads after every save; `status()` is `connecting | live | offline | denied`. It replaces `syncAfter` for views other users change.

**Outbox (`@keel/std-offline`):** `outbox('todos.outbox', endpoints)` (module level or in a scope); endpoint bodies hold `write: Write` and the action passes `{ meta, ...input.write }` to `tx`. `send(ctx, outbox, origin, 'addTodo', { params, body }, { base: view.get('head') })` resolves `sent | queued | conflict | failed`. `drain(ctx, outbox)` in a scope flushes on reconnect. `resolve(ctx, outbox, key, 'mine' | 'theirs')` settles a `conflict` or `failed` entry. E2651.

**Tests:** `app = await createApp(...)` (sim ctx); `app.fetch(new Request(url, { method, headers: { accept: 'application/json', 'content-type': 'application/json' }, body }))`. Client tests route sim `ctx.net` `/api/*` to `app.fetch`.
