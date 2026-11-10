# ADR-0081: server push is an invalidation on a live loader; writes stay actions (RFC 0081)

**Status:** accepted (2026-11-10), user decisions D1 and D3 and the reconciliation D4 with RFC 0080, under the WORKFLOW RFC defaults 2, 4 and 5.

**Context.** S4 needs named channels between users and a way for a client to learn that a server store changed. RFC 0080 (ADR-0076) gives one stream transport: a live loader written with Hono's `streamSSE` and read by a k.services `events: true` endpoint, with no resume, no reconnect and no cap, leaving fan-out and membership to the consumer. An action cannot publish safely, since its save runs after it returns and can still be 409.

**Decision.** `@keel/std-channels`. `channel(name, { path, params, message? })` is a shared declaration; `channelRoute(channel, { id, stores, member })` in a `*.server.ts` file returns `{ id, path, loader, actions: { POST } }`, its loader live. The loader yields `reset` first, `saved { store, head }` after each save of a store its factory creates (fed by k.server's `save` report through one `observe` per app ctx), `message` for each publish to the same params, and `closed` with `denied` or `full`. `member` is a pure predicate over `caller`, `params` and the stores, run at open, at each publish and after each save. Values never travel on the push: members re-read through their own loaders. Messages exist only where a `message` schema declares them, carry no publisher identity unless that schema has one, refuse secrets (E2602) and are never stored. `subscribe` reads through an `events` endpoint and owns its backoff; `perCaller` and `maxStreams` are the package's server-only config.

**Alternatives.**
- WebSocket, rejected: writes on a socket would bypass actions (write proof, `maxBodyBytes`, 409, keys), and Node needs the `ws` package and an upgrade outside `createApp`'s `fetch`.
- Pushing values or patches, rejected: a second read path needing its own authorization and redaction per subscriber.
- Resume by event id, rejected: every open yields `reset` and the client re-reads.

**Consequences.**
- One read path and one write path; the push carries a store id and a head.
- Fan-out reaches the streams open in the process that saved; a split topology or several instances need a broker in a later RFC.
- `channelRoute` outside `*.server.ts` is E2601.
