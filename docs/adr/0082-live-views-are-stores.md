# ADR-0082: live views are stores hydrated by re-reads (RFC 0081)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 2 and 3.

**Context.** A view must stay current when another user writes. A k.reactive `resource` whose fetcher re-runs goes back to `loading`, so `Match` would rebuild its ready subtree, and lose focus, on every push. golden-1 already keeps its board in a client store replaced by a hydrating transaction, and re-reads only after its own writes (`syncAfter`).

**Decision.** `@keel/std-live`: `live(ctx, origin, channel, params, { read, hydrate })`, inside a scope, subscribes to a channel and after each `reset` and `saved` runs `read` and commits `tx(hydrate, value)`. One read at a time; events during a read cause one more; an older read never commits after a newer one; a failed read retries on `ctx.clock`. It returns a status signal, `connecting`, `live`, `offline` or `denied`. No change to k.reactive. golden-1's `syncAfter` is removed: the writer's own save arrives as a `saved` event too.

**Alternatives.**
- A resource that stays `ready` while re-fetching, or a `push(value)` on resources, rejected: it changes every resource's transitions or adds a second async-read primitive, and the value would not be logged.
- A `Resource` look-alike from std-live, rejected: it registers no `inspect()` node, so `Match` reports no `resource` events.

**Consequences.**
- Each refresh is a logged transaction that sessions record and replays re-derive.
- Each caller holds what its own `read` returns; the head a write names as `base` is ordinary read data.
- std-live has no rules and no diagnostic block.
