# @keel/std-channels

**Spec:** std.channels · **Status:** proposed · **verified:** (none)

Named channels between users over a server event stream: a member re-reads after each save, and members exchange schema-typed messages.

## Contract

- **Public API:** stdlib module `channels` (`module.ts` at the package root; capabilities `clock`, `net`, `observe`).
  - `channel(name, { path, params, message? })` in a shared file whose name is the export. `params` is parsed from the stream URL's search and picks an instance; `message` is what members publish (absent: nothing can be published). It throws E2602 (an Error with `code`) when `message` holds an `s.secret`.
  - `subscribe(ctx, origin, channel, params, on)`, inside a scope, returns `{ status, close }`. `status()` reads a signal: `connecting`, `open` (once `reset` arrived), `offline`, `denied`. `publish(ctx, origin, channel, params, message)` resolves `Result<null, ApiError>`. Both go through `@keel/services` on the channel's path.
  - Types `Channel`, `ChannelEvent`, `ChannelStatus`, `Subscription`.
  - `./server` (node): `channelRoute(channel, { id, stores, member })` in a `*.server.ts` file returns `{ id, path, loader, actions: { POST } }`. List `{ api: true, path, loader }` under `id` in the serving module's manifest and pass `actions` to `routes.actions`. `ChannelsConfig` is the `std['@keel/std-channels']` schema `{ perCaller?, maxStreams? }`, registered under the package name. Types `ChannelRoute`, `Member`.
  - `./tools` (node): E2601 (`channelRoute` outside a `*.server.ts` app file) and E2602 (a `channel` whose `message`, inline or a `const` of the same file, holds `s.secret`). Neither has a fix.
- **Invariants:**
  - Every open goes through the k.server live loader: the caller comes from the caller cookie, which an event-stream GET never sets. `member` runs first: false, or a throw, makes `closed` `denied` the only event, so a non-member learns nothing about the caps. Past the serving module's `perCaller` streams for that caller (default 8) or `maxStreams` for the process (default 1,000), the only event is `closed` `full`.
  - An open stream gets `reset`, then `saved` `{ store, head }` for each `save` the server ctx reports of a store its `stores` instance holds, in report order. Before each one its stores are restored from `ctx.storage` `keel.store.<id>` and `member` runs again; false, or a failed read or restore, ends the stream with `closed` `denied`, and later saves still reach the other streams.
  - A publish is an action: the k.server same-site proof, `maxBodyBytes` and 422 `keel.fields` apply. `member` false is 403 `keel.denied`; else every open stream of the same channel and params in this process gets `message` and the answer is `ok(null)`. A stream whose re-check after a save is pending gets the message once that re-check allows it, and none when it ends the stream. A channel without `message` answers 403. A message is never stored or logged.
  - Events carry only `kind`, `store`, `head`, `message` and `reason`: no caller, cookie or store state.
  - A stream holds at most 256 unread events; past that it ends and the client reopens with `reset`.
  - `subscribe` starts its stream after the current tick, so a page or layout may call it while rendering inside an effect: the first `status()` is the signal's initial value (`connecting`, or `offline`), and nothing is written during the render.
  - The client reopens 1 s after a stream ends, doubling to 30 s on `ctx.clock`; a `reset` starts the doubling over. While `ctx.net.online()` is false it sends nothing and aborts an open stream, and it reconnects at once on `{ kind: 'net', online: true }`. After `closed` `denied` it stops. Disposing its scope, or `close()`, aborts the request and `on` gets no later event.
  - Every effect goes through `ctx`: `clock.after`, `net.fetch` (through `@keel/services`), `net.online`, `observe`, `storage.get`.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/compiler` (`module`, `stdConfig`), `@keel/ctx`, `@keel/reactive`, `@keel/router`, `@keel/schema`, `@keel/server`, `@keel/services`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for reset and saved, member at open and after saves, publish scope and proof, no identity in events, `perCaller`, subscribe backoff and dispose, and E2601 and E2602; properties for the event schema round trip, params instance keys, the inbox bound, the backoff sequence with resets, and E2602 under any nesting.

## Extension points

Uses the **module manifest** (k.module: stdlib module `channels` and `std` config `{ perCaller, maxStreams }`) and the **check rule registry** (k.check: E2601 and E2602 from `./tools`).

## Unsafe

count: 0
