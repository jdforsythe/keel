---
name: keel-server
description: "Keel server state: loaders and actions over server stores, guards on a node deployable, identity source and mount, API routes and bearer, service clients, OpenAPI import; E1510, E1558, E1551, E1579-E1583, E1651"
---

# Server state and API

A `node` deployable owns the data; `client` deployables call it. Exact signatures: `keel docs k.server`, `k.store`, `k.guards`, `k.api`, `k.services`, `k.openapi`, `k.user`, `k.mount`. `keel docs --for <code>` finds the section of a code; `keel explain <code>` explains it.

## Loaders, actions, stores

`loader` and `action` live in `*.server.ts` (E1551); a `guard` in `*.guard.ts` (E1009). A handler is its binding however it is imported. Browser builds stub those files. Naming `stores`, or a live loader (an async generator), in a module only a `client` or `static` deployable serves is E1558. Server code never writes module-level stores (E1256).

`stores` names a factory with explicit store `id`s. Each request runs it once, restoring from `ctx.storage`. An action's `ok` saves the changed stores in one commit; `err` or a throw saves none; a save made by another request since this one began is 409 `keel.conflict`. `caller` is an anonymous per-browser hash and grants nothing; put it in `tx` meta, then `stores.board.undoWhere((e) => e.meta?.caller === caller)` undoes that caller's writes.

```ts
import { action, loader } from '@keel/router'
import { err, ok, s } from '@keel/schema'
import { store, transaction, tx } from '@keel/store'

const Board = s.object({ todos: s.array(s.object({ id: s.id('Todo'), title: s.string() })) })
const TodoDraft = s.object({ title: s.string({ min: 1 }) })

export const boardStores = () => {
  const board = store(Board, { todos: [] }, { id: 'api.board' })
  const addTodo = transaction(board, 'api.addTodo', s.object({ id: s.id('Todo'), title: s.string() }),
    (state, p) => ({ todos: [...state.todos, p] }), { concurrent: 'rebase' })
  return { board, addTodo }
}

export const loadBoard = loader({ output: Board, stores: boardStores }, async ({ stores }) =>
  ok({ todos: stores.board.get('todos') }))

export const postTodo = action({ input: TodoDraft, output: s.object({}), stores: boardStores },
  (input, { caller, stores }, ctx) => {
    const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
    return r.ok ? ok({}) : err(r.error)
  })
```

A write that answers nothing declares `output: s.object({})` and returns `ok({})`. A page's action returns `ok(href)` (303 to it) or `ok(null)` instead and declares no `output`.

## API routes

An entry with `api: true` and a `path` answers JSON whatever `accept` says. It takes a loader, actions (`routes.actions`), a guard, and refuses `component`, `errorElement`, `title`, `layout` (E1510). It is never in a module a `client` deployable serves (E1511).

```ts fragment
// modules/api/routes.ts: import it before any action that returns routes.href(...)
import { loadBoard } from './loadBoard.server.ts'
import { postList } from './postList.server.ts'

export const routes = manifest({ 'api.lists': { api: true, path: '/api/lists', loader: loadBoard } })
routes.actions({ 'api.lists': { POST: postList } })
```

An API route's action declares `output` (a page's must not: E1512) and answers `{ ok: true, value }`; the value is parsed by `output` before any save (E1554), and `output` holds no `s.secret` (E1113: `reveal` it into a string). Bodies are `application/json`; bad input is 422 `keel.fields`. A loader or action denies with `err({ code: 'keel.denied', message, data: null })`, answered 403.

**Bearer.** An API route's guard, loader and action get `bearer: Secret<string> | undefined`, from `Authorization: Bearer`; a page's get `undefined`. Keel only parses it. Check it in the handler that uses the token's row, once. Use a guard only on a route that merely admits; a guard's result reaches no handler, so a handler that needs the row checks again. A guard without `redirect` guards API routes only (on a page it is E1508); denial is 403.

