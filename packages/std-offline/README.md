# @keel/std-offline

**Spec:** std.offline · **Status:** conformance-covered · **verified:** (none)

An outbox of writes made offline: each keeps its key and base, goes out in order on reconnect, and waits for the user when refused.

## Contract

- **Public API:**
  - `outbox(id, api, { limit = 100, maxBytes = 262144 })`, over a k.services `endpoints` map, returns `Outbox<D>`: the reads and log of the client store `id` (`get`, `select`, `head`, `log`, `snapshot`, `restore`, …) with state `{ entries: OutboxEntry[] }`, changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. Inside a scope the store is created at once and the outbox stops flushing when that scope is disposed; at module level (no scope) it is created on first use and lives as long as the module, as a module-level `store` does. It throws E2651 (an Error with `code`) when an endpoint body holds an `s.secret`.
  - `Write` (schema and type) `{ key: s.id('Write'), base: s.int({ min: 0 }) }`: the `write` field of each endpoint body an outbox sends to. The action passes it to the store: `tx(t, payload, { meta, ...input.write })`.
  - `send(ctx, outbox, origin, endpoint, input, { base })`, `input` typed by the endpoint without `body.write`, resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }`, `{ state: 'conflict', head }` or `{ state: 'failed', error }` (an `ApiError`, `offline.full`, or `offline.storage` when a write to `ctx.storage` rejected).
  - `drain(ctx, outbox)`, inside a scope (E1203 outside one), loads the stored outbox, flushes, and flushes again on each `{ kind: 'net', online: true }` until the scope is disposed.
  - `resolve(ctx, outbox, key, 'mine' | 'theirs')` resolves `false`, changing nothing, for a key with no such entry. `'mine'` queues a `conflict` entry again, last, with `base` set to its `head`, flushes, and resolves that entry's `OutboxResult` as `send` does (`queued` when offline or the flush stops first; typed `false | OutboxResult<O>`, `O` the union of the api's outputs); `'theirs'` removes a `conflict` or `failed` entry and resolves `true` (`boolean`). A `Resolution`-typed argument resolves the union of both.
  - Schemas and types `OutboxEntry` (`{ key, endpoint, origin, input, base, at, state, head?, error? }`), `Resolution`; types `Outbox`, `OutboxResult`, `SendInput`.
  - `./tools` (node): rule E2651, an `outbox` whose endpoints map (inline, a `const` of the same file, or one imported from a project file) has an endpoint body holding `s.secret`. No fix.
- **Invariants:**
  - `send`, `drain` and `resolve` first load the outbox stored in `ctx.storage` `keel.outbox.<id>`, once per ctx, so a write made before `drain` keeps the stored entries. The load adds, in order, each stored entry the store lacks, a `sending` one as `queued`, while the entries stay within `limit` and `maxBytes`; the rest are not loaded, and the next write of the outbox drops them.
  - `send` adds an entry with `body.write` `{ key: ctx.random.id('Write'), base }` and `at` from `ctx.clock`, writes `{ entries }` as JSON to `ctx.storage` `keel.outbox.<id>`, and flushes when online. An outbox holding `limit` entries, or whose encoded entries would pass `maxBytes`, refuses with `offline.full` and adds nothing. When the write to `ctx.storage` of `send` or of a `'mine'` `resolve` rejects, the entry is `failed` with `offline.storage` (in memory), nothing is posted, and the call resolves that `failed`. A flush already running does not post the entry until that write settles. An `offline.storage` error's message is the outbox id, never the text the storage threw, so a `Form` can show it.
  - One flush per outbox, one request in flight, entries in the order added, each through `service({ base: origin })` with its original key, every answer read as JSON and then as a `module` service reads a route's `Result`: a 2xx `{ ok: true, value }` gives `value` decoded by `output`, an error status the err's `error` decoded by `errors[status]`; a schema that does not decode that part is tried on the whole body (a bare 2xx output, or a map whose schemas describe the whole k.server answer). 2xx removes the entry. `api.network`, `api.timeout` and a 502 `keel.unreachable` err keep it `queued` and stop the flush until the next `send`, a reconnect while draining, or a retry 1 s later doubling to 60 s on `ctx.clock` while online. A 409 `keel.conflict` err naming `data.transaction` leaves it `conflict` with `data.head`, whether or not the endpoint declares a 409; another 409 is sent once more, then `failed`. Any other status is `failed` with its `ApiError`. The flush moves on after `conflict` and `failed`.
  - An entry naming no endpoint of the outbox's api (an own key of the map) is `failed` with `api.input`. A write to `ctx.storage` that rejects while flushing fails the entry in hand with `offline.storage` (in memory) and releases the flush, so later sends flush.
  - A resent entry keeps its key, so a write the server already committed commits nothing again while the store keeps that key: its last `logLimit` keyed writes.
  - Every effect goes through `ctx` (`clock`, `net`, `random`, `storage`) and `observe`, so one seed and one script of sends and connectivity changes give byte-equal outbox and server logs.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/ctx`, `@keel/reactive`, `@keel/schema`, `@keel/services`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for sending online, queueing offline, flush order, lost responses, 409s, resolve and its answer, a rejected storage write, a full outbox, backoff, E2651 and determinism; properties for scripts of sends, connectivity changes and lost responses that apply every entry once, in order.

## Extension points

Uses the **check rule registry** (k.check: E2651 from `./tools`).

## Unsafe

count: 1. `unsafe/asResult.ts`: a `sent` value is decoded by the output schema of the endpoint `send` named, so it takes that endpoint's output type.
