---
name: keel-server
description: "Keel server state: loaders and actions over server stores, guards on a node deployable, identity source and mount, API routes and bearer, service clients, OpenAPI import; E1510, E1513-E1515, E1550, E1558, E1551, E1579-E1583, E1593, E1651"
---

# Server state and API

A `node` deployable owns the data; `client` ones call it. `keel docs server` lists the sections; `keel docs --for <code>` finds a code, `keel explain <code>` explains it.

## Loaders, actions, stores

`loader` and `action` live in `*.server.ts` (E1551), a `guard` in `*.guard.ts` (E1009). A handler names its contract entry: `loader(contract, id, decl, fn)` and `action(contract, id, decl, fn)`, `fn` never annotated; a handler bound under another id is E1515, so two entries need two loaders (share a helper). A `node` deployable's browser build stubs those files; in a module only `client` deployables list, they ship to the browser (k.boundary). Naming `stores`, or a live loader (an async generator, only on an `events: true` GET entry), in a module only a `client` or `static` deployable serves is E1558. Request state is made in its handler; config or a pool is a module `const`. A request's write to a module store or signal is E1256; a module `let`, `Map` or array leaks to the next request: keep none (cache in `ctx.storage`).

`stores` names a factory with explicit store `id`s, run once per request and restored from `ctx.storage`. A request holds one live store per id: a layout's loader and its page's that read one store name the same factory; a second factory that creates that id again is E1550 at `keel check`, `keel build` and `createApp`. An action's `ok` saves the changed stores in one commit; `err` or a throw saves none; another request's save since this one began is 409 `keel.conflict`. `caller` is an anonymous per-browser hash that grants nothing; put it in `tx` meta, and `stores.board.undoWhere((e) => e.meta?.caller === caller)` undoes its writes.

```ts
// modules/api/Board.schema.ts
import { s } from '@keel/schema'
export const Board = s.object({ todos: s.array(s.object({ id: s.id('Todo'), title: s.string() })) })
```
A client view store starts from loader data as its `initial`, created in the component (`keel docs k.store`, View stores); after a write, re-read through the service and `tx` the answer into a `hydrate` transaction in the handler. A `tx` in a component body is E1304. A page action (`decl` `{ input }`) returns `ok(href)` (303 to it) or `ok(null)`; a page loader's `decl` is `{ output }`.

## API routes

A module that serves routes has one client-safe file, `modules/<id>/<id>.contract.ts`, exporting `contract('<id>', {...})` from `@keel/router/contract`, which imports `*.schema.ts` files and packages only (E1514). Each key is a route id; an API entry (`method`, `path`, `output`; optional `params`, `query`, `body`, `errors`, `timeout`, `events`) is `<module>.<name>`, one lowerCamel segment that names its client method (E1513). It answers JSON and is never in a module a `client` deployable serves (E1511). A member its kind refuses is E1510.

`local: true` on a page or API entry (a dev tool) answers only this machine's loopback connections, never a forwarded or `service` request (403 `keel.denied`), but your server code's own loopback `ctx.net.fetch` (in `unsafe`) reaches it; off a `node` deployable, E1511.

**Static reading.** `keel check` reads the contract unrun: literal keys; per entry, literal `method`, `path`, `layout` and `events`, and `params`, `search` and `query` schemas reached through consts and imports. A spread, call or name in place of the entries or an entry is E1111. A channel's entries are written out the same way (keel-data).

```ts
// modules/api/api.contract.ts
import { contract } from '@keel/router/contract'
import { s } from '@keel/schema'
import { Board } from './Board.schema.ts'

export const api = contract('api', {
  'api.board': { method: 'GET', path: '/api/lists', output: Board },
  'api.addTodo': { method: 'POST', path: '/api/todos', body: s.object({ title: s.string({ min: 1 }) }), output: s.object({}) },
})
```
```ts
// modules/api/handlers.server.ts
import { action, loader } from '@keel/router'
import { err, ok, s } from '@keel/schema'
import { store, transaction, tx } from '@keel/store'
import { api } from './api.contract.ts'
import { Board } from './Board.schema.ts'

const boardStores = () => {
  const board = store(Board, { todos: [] }, { id: 'api.board' })
  const addTodo = transaction(board, 'api.addTodo', s.object({ id: s.id('Todo'), title: s.string() }),
    (state, p) => ({ todos: [...state.todos, p] }), { concurrent: 'rebase' })
  return { board, addTodo }
}

export const loadBoard = loader(api, 'api.board', { stores: boardStores }, async ({ stores }) =>
  ok({ todos: stores.board.get('todos') }))

export const postTodo = action(api, 'api.addTodo', { stores: boardStores },
  (body, { caller, stores }, ctx) => {
    const r = tx(stores.addTodo, { ...body, id: ctx.random.id('Todo') }, { meta: { caller } })
    return r.ok ? ok({}) : err(r.error)
  })
```
```ts
// modules/api/routes.ts binds every entry and nothing else (E1515)
import { manifest } from '@keel/router'
import { api } from './api.contract.ts'
import { loadBoard, postTodo } from './handlers.server.ts'

export const routes = manifest(api, { 'api.board': { loader: loadBoard }, 'api.addTodo': { action: postTodo } })
```
A GET entry binds `loader`, a write `action`, each with an optional `guard`; a page entry binds `component` and its verbs (keel-client). `routeTable(...tables)` joins a deployable's modules. `output` is parsed before any save (E1554) and holds no `s.secret` (E1113: `reveal` it). An API `query` may require keys; after the guard, a failing `query` or `body` is 422 `keel.fields` and nothing runs. A loader or action denies with `err(keelError.denied.make({}))`, answered 403.

