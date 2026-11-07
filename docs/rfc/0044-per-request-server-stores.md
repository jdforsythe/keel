# RFC 0044: Per-request server stores, caller meta, no `Transaction.payload`

Status: accepted

## Problem
Backlog 0054, 0102, and the `Transaction.payload` item of 0065 (freeze review §2 row 10).
- A store declared at module level in server code is one instance for the whole process. Overlapping requests read and write it between each other's `await`s, so one request's action sees another's half-done writes (backlog 0072 patched only the duplicate-id crash with `isolate`, RFC 0022). The golden-1 `api.board` is such a store, and `createApp({ expose })` exists only to put process-shared stores into `#k-state`.
- Undo is scoped to the caller by a side map: `markLogs` records each module store's last entry before an action, `tagSince` tags entries committed during the action's synchronous run with the caller token (`Caller.tags`), and `undoOwn`/`canUndoOwn` find the caller up the `owner()` chain. That is ambient state (principle 2): entries committed after an `await` are never tagged, and outside a request the helpers silently answer false. RFC 0028 added log `meta` so the caller can be recorded at the call site instead, but nothing passes the caller to actions.
- `Transaction.payload` is a second name for `Transaction.schema` (principle 1).

## Proposal
1. **Store factories, named where used.** `loader({ output, params?, search?, stores? }, fn)` and `action({ input, params?, stores? }, fn)` (k.server API) take an optional `stores: (ctx) => S`: an ordinary function that creates stores (each with an explicit `id`) and their transactions and returns them. `fn` gets `stores: S` (`undefined` without a factory) in its `{ params, url, ... }` argument.
2. **Per-request instances.** For each request the server calls every factory named by the matched chain's loaders and the action once, inside a child scope of the request scope with its own registry (k.store `isolate`). A store whose id is the runtime default (`store.<n>`) is an uncaught throw: its persistence key would change every request. No instance outlives its request or is shared by two.
3. **Persistence through `ctx.storage`.** Each factory store is restored from `ctx.storage` key `keel.store.<id>`, a `snapshot({ meta: true })` JSON string, before `fn` runs. After an action returns `ok`, every store whose snapshot changed is saved; after `err` or a throw nothing is. The deployable keeps an in-process write-through copy of each key it has read or written, and each request remembers which copy it restored from. If any changed store's copy was replaced by another request's save since, nothing is saved and the response is 409 `keel.conflict` (`data: { store }`), the optimistic check that replaces a lost update. The check and the in-process update run in one synchronous step. Storage is per process (k.server Topology: local only).
4. **Caller in `fn`.** `fn` gets `caller: string`: the `keel-caller` cookie token, a fresh token (minted with `ctx.random.uuid()` and set `HttpOnly; SameSite=Lax; Path=/`, `Secure` on https) on a write without one, else `""`. App code records it with `tx(t, p, { meta: { caller } })` and undoes its own last write with `store.undoWhere((e) => e.meta?.caller === caller)`; `canUndo` is `store.log().at(-1)?.meta?.caller === caller`. Meta is restored with the log, so this holds across requests and after `await`s.
5. **Deleted.** `undoOwn`, `canUndoOwn` (redundant: one `undoWhere` call with the explicit caller), `markLogs`, `tagSince`, `LogMark`, `Caller.tags`, `Served.tags`, `callers`, `ownCaller`, `createApp({ expose })` and `snapshotStores`' module-registry half (server code never writes module stores, so their state is their initial state, which the client has), `Transaction.payload`.
6. **Visibility.** `#k-state` holds the stores created in the request scope (components), not factory stores: their logs carry other callers' payloads, and loaders already send the data a page needs through `output`. The dev inspect document lists `stores()` of the module registry as before; factory instances live only inside their request and their persisted form is in `ctx.storage`.
7. **Client router.** A client-only deployable has no request to scope to: the router answers a loader or action that names `stores` with `keel.unexpected` and passes `caller: ""` to the others.

## Alternatives
- **Compiler-emitted factories behind module-level bindings** (`export const board = store(...)` lowered so each request gets its own `board`). App code imports one binding, so it can resolve to a request's instance only through ambient context: the `owner()` chain (lost at the first `await`) or `AsyncLocalStorage`. Both are context providers (principle 2), the same reason RFC 0028 rejected ambient meta. The factory is ordinary code named where it is used; the compiler emits nothing new.
- **A module-level `createStores` convention collected by the generated server entry.** Loaders and actions would still need the factory's type, so they would import it anyway; naming it in the declaration is the same import with no convention.
- **`at.open(factory)`** inside `fn`. Asynchronous, so every handler gains an `await` before its first read, and the server learns the stores only while `fn` runs.
- **A per-store lock instead of 409.** Holds every writer behind an action's slowest `await`; a hung action blocks the store. Optimistic checks never block and the loser retries.
- **Save on `err` too.** An action that commits and then returns `err` would persist half a change; saving only on `ok` makes an action all-or-nothing.
- **Keep `undoOwn(store, caller)`.** A wrapper over `undoWhere` with the same arguments: two ways.
- **Factory stores in `#k-state` state-only (as `expose` did).** Loader `output` is already the schema'd channel for server data.

## Spec diff
k.server: API line drops `undoOwn`/`canUndoOwn`; `loader`/`action` bullets gain `stores?`, `caller`, `stores`; the `undoOwn` bullet is replaced by a **Server state** paragraph; Status gains `keel.conflict` 409; the `#k-state` sentence drops `expose`; two Conformance bullets replace the `undoOwn` one. Trims to fit: same-site list, decode clause, dev log sentence, example arguments. k.errors: kernel codes gain `keel.conflict` (k.server). k.store: unchanged (`Transaction.payload` was never in it).

## Conformance diff
Server: `undo-own-caller.test.ts` is replaced by `server-state-instances.test.ts` (overlapping actions on one factory see only their own instance; the later save is 409 `keel.conflict` and saves nothing; an `err` action and an unchanged store save nothing; undo by `meta.caller` is scoped) and `caller-token.test.ts` (cookie token, minted and set on a cookieless write, `""` on a cookieless read). Store: none.

## Migration
- A module-level store written by server code becomes a factory: `export function createBoard(ctx: Ctx) { const board = store(Board, init, { id: 'api.board' }); invariant(board, ...); return { board, addTodo: addTodo(board), ... } }`; per-file transactions become `(board: Store<Board>) => transaction(board, ...)`. Loaders and actions add `stores: createBoard` and read `stores.board`.
- `undoOwn(board)` becomes `stores.board.undoWhere((e) => e.meta?.caller === caller)`; `canUndoOwn(board)` becomes `stores.board.log().at(-1)?.meta?.caller === caller`; writes pass `{ meta: { caller } }`.
- Remove `createApp({ expose })`. A node deployable needs a working `ctx.storage`: on Node, run with `--experimental-webstorage --localstorage-file=<path>` for the real ctx (golden-1 `api` script).
- Tests that call `fn` directly pass `{ caller, stores }`; a test builds `stores` with the factory inside a scope.
- `t.payload` becomes `t.schema`.
- Done here: `@keel/server`, `@keel/store`, `@keel/router` (types; client runner refuses `stores`), apps/golden-1 api module and tests, the keel-api skill, the server README.

## Token impact
k.server 1494 -> 1495 of 1,500 (the new paragraph is paid for by the deleted bullet, the `expose` sentence, and trims). k.errors +5. k.store unchanged (1134).
