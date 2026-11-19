# @keel/std-live

**Spec:** std.live · **Status:** conformance-covered · **verified:** (none)

A client store kept current: it re-reads through its own loader after every push on a channel.

## Contract

- **Public API:**
  - `live(ctx, origin, channel, params, { read, hydrate })`, inside a scope (E1203 outside one), returns `status()`, a signal read of `LiveStatus`. It follows `channel` with `subscribe` (`@keel/std-channels`) and runs `read(ctx)` after each `reset` and each `saved` event; an `ok` value commits `tx(hydrate, value)`. `read` receives the ctx `live` was given. `message` events cause no read.
  - `LiveStatus` (schema and type): `connecting`, `live`, `offline`, `denied`.
- **Invariants:**
  - One read at a time. Any number of events during a read cause exactly one more read after it, so reads commit in the order they started.
  - A read that returns `err`, throws, or whose value `hydrate` refuses commits nothing and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event, whichever is first. A success resets the delay.
  - `status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or that read is pending or failed; `offline` while `ctx.net.online()` is false; `denied` once the channel denies, after which no read runs.
  - Disposing the scope closes the stream, cancels a pending retry and drops the result of a read in flight.
  - Every effect goes through `ctx` (`clock`, `net`, and what `read` does), so one seed and one script of saves give byte-equal logs on the hydrated store.
- **Dependencies:** `@keel/ctx`, `@keel/reactive`, `@keel/schema`, `@keel/std-channels`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for the first read, coalescing, stale reads, read retry, offline, two callers, disposal and determinism; properties for one read per event burst.

## Extension points

None of its own: it composes std.channels `subscribe` with a k.store transaction.

## Unsafe

count: 0