```ts
import { guard } from '@keel/router'
import { err, ok } from '@keel/schema'

export const admit = guard({}, async ({ bearer, user }) =>
  bearer === undefined && user === ''
    ? err({ code: 'keel.denied', message: 'sign in', data: null })
    : ok(null))
```

## Identity

Keel authenticates no one. `identity.ts` beside `topology.ts` default-exports `identityMount('/api/auth')`; `identity.server.ts` default-exports `identity({ identify, handle? })`. `identify` returns the user id, `''` for no one, and runs once per request; guards, loaders and actions get it as `user`. `handle: { path, fn }` hosts an auth library's sign-in and callback endpoints and their cookies; no route sits under it (E1579, E1580).

```ts fragment
// identity.server.ts
import { identity } from '@keel/server'
import mount from './identity.ts'

export default identity({
  identify: async ({ request }) => (await librarySession(request))?.id ?? '',
  handle: { path: mount.path, fn: (request) => libraryHandler(request) },
})
```

Pages reach the library through `Link to={mount.href('/login/github')}` or a native `Form` post (`method` `'POST'`, no file input: E1583) to `mount.href('/sign-in/email')` (`keel docs k.forms`); a `subpath` with `..`, `?` or `//` throws E1582. A module importing `identity.ts` needs a `node` or hosted `client` deployable (E1581). A shell build goes through `KEEL_ORIGIN` (`keel docs k.return`). `caller: { days }` in `topology.ts` is only on a `node` deployable (E1578).

## Calling a module or another service

`service({ module, schema })` calls an API route of a module in `deps` through the topology (in process, a peer, or the document's origin); `service({ base, schema })` calls another origin. A method takes `{ params, query, body, bearer, user, signal }` and `ctx`, and returns `Result<Out, ApiError>`. It never throws: match `error.code` (`api.timeout`, `api.network`, `api.status`, `api.decode`, `api.input`). `user` is signed for the receiving deployable, so it runs no `identify`. Never call `ctx.net.fetch` in app code (E1651). A `:param` in `path` needs a `params` field (E1652); a GET has no `body` (E1653). In client code a `base` is the page's own origin; another absolute URL is E1571.

```ts
import type { Ctx } from '@keel/ctx'
import type { Secret } from '@keel/schema'
import { s } from '@keel/schema'
import { endpoints, service } from '@keel/services'

const Board = s.object({ n: s.int() })
const NewTodo = s.object({ title: s.string() })
const Fields = s.object({ fields: s.json() })

export const BoardApi = endpoints({
  lists: { method: 'GET', path: '/api/lists', output: Board },
  addTodo: { method: 'POST', path: '/api/todos', body: NewTodo, output: s.object({}), errors: { 422: Fields } },
})

export const api = service({ module: 'api', schema: BoardApi })

export async function addOne(ctx: Ctx, token: Secret<string>) {
  const r = await api.addTodo({ body: { title: 'milk' }, bearer: token }, ctx)
  if (!r.ok) return r.error.code
  return (await api.lists({}, ctx)).ok
}
```

An OpenAPI 3 JSON document becomes a client: `keel scaffold service <module> --openapi openapi.json` writes the generated, read-only `<Name>Api.schema.ts` and `api.server.ts` (`keel docs k.openapi`).

A client view store changes only through a transaction: after a write, re-read through the service and `tx` the result into a `hydrate` transaction.

## Runners and tests

`modules/<id>/runners.server.ts` exports `runners = [{ run(ctx, signal) }]` for background work. Tests: `createApp` (sim ctx) then `app.fetch(new Request(url, { method, headers: { accept: 'application/json', 'content-type': 'application/json' }, body }))`; `renderRoute(id, { user })` runs `stores`. Route a client test's sim `ctx.net` `/api/*` to `app.fetch`. See keel-testing. Related: keel-data, keel-compliance, keel-deploy.
