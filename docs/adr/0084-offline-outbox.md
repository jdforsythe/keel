# ADR-0084: offline writes are an outbox of k.services calls (RFC 0081)

**Status:** accepted (2026-11-10), user decisions D1 and D2, under the WORKFLOW RFC defaults 2, 4 and 6.

**Context.** Writes made while disconnected must land on reconnect, in order, at most once, and a write refused as concurrent needs the user's decision. golden-1's writes are k.services calls to its `api` deployable.

**Decision.** `@keel/std-offline`. `outbox(id, api, { limit, maxBytes })` over a k.services endpoints map declares a client store of typed entries, persisted in `ctx.storage` `keel.outbox.<id>`. An endpoint it sends to has `body.write: Write` (`{ key, base }`), and its action passes both to `tx`. `send` mints the key with `ctx.random.id('Write')`, adds the entry and flushes; `drain` loads the outbox in a scope and flushes on each reconnect. One FIFO, one request in flight: 2xx removes, a network failure stops the flush and backs off on `ctx.clock`, a 409 with `data.transaction` becomes `conflict` with its head, a 409 without it is sent once more, any other status is `failed`. `resolve(ctx, outbox, key, 'mine' | 'theirs')` re-queues with `base` set to the conflict's head, or drops; the outbox log records it. An endpoint body holding `s.secret` is E2651.

**Alternatives.**
- Queueing raw requests at the net layer, rejected: untyped bodies, so `send` could neither fill `write` nor refuse secrets.
- Replicating log entries to clients and replaying pending ones on top, rejected for S4: a generic apply-transaction endpoint would be a second write path exposing every transaction.
- `resolve` in std-conflicts, rejected: a second way to drop an entry.

**Consequences.**
- No optimistic view in S4: a queued write shows in the outbox, not in the live view.
- Bounded at 100 entries and 256 KiB by default; a full outbox refuses with `offline.full`.
- golden-1's toggle, add and edit writes go through its outbox (D2).
