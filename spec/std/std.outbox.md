# std.outbox: Outbox storage faults
status: conformance-covered

What `@keel/std-offline` (std.offline) does when a `ctx.storage` write rejects or never settles, and when anything else throws inside a flush.

**Storage writes.** A `ctx.storage` write in `send`, a flush or `resolve` that rejects with any value (k.supervise), or has not settled 10 s after it began on `ctx.clock`, leaves the entry `failed` with `offline.storage` in memory, writes the outbox once more and releases the flush, posting no more. A write that settles after those 10 s changes nothing in memory. In `'theirs'` the entry is still removed and `resolve` resolves `true`. A write that throws counts as one that rejects. When the failed write is the one that records the server's answer (`sent`, `conflict` or `failed`), the answer stands: the call resolves it, memory keeps the entry as the answer left it, and the flush writes the outbox once more and ends.

**What storage holds.** When the second write lands, storage holds the entry `failed`, or no entry after `'theirs'`. When it fails too, storage keeps the state of the write that landed last, and `drain` loads that state as it loads any: an entry stored `queued` or `sending` is posted under its own key, so the server store commits it at most once while its `keyLimit` holds the key (k.sync). No stored state tells such an entry apart from one queued normally, so a page told `failed` that calls `send` again, under a new key, can commit the same write twice. After a `sent` answer whose two writes both fail, storage still holds the entry `sending`, and a reload posts it again under its own key, which is safe while the server's `keyLimit` holds the key and commits it a second time beyond that. A write given up at the 10 s bound that settles later is followed by one more write of the outbox as memory then holds it, so the late write is not the last to land unless that write fails too. That is the limit of a storage that rejects every write.

**Errors.** An `offline.storage` or `offline.owner` err is `{ code, message, data: {} }`, its `message` the outbox `id`, never thrown text.

**Other throws.** Only those storage faults become `offline.storage`. Any other throw in a flush releases it: the entries stay as they are in memory (an entry in hand stays `sending`, so this session never posts it again), each call waiting on the flush resolves `queued`, and the error is rethrown as an unhandled rejection. An `events: true` endpoint answers a stream no entry can settle on, so `outbox` throws E2652 for one.

**Rules.** None.

**Conformance.**
- With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`.
- With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key.
- Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted.
- With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts.
- With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`.
- Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key.
- With `storage: ['ok', 'ok', 'ok', 'fail']` online and a route answering 2xx, `send` resolves `sent` with the endpoint's output and the route is posted once; with `['ok', 'ok', 'ok', 'fail', 'fail']`, `drain` on a new ctx over that storage posts the entry again with its key and the server store holds one entry for that write; under the first schedule a 409 with `data.transaction` resolves `conflict` with its `head`.
- Online, with `send`'s storage `set` settling 11 s after it began, the entry is still `failed` with `offline.storage` in memory after that write settles.
- Online, with the flush's `sending` `set` never settling, `send` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted.
- Online, with a `conflict` entry and the `set` of `resolve(ctx, o, key, 'mine')` never settling, `resolve` resolves `failed` with `offline.storage` once `ctx.clock` passes 10 s, and nothing is posted.
- Offline, with `storage: ['ok', 'fail', 'ok', 'fail']`, `resolve(ctx, o, key, 'theirs')` on the entry `send` left `failed` resolves `true`, and `keel.outbox.<id>` then holds no entry with that key.
- Online, with a ctx whose `storage.set` throws synchronously on its second call (the flush's `sending` write), `send` resolves `failed` with `offline.storage`.
- Offline, with `send`'s storage `set` held past 10 s and then released, `keel.outbox.<id>` holds the entry `failed` once that write settles, and `drain` on a new ctx over that storage, online, posts nothing.
- Online, with the flush's `sending` `set` for owner `a`'s entry held, `drain` with owner `b` and then the write released, the entry is not posted and `a`'s `send` resolves `failed` with `offline.owner`.
