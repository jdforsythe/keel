# ADR-0076: live loaders stream over SSE and `events` endpoints read them (RFC 0080)

**Status:** accepted (2026-11-10), user decision D1 and the reconciliation D5 with RFC 0081, under the WORKFLOW RFC defaults 1, 2 and 4.

**Context.** A document is one string and a loader returns one `Result`; no response streams. S3 promises long responses, and RFC 0081's channels need a server event stream that runs like a loader and a reader over `ctx.net.fetch`, with no resume and with their own fan-out. `EventSource` is absent on Node 22 and 24 without a flag, cannot send `x-keel`, and bypasses `ctx.net`.

**Decision.** A loader whose `fn` is an async generator is live, in `node` deployables only (E1558). A document or JSON GET takes its first yield. A GET with `accept: text/event-stream` runs the loader flow (params, search, guards; a denial is 403 `keel.denied`), then writes one `data:` line per yield, its `Result` JSON encoded by `output`, and a `:` heartbeat every 15 s of `ctx.clock`, until `fn` returns or its `signal` aborts on request abort or `close()`. The writer borrows Hono's `streamSSE`. A k.services GET endpoint with `events: true` reads it as an `AsyncIterable<Result<T, ApiError>>`, decoding `ok` values with `output`, with no reconnect and no resume. Fan-out, membership, caps and reconnect policy belong to the consumer; no `@keel/std-streams` package is created.

**Alternatives.**
- A `stream` route field or a `stream()` server function, rejected: a second way to read data, and k.router has no room.
- A `@keel/std-streams` package with topics, replay by id and reconnect, rejected: each would be a second way beside RFC 0081's std.channels, which keeps its own hub, re-reads on open and sets its own backoff.
- WebSockets, rejected: writes on a socket would bypass actions, and Node needs the `ws` package and an upgrade path outside `fetch`.
- `EventSource` as the reader, rejected for the reasons above.
- A kernel cap on open streams, rejected: a cap is policy, held by the consumer's config.

**Consequences.**
- One transport for S3 and S4. A stream stores nothing, so a reconnecting client re-reads.
- k.server is at 1,491 tokens, 1,499 with RFC 0081's edit; the public origin's text sits in k.topology.
- The reader adds about 0.25 kB to `@keel/services`; the writer adds glue only to `@keel/server`.
