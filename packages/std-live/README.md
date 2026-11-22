# @keel/std-live

**Spec:** std.live · **Status:** conformance-covered · **verified:** (none)

A client store kept current: it re-reads through its own loader after every push on a channel.

## Contract

- **Public API:**
  - `live(ctx, origin, channel, params, { read, hydrate })`, inside a scope (E1203 outside one), returns `status()`, a signal read of `LiveStatus`. It follows `channel` with `subscribe` (`@keel/std-channels`) and runs `read(ctx, signal)` after each `reset`, `saved` and `changed` event; an `ok` value commits `tx(hydrate, value)`. `read` receives the ctx `live` was given and an `AbortSignal` that aborts when the read's 30 s pass while it is pending and when the scope is disposed while it is pending; a `read` that takes only `ctx` stays valid. `message` events cause no read.
  - `LiveStatus` (schema and type): `connecting`, `live`, `offline`, `denied`.
- **Invariants:**
  - One read at a time: a read is pending until it settles or 30 s pass on `ctx.clock`, whichever is first. Any number of events while one is pending cause exactly one more read after it. A read never commits after its 30 s or after a read started later, so reads commit in the order they started.
  - A read that returns `err`, throws, is not settled within 30 s, or whose value `hydrate` refuses commits nothing and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event, whichever is first. A success resets the delay.
  - `status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or that read is pending or failed; `offline` while `ctx.net.online()` is false; `denied` once the channel denies, after which no read runs.
  - Disposing the scope closes the stream, ends the pending retry and the 30 s wait, and drops the result of a read in flight.
  - Every effect goes through `ctx` (`clock`, `net`, and what `read` does), so one seed and one script of saves give byte-equal logs on the hydrated store.
- **Dependencies:** `@keel/ctx`, `@keel/reactive`, `@keel/schema`, `@keel/std-channels`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for the first read, coalescing, stale reads, read retry, the 30 s read bound, offline, two callers, disposal and determinism; properties for one read per event burst and for settle times on either side of the read bound.

## Extension points

None of its own: it composes std.channels `subscribe` with a k.store transaction.

## Unsafe

count: 0
