# std.contracts: Stdlib contracts
status: conformance-covered

**Purpose.** The stdlib modules that serve or send to routes do it over contracts (k.contract), like app modules: std-health and std-sessions ship one, std-channels gives a serving module the schemas of two entries and their handlers, std-offline sends through one. A stdlib contract is its package's `./contract` export, from a `*.contract.ts` file, imported by a module with the package in `deps` (E1152), never through `public.exports`.

**std-sessions.** `@keel/std-sessions/contract` exports `sessions`:
```ts
export const sessions = contract('sessions', {
  'sessions.ingest': { method: 'POST', path: '/sessions', body: Session, output: s.object({}) },
  'sessions.list': { method: 'GET', path: '/sessions/list', query: ListSearch, output: Listing },
  'sessions.tally': { method: 'GET', path: '/sessions/tally', output: Tally },
})
```
`./routes` is `manifest(sessions, { 'sessions.ingest': { action: ingestSession }, 'sessions.list': { loader: listSessions, guard: reader }, 'sessions.tally': { loader: loadTally, guard: reader } })`, the package's one table: module `sessions` has no other contract, and the `monitor` runner (std.monitor) only fills the tally. `ListSearch` is `{ failing?, since? }`; a failing one answers 422 `keel.fields` (k.contract query step). `Listing` is the archive as `sessions.list` returns it. The contract imports `Session`, `ListSearch`, `Listing` and `Tally` from the package's `*.schema.ts` files.

**std-channels.** A channel a contract serves is declared in a `*.schema.ts` file (std.channels Declare), the one kind of app file a contract imports (E1514). Its two entries are written out in the contract, as every entry is, naming the channel's own path and schemas; `channelRoute` (a `*.server.ts` file, E2601) gives their handlers:
```ts
// modules/api/boardChannel.schema.ts
export const boardChannel = channel('api.board', { path: '/api/board/events', params: BoardParams, message: BoardMessage })
// modules/api/api.contract.ts
export const api = contract('api', {
  'api.boardEvents': { method: 'GET', path: '/api/board/events', query: BoardParams, events: true, output: boardChannel.events },
  'api.boardPublish': { method: 'POST', path: '/api/board/events', query: BoardParams, body: boardChannel.body, output: s.object({}) },
})
// modules/api/boardEvents.server.ts
export const boardEvents = channelRoute(api, boardChannel, { id: 'api.boardEvents', publish: 'api.boardPublish', stores: boardStores, member })
// modules/api/routes.ts
export const routes = manifest(api, { 'api.boardEvents': { loader: boardEvents.loader }, 'api.boardPublish': { action: boardEvents.action } })
```
- `channel` gives the schemas the entries name: `events`, the `ChannelEvent` schema of its `message`, and `body`, `s.object({ message })` (undefined without `message`). The stream entry is `{ method: 'GET', path, query: params, events: true, output: events }`; the publish entry `{ method: 'POST', path, query: params, body, output }`, `output` taking `{}` and answered `ok({})` (k.api Output). A channel without `message` has no publish entry. Its `params` are the entries' `query`, so a failing one answers 422.
- `channelRoute(contract, channel, { id, publish?, stores, member })` (`@keel/std-channels/server`) declares its handlers through `contract`, the serving module's, as `loader` and `action` do, and returns `{ loader, action }`, the stream's live loader and the publish action, which the binding names at `id` and `publish`. An entry at `id` or `publish` whose `method`, `path`, `events`, `query`, `body` or `output` is not the channel's (by identity; `output` taking `{}`) is a type error where the types differ and throws E1515 naming those members. `publish` is required when the channel has `message`, a type error only (without it the binding lacks the publish entry's action, E1515 at `manifest`), and refused when it does not (a type error, and it throws E1510).
- `subscribe` and `publish` (std.channels Client) still take the channel and an origin.

**std-offline.** `outbox(id, contract, opts)` (std.offline) sends the contract's API write entries; `send`'s third argument is an entry's name after the module (`'editTodo'` for `api.editTodo`), and a GET, `events` or page id does not compile. `@keel/std-offline` and `@keel/services` take the contract's types from `@keel/router/contract` and load no other router code.

**Conformance.**
- `@keel/std-sessions/contract` exports `sessions` of module `sessions` with API entries `sessions.ingest` (`POST /sessions`) and `sessions.list` (`GET /sessions/list`); `createApp` serving its `./routes` answers a `GET /sessions/list?since=x` (failing `ListSearch`) with 422 `keel.fields` and an issue at `query.since`.
- `service({ contract: sessions })` has methods `ingest` and `list`, and `ingest` of a valid `Session` answers `ok({})`.
- With contract `a` holding `a.ev` and `a.pub` written from channel `ch` (with `message`) and `r = channelRoute(a, ch, { id: 'a.ev', publish: 'a.pub', stores, member })`, `manifest(a, { 'a.ev': { loader: r.loader }, 'a.pub': { action: r.action } })` compiles; a stream opened on `a.ev` gets `{ kind: 'reset' }` first, and a POST to `a.pub` delivers `{ kind: 'message', message }` to it.
- `channelRoute` over a contract whose `a.ev` has another `path`, or a `query` not `ch.params`, throws E1515 naming those members; of a channel without `message`, `publish` does not compile and throws E1510.
- `keel check` over a module whose contract holds a channel's two entries and whose binding names `channelRoute`'s handlers reports no E1111 and no W1005, and `routes.json` lists both ids; a `.pii()` in the channel's `params` is E1111 at each entry's `query`.
- A contract file importing a channel from a `*.schema.ts` file is no E1514; from `boardChannel.ts`, one E1514.
- `send(ctx, o, 'board', ...)` for a GET entry `api.board` of the outbox's contract does not compile.
