# std.channels: Channels
status: conformance-covered

**Extension points.** Module manifest: stdlib module `channels` (capabilities `clock`, `net`, `observe`), whose route an app lists in a `node` deployable's manifest. Check rule registry: E2601 and E2602 through `@keel/std-channels/tools`.

**Declare.** In a shared file whose name is the export:
```ts
export const boardChannel = channel('todos.board', { path: '/api/board/events', params: s.object({}), message: BoardMessage })
```
`channel(name, { path, params, message? })`: `name` is prefixed by the declaring module, as E1155 asks of route ids. `params` is parsed from the stream URL's search (fail: 404) and picks an instance. `message` (optional) is the schema of what members publish; without it nothing can be published. `channel` throws E2602 when `message` holds an `s.secret`.

**Serve.** In a `*.server.ts` file (else E2601):
```ts
export const boardEvents = channelRoute(boardChannel, { id: 'api.boardEvents', stores: boardStores, member: ({ caller, user, params, stores }) => true })
```
returns the API route (k.api) `{ id, path, loader, actions: { POST } }` for the serving module's manifest (`id` prefixed by that module, E1155; `path` the channel's). `loader` is a live loader (k.server) yielding `ChannelEvent<M>`:
- `{ kind: 'reset' }`, first on every open: the client re-reads; nothing missed while closed is resent.
- `{ kind: 'saved', store, head }` after each save of a store `stores` creates (k.sync `save`), in save order, to every open member stream.
- `{ kind: 'message', message }` for each publish to the same channel and params, the publisher's stream included.
- `{ kind: 'closed', reason }`, then the end: `denied` when `member` is or turns false, `full` when the open is past a cap.

`member` is a pure predicate over the request's `caller` and `user` (k.user), the parsed `params` and `stores` opened read-only. It runs at open (false: `closed` `denied` is the only event), at each publish (false: 403, nothing delivered) and, for each open stream, after each save of its stores. An event-stream GET reads the caller cookie and never sets one (k.server). The POST takes `{ message }` as an action: the k.server same-site proof, `maxBodyBytes` and 422 `keel.fields` apply, and it answers `ok(null)` once delivered. Delivery reaches the streams open in the serving process. Config `std['@keel/std-channels']: { perCaller?, perAnonymous?, maxStreams? }` (server-only; defaults 8, 64 and 1,000): the open streams of one caller, of all cookieless opens together (caller `""`, counted against `perAnonymous`, never `perCaller`), and of the process. A route whose `member` refuses `""` holds no cookieless stream. The kernel caps open streams per app as one pool (k.server `maxStreams`) with no per-caller share, so one client holding streams up to that cap makes the others get 503.

**Client.**
- `subscribe(ctx, origin, channel, params, on)`, inside a scope: reads the live loader through a k.services `events: true` endpoint built from the channel and `origin`, and calls `on(event)` for each `ok` event. After the iteration ends (a drop, `api.network`, `closed` `full`) it reopens 1 s later, doubling to 30 s on `ctx.clock`; it makes no request while `ctx.net.online()` is false and reconnects on `{ kind: 'net', online: true }`. Returns `{ status, close }`: `status()` reads a signal, `'connecting' | 'open' | 'offline' | 'denied'`; after `closed` `denied` it stops. Disposing the scope closes the stream.
- `publish(ctx, origin, channel, params, message)`: `Promise<Result<null, ApiError>>`, through `@keel/services` (k.services errors and timeout).

**Privacy.** Events carry no caller, cookie or store state: `saved` names the store and its head, and each member re-reads through its own loader. A message reaches every member's browser as published, with no publisher identity unless its schema holds one; it is never stored, logged or resent. `stores` and `member` stay on the server.

**Rules.** E2601 `channelRoute` outside a `*.server.ts` file · E2602 a channel `message` schema holding an `s.secret`.

**Conformance.**
- A member's stream starts with `{ kind: 'reset' }` and then gets `{ kind: 'saved', store, head }` after each save of a store its channel's `stores` creates, in save order.
- A caller for whom `member` is false at open gets `{ kind: 'closed', reason: 'denied' }` as its only event; a cookieless open has caller `""` and its response sets no cookie.
- After a save that makes `member` false for an open stream's caller, that stream gets `{ kind: 'closed', reason: 'denied' }` and ends, and the other members' streams continue.
- A member's publish delivers `{ kind: 'message', message }` to every open member stream of the same channel and params, the publisher's included, and to none with other params; a non-member's publish is 403 and delivers nothing.
- A publish without same-site proof is 403 `keel.denied` and one failing `message` is 422 `keel.fields`; neither delivers anything.
- No delivered event holds a caller hash, a cookie value or a store's state.
- Under sim, `subscribe` reopens 1 s, 2 s, 4 s after successive drops on `ctx.clock`, sends nothing while `online()` is false, reconnects on `{ kind: 'net', online: true }`, and its `status()` passes through `connecting`, `open`, `offline` and `denied` as those happen.
- Disposing the scope that called `subscribe` aborts its request, and `on` gets no later event.
- An open past `perCaller` streams for one caller gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue.
- `channel` throws E2602 for a message schema with a nested `s.secret`; `keel check` reports E2601 and E2602 on fixtures and nothing on their clean twins.
- An open past `perAnonymous` cookieless streams, from any client, gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue; with that bound reached, a caller with a cookie opens up to its `perCaller`.
