# std.outbox: Outbox storage faults
status: proposed

What `@keel/std-offline` (std.offline) does when a `ctx.storage` write rejects or never settles, and when anything else throws inside a flush.

**Storage writes.** A `ctx.storage` write in `send`, a flush or `resolve` that rejects, or has not settled 10 s after it began on `ctx.clock`, leaves the entry `failed` with `offline.storage` in memory, writes the outbox once more and releases the flush, posting no more. A write that settles after those 10 s changes nothing in memory. In `'theirs'` the entry is still removed and `resolve` resolves `true`.

**What storage holds.** When the second write lands, storage holds the entry `failed`, or no entry after `'theirs'`. When it fails too, storage keeps the state of the write that landed last, and `drain` loads that state as it loads any: an entry stored `queued` or `sending` is posted under its own key, so the server store commits it at most once while its `keyLimit` holds the key (k.sync). No stored state tells such an entry apart from one queued normally, so a page told `failed` that calls `send` again, under a new key, can commit the same write twice. That is the limit of a storage that rejects every write.

**Errors.** An `offline.storage` or `offline.owner` err is `{ code, message, data: {} }`, its `message` the outbox `id`, never thrown text.

**Other throws.** Only those storage faults become `offline.storage`. Any other throw in a flush releases it: the entries stay as they are in memory (an entry in hand stays `sending`, so this session never posts it again), each call waiting on the flush resolves `queued`, and the error is rethrown as an unhandled rejection.

**Rules.** None.

**Conformance.**
- With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`.
- With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key.
- Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted.
- With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts.
- With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`.
- Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key.
