# std.offline: Outbox
status: conformance-covered

**Extension points.** Check rule registry: E2651 through `@keel/std-offline/tools`.

**Declare.** In a client-safe file whose name is the export:
```ts
export const boardOutbox = outbox('todos.outbox', api, { limit: 100 })
```
`outbox(id, contract, { limit = 100, maxBytes = 262144 })`, over the contract's API write entries (k.contract), creates client store `id` (prefixed, E1155), state `{ entries: OutboxEntry[] }`, changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. `OutboxEntry` is `{ key, endpoint, owner, input, base, at, state, head?, error? }`, `state` `queued`, `sending`, `conflict` or `failed`.

**Write.** An outbox endpoint's `body` holds `write: Write`, `s.object({ key: s.id('Write'), base: s.int({ min: 0 }), owner: s.string() })`; its action passes it through `writeFor` (std.outbox-owner).
```ts
const r = await send(ctx, boardOutbox, 'editTodo', { params: { todoId }, body: { title } }, { base: view.get('head'), owner })
```
`send` adds an entry with `body.write` `{ key: ctx.random.id('Write'), base }`, stores the outbox at `ctx.storage` `keel.outbox.<id>`, and flushes. It resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }` (offline or network failure), `{ state: 'conflict', head }` or `{ state: 'failed', error }`, `error` an `ApiError`, `offline.full` (at `limit` entries or `maxBytes` encoded), `offline.storage` or `offline.owner`. Storage faults and other throws in a flush: std.outbox.

**Owner.** `send` and `drain` require `owner`: the signed-in user's id, else `""`; an entry holds its `send`'s. A flush posts only entries of the owner last given on the ctx. When it changes, and on load, each other owner's entry not `failed` is stored `failed` with `offline.owner`, unless the owner given is `""`, which holds them `queued` (std.outbox-owner), as is a stored entry with an `origin` or no `owner`. A `failed` entry is never posted.

**Flush.** In order, one request at a time, through `service({ contract })`, answers read as it reads them:
- 2xx: `sent`; the entry is removed.
- `api.network` or `api.timeout`: it stays `queued`; flushing stops until `{ kind: 'net', online: true }`, the next `send`, or 1 s later doubling to 60 s on `ctx.clock` while `online()`.
- 409 `keel.conflict` with `data.transaction` (k.sync): `conflict`, keeping `data.head`; the next entry goes.
- 409 without it: sent once more; a second is `failed`.
- Any other status: `failed` with its `ApiError`; `offline.signin`: std.outbox-owner; the next entry goes.

`drain(ctx, outbox, { owner })`, in a scope, loads the stored outbox (`sending` as `queued`) and flushes, again on each reconnect until the scope ends, which drops a pending retry. A resent entry keeps its key, so a committed write is not repeated (k.sync).

**Resolve.** `resolve(ctx, outbox, key, 'mine' | 'theirs')`. `'mine'` queues a `conflict` entry last, with `base` its `head`, flushes, and resolves as `send` does. `'theirs'` removes a `conflict` or `failed` entry, `true`. Without one, each resolves `false`. The outbox log records each as `<id>.resolve` `{ key, resolution }`.

**Privacy.** Entries stay in browser storage and go only to the contract's module, for their owner; E2651 keeps secrets out. Sessions record its transactions under the module's `redact`.

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
- On an unbound sim ctx, `send` posts to `http://<module>.keel.invalid` plus the path; the stored entry has `owner`, no `origin`.
- Stored entries of owner `a`: `drain` with `a` posts them; with `b`, none, each `failed` with `offline.owner`, as is one with an `origin` or no `owner`; so does `send` with `b` after `a`'s.
- An `offline.storage` err's `message` is the outbox `id`, whatever was thrown.
- Once the `drain` scope ends, its pending retry posts nothing.
