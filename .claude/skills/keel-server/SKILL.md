---
name: keel-server
description: "Keel server state: loader/action stores factories over ctx.storage, keel.conflict 409, caller and undoWhere, user, identity.server.ts and identity.ts, runners; E1558, E1551, E1579-E1583"
---

# Server state

Spec: `pnpm spec k.server`, `k.user`, `k.mount`. A `node` deployable owns the data.

**Factory:** `boardStores = () => { const board = store(Board, init, { id: 'api.board' }); return { board, addTodo: addTodo(board) } }`. Per request each named factory runs once, restoring from `ctx.storage`; an action's `ok` saves the changed stores, `err` none; another request's save since is 409 `keel.conflict`.
```ts
export const loadBoard = loader({ output: BoardView, stores: boardStores }, async ({ stores }) => ok(...))
export const postTodo = action({ input: TodoDraft, stores: boardStores }, (input, { caller, stores }, ctx) => {
  const r = tx(stores.addTodo, { ...input, id: ctx.random.id('Todo') }, { meta: { caller } })
  return r.ok ? ok(null) : err(r.error)
})
```
Undo one caller's writes: `stores.board.undoWhere((e) => e.meta?.caller === caller)`. `caller` grants nothing.

**User:** Keel authenticates no one. Beside `topology.ts`: `identity.ts` `export default identityMount('/api/auth')` (`@keel/router`); `identity.server.ts` `export default identity({ identify: async ({ request }) => libSession(request)?.id ?? '', handle: { path: mount.path, fn } })` (`mount` its default import, E1580). Handlers get `user` (`''`: none). `service({ module })` with `user` signs `x-keel-user` for that request's body and the deployable serving the module (at most 256 characters, else `api.input`). `handle` hosts the library's endpoints and cookies (E1579: a route under it); pages reach it by `Link to={mount.href('/login/github')}` or a native `Form` post to `mount.href('/sign-in/email')` (keel-forms), which `fn` answers with a 303 and the library's `set-cookie`. A module importing `identity.ts` needs a `node` or hosted `client` deployable (E1581).

**Where:** `loader`/`action` only in `*.server.ts` (E1551), `guard` in `*.guard.ts` (E1009); a handler is its binding however imported (`R.loader`, a re-export, `const L = loader` all count); server-only is the name on disk, any extension (`keys.server.json` is never bundled for a browser). A page imports `routes.ts` freely, as browser builds stub those files. One naming `stores`, or a live loader, in a module a `client` or `static` deployable serves is E1558. Server code never writes module-level stores (E1256).

**Runners:** `export const runners = [{ run(ctx, signal) }]` in `modules/<id>/runners.server.ts`.

**Tests:** `renderRoute(id, { user })` runs `stores` over `ctx.storage`; `documents()` lists posts and mount links. Races: keel-writes.