**Bearer.** An API entry's guard, loader and action get `bearer: Secret<string> | undefined`, from `Authorization: Bearer`; a page's get `undefined`. Keel only parses it; check it once, in the handler that uses the token's row (`tokens(ctx).check`, keel-compliance, `idOf`). A guard's result reaches no handler: it only admits. A guard without `redirect` is for API routes (on a page: E1508); denial is 403.

```ts
// modules/api/admit.guard.ts
import { guard } from '@keel/router'
import { err, keelError, ok } from '@keel/schema'

export const admit = guard({}, async ({ bearer, user }) =>
  bearer === undefined && user === ''
    ? err(keelError.denied.make({}))
    : ok(null))
```

Bind it as `{ loader, guard: admit }`. A page or layout guard has a `redirect` (`guard({ redirect: 'app.login' }, ...)`); guarded pages share its route's `params` (E1508). A guard lives in a `*.guard.*` file of a module and is bound by value import, so the binder lists that module in `deps`. A guard bound by modules that link to one another lives in a module of its own with no pages and no `deps` on its binders; one in a binder is E1153 `module deps cycle through guard <name>`. A `redirect` is a route id, no `deps` entry.

## Identity

Keel authenticates no one. `identity.ts` beside `topology.ts` default-exports `identityMount('/api/auth')`; `identity.server.ts` default-exports `identity({ identify, handle? })`. `identify` returns the user id (`''` for no one), once per request; handlers get it as `user`. A live loader keeps the `user` it opened with; its `currentUser()` runs `identify` again on the opening request (`''` with no identity source). `handle: { path, fn }` hosts an auth library's endpoints and cookies; `fn(request, ctx, { routes })`, and a sign-in's 303 goes to `pageHref(routes, next)` (`@keel/router/match`: `ok` is an `Href` of a page, `err` an unknown or hostile `next`; never copy `next` into `location`); no route sits under it, and it is not at or under `/assets`, the built files (E1579, E1580).

```ts fragment
// identity.server.ts
import mount from './identity.ts'

export default identity({
  identify: async ({ request }) => (await librarySession(request))?.id ?? '',
  handle: { path: mount.path, fn: libraryHandler },
})
```

`identity.ts`'s default export is the only mount: a page imports it, and an `identityMount` call anywhere else outside a test is E1593. Pages reach it through `Link to={mount.href('/login/github')}` or a native `Form` post (no file input: E1583) to `mount.href('/sign-in/email')`; a `subpath` with `..`, `?` or `//` throws E1582. With `identity.ts`, each deployable is `node` or a hosted `client` (E1581, E1589). With an identity source a `node` deployable answers `GET /__keel/user` (`x-keel: 1`, else 403) with `{ user }`; a `client` page's router reads it per document and after a shell's sign-in or out, so its guards read `user`. That `user` only steers navigation: each API route guards itself. A shell build goes through `KEEL_ORIGIN`. Another origin's `routes` is E1592. `caller: { days }` in `topology.ts` is only on a `node` deployable (E1578).

## Calling a module or another service

`service({ contract })` has one method per API entry of a module in `deps` (importing its contract needs `deps`, E1152), reached through the topology: in process, a peer, or the document's origin. A method takes `{ params, query, body, bearer, user, signal }` and `ctx`, and returns `Result<Out, ApiError>`. It never throws: match `error.code` (`api.timeout`, `.network`, `.status`, `.decode`, `.input`). `user` is signed for the receiver, which runs no `identify`. Never call `ctx.net.fetch` in app code (E1651). `service({ base, schema: endpoints({...}) })` calls an origin no app module serves: a `:param` in `path` needs a `params` field (E1652), a GET has no `body` (E1653), and in client code `base` is the page's own origin (another URL: E1571).

```ts
import type { Ctx } from '@keel/ctx'
import type { Secret } from '@keel/schema'
import { service } from '@keel/services'
import { api } from './api.contract.ts'

export const client = service({ contract: api })

export async function addOne(ctx: Ctx, token: Secret<string>) {
  const r = await client.addTodo({ body: { title: 'milk' }, bearer: token }, ctx)
  if (!r.ok) return r.error.code
  return (await client.board({}, ctx)).ok
}
```

`keel scaffold service <module> --openapi openapi.json` turns an OpenAPI 3 document into a read-only client (`keel docs k.openapi`); `--base <url>` writes an empty one. `--name <lowerCamel>` names the declaration `<Name>Api` (default: the module id); a module holds one. On a `client` deployable add `--reason <why>`: it declares the origin (else E1358; `keel docs k.scaffold-service`).

## Runners and tests

`modules/<id>/runners.server.ts` exports `runners = [{ run(ctx, signal) }]`. Tests import `createApp` from `@keel/server` (apps import only `topology` and `commitStores`): `await createApp({ topology, routes: routeTable(...), ctx, deployable: 'web' })` (also `mode`, `guards`, `peers`, `secret`, `origin`, `std: '.keel/std.json'`, else no std config; package README) over a sim ctx (no runner runs without `runners: { <module>: runners }`), then `app.fetch(new Request(url, init))`; a harness `fetch` with no connection is refused by a `local: true` route (403). `renderRoute(id, { user })` runs `stores`. A service call on the `createApp` ctx runs in process and never reaches its `ctx.net`; route `/api/*` of another ctx (a client test's) to `app.fetch`. A GET answers `{ id, results: { [id]: { ok, value } } }`; a write the `Result`, `{ ok: true, value }`. See keel-testing, keel-data, keel-compliance, keel-deploy.
