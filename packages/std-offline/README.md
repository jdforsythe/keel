# @keel/std-offline

**Spec:** std.offline · **Status:** conformance-covered · **verified:** (none)

An outbox of writes made offline: each keeps its key and base, goes out in order on reconnect, and waits for the user when refused.

## Contract

- **Public API:**
  - `outbox(id, api, { limit = 100, maxBytes = 262144 })`, inside a scope, over a k.services `endpoints` map, returns the client store `id` (type `Outbox<D>`) with state `{ entries: OutboxEntry[] }`, changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. It throws E2651 (an Error with `code`) when an endpoint body holds an `s.secret`.
  - `Write` (schema and type) `{ key: s.id('Write'), base: s.int({ min: 0 }) }`: the `write` field of each endpoint body an outbox sends to. The action passes it to the store: `tx(t, payload, { meta, ...input.write })`.
  - `send(ctx, outbox, origin, endpoint, input, { base })`, `input` typed by the endpoint without `body.write`, resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }`, `{ state: 'conflict', head }` or `{ state: 'failed', error }` (an `ApiError`, or `offline.full`).
  - `drain(ctx, outbox)`, inside a scope (E1203 outside one), loads the stored outbox, flushes, and flushes again on each `{ kind: 'net', online: true }` until the scope is disposed.
  - `resolve(ctx, outbox, key, 'mine' | 'theirs')` resolves `true` when it applied: `'mine'` queues a `conflict` entry again, last, with `base` set to its `head`, and flushes; `'theirs'` removes a `conflict` or `failed` entry.
  - Schemas and types `OutboxEntry` (`{ key, endpoint, origin, input, base, at, state, head?, error? }`), `Resolution`; types `Outbox`, `OutboxResult`, `SendInput`.
  - `./tools` (node): rule E2651, an `outbox` whose endpoints map (inline, a `const` of the same file, or one imported from a project file) has an endpoint body holding `s.secret`. No fix.
- **Invariants:**
  - `send` adds an entry with `body.write` `{ key: ctx.random.id('Write'), base }` and `at` from `ctx.clock`, writes `{ entries }` as JSON to `ctx.storage` `keel.outbox.<id>`, and flushes when online. An outbox holding `limit` entries, or whose encoded entries would pass `maxBytes`, refuses with `offline.full` and adds nothing.
  - One flush per outbox, one request in flight, entries in the order added, each through `service({ base: origin })` with its original key. 2xx removes the entry. `api.network` and `api.timeout` keep it `queued` and stop the flush until the next `send`, a reconnect while draining, or a retry 1 s later doubling to 60 s on `ctx.clock` while online. A 409 whose declared body is a `keel.conflict` err naming `data.transaction` leaves it `conflict` with `data.head`; another 409 is sent once more, then `failed`. Any other status is `failed` with its `ApiError`. The flush moves on after `conflict` and `failed`.
  - The conflict head is read from the endpoint's declared 409 body, so each endpoint an outbox sends to declares `errors: { 409: s.json() }`. Without it a refusal is sent once more and then `failed`.
  - `drain` adds each stored entry the store lacks, a `sending` one as `queued`. A resent entry keeps its key, so a write the server already committed commits nothing again.
  - Every effect goes through `ctx` (`clock`, `net`, `random`, `storage`) and `observe`, so one seed and one script of sends and connectivity changes give byte-equal outbox and server logs.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/ctx`, `@keel/reactive`, `@keel/schema`, `@keel/services`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for sending online, queueing offline, flush order, lost responses, 409s, resolve, a full outbox, backoff, E2651 and determinism; properties for scripts of sends, connectivity changes and lost responses that apply every entry once, in order.

## Extension points

Uses the **check rule registry** (k.check: E2651 from `./tools`).

## Unsafe

count: 1. `unsafe/asResult.ts`: a `sent` value is decoded by the output schema of the endpoint `send` named, so it takes that endpoint's output type.
