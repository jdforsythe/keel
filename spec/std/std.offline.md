# std.offline: Outbox
status: conformance-covered

**Extension points.** Check rule registry: E2651 through `@keel/std-offline/tools`. It uses `ctx.storage`, `ctx.net`, `ctx.clock`, `ctx.random` and `observe` (`net` events).

**Declare.** In a client-safe file whose name is the export:
```ts
export const boardOutbox = outbox('todos.outbox', BoardApi, { limit: 100 })
```
`outbox(id, api, { limit = 100, maxBytes = 262144 })` over a k.services `endpoints` map creates the client store `id` (prefixed by its module, E1155), state `{ entries: OutboxEntry[] }`, changed only by its transactions `<id>.add`, `<id>.settle` and `<id>.resolve`. `OutboxEntry` is `{ key, endpoint, origin, input, base, at, state, head?, error? }`, `state` one of `queued`, `sending`, `conflict`, `failed`. `outbox` throws E2651 when an endpoint's body holds an `s.secret`.

**Write.** An endpoint an outbox sends to has `body: s.object({ ..., write: Write })`, where `Write` is `s.object({ key: s.id('Write'), base: s.int({ min: 0 }) })`. Its action passes both to the store: `tx(t, payload, { meta, ...input.write })` (k.sync).
```ts
const r = await send(ctx, boardOutbox, origin, 'editTodo', { params: { todoId }, body: { title, priority } }, { base: view.get('head') })
```
`send` adds an entry whose `body.write` is `{ key: ctx.random.id('Write'), base }`, writes the outbox to `ctx.storage` key `keel.outbox.<id>`, and flushes. It resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }` (offline, or the network failed), `{ state: 'conflict', head }` or `{ state: 'failed', error }`, `error` an `ApiError`, `offline.full` or `offline.storage`. A full outbox (`limit` entries, or `maxBytes` of encoded entries) resolves `failed` with `offline.full` and adds nothing. A write to `ctx.storage` that rejects, in `send`, a flush or a `'mine'` `resolve`, leaves the entry `failed` with `offline.storage` in memory, posts nothing more and releases the flush.

**Flush.** Entries are sent in the order added, one request at a time, through the k.services client:
- 2xx: the entry is removed; `sent`.
- `api.network` or `api.timeout`: it stays `queued` and flushing stops, to resume on `{ kind: 'net', online: true }`, on the next `send`, or 1 s later doubling to 60 s on `ctx.clock` while `online()` holds.
- 409 `keel.conflict` with `data.transaction` (a k.sync refusal): `conflict`, keeping `data.head`; the next entry goes.
- 409 without it (the request overlapped another save): sent once more; a second such 409 is `failed`.
- Any other status: `failed` with its `ApiError`; the next entry goes.

`drain(ctx, outbox)`, inside a scope, loads the stored outbox (`sending` entries become `queued`), flushes, and flushes again on each reconnect until the scope is disposed. A resent entry keeps its key, so a write the server already committed commits nothing again while the store keeps that key: its last `logLimit` keyed writes (k.sync).

**Resolve.** `resolve(ctx, outbox, key, resolution)`, `resolution` `'mine'` or `'theirs'`. `'mine'` queues a `conflict` entry again, last, with `base` set to its `head`, so the write applies over what it conflicted with, flushes, and resolves that entry's `OutboxResult` as `send` does. `'theirs'` removes a `conflict` or `failed` entry and resolves `true`. With no such entry, each resolves `false` and changes nothing. The outbox log records each as `<id>.resolve` `{ key, resolution }`.

**Privacy.** Entries stay in the browser's storage and go only to their endpoint; E2651 keeps secrets out of them. A session records the outbox's transactions, and a module's `redact` entries cover their payloads.

**Rules.** E2651 an `outbox` whose api has an endpoint body holding an `s.secret`.

**Conformance.**
- With `online()` true and an empty outbox, `send` posts once with `body.write` `{ key, base }`, `key` a fresh `Write` id, and resolves `sent` with the endpoint's output.
- After `setOnline(false)`, three `send`s resolve `queued`, post nothing, and leave the three entries in order in `ctx.storage` `keel.outbox.<id>`; `drain` on a new ctx over that storage holds them `queued`.
- After `setOnline(true)`, queued entries are posted in the order added, one at a time, each with its original key.
- When the fetch rejects after the server committed, the entry is resent with the same key and the server store holds one entry for that write.
- A 409 with `data.transaction` leaves the entry `conflict` with that `head`, and the next entry is posted; a 409 without it is sent once more.
- `resolve(ctx, o, key, 'mine')` queues the entry last with `base` equal to its conflict `head`; `'theirs'` removes it; each adds one `<id>.resolve` entry to the outbox log.
- `send` to an outbox holding `limit` entries resolves `failed` with `offline.full` and adds nothing.
- After a network failure the next post happens 1 s, 2 s, 4 s later on `ctx.clock` (at most 60 s apart), or at once on `{ kind: 'net', online: true }`.
- `outbox` throws E2651 for an api with a nested `s.secret` in an endpoint body; `keel check` reports E2651 on that fixture and nothing on its clean twin.
- Under one seed, two runs of one script of sends and connectivity changes give byte-equal outbox and server logs.
- With a sim schedule `storage: ['ok', 'fail']` (the load's `get`, then `send`'s `set`), `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`; with `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts.
- Online, `resolve(ctx, o, key, 'mine')` resolves `sent` with the endpoint's output once the re-send answers; offline, `queued`; for a key with no `conflict` entry, `false`. `'theirs'` resolves `true` when it removed an entry, else `false`.
