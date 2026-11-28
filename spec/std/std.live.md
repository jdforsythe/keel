# std.live: Live views
status: conformance-covered
**Extension points.** None of its own: it composes std.channels `subscribe` with a k.store transaction.

**API.**
```ts
const status = live(ctx, origin, boardChannel, {}, { read: (ctx) => readBoard(origin, ctx), hydrate })
```
`live(ctx, origin, channel, params, { read, hydrate })` runs inside a scope (a component or `scope(fn)`; outside one it throws E1203) and returns `status`, a signal read: `'connecting' | 'live' | 'offline' | 'denied'`. It subscribes to the channel and runs `read(ctx, signal)` (`Promise<Result<P, E>>`, a loader or k.services call; `signal` is an `AbortSignal` the read may pass on as the k.services `signal`, and a `read` that takes only `ctx` stays valid) after each `reset`, `saved` and `changed` event; an `ok` value commits `tx(hydrate, value)`. `hydrate` is a transaction on a client store with payload `P`, listed in the calling component's `uses` (E1301). `message` events are not its concern.
- One read at a time: a read is pending until it settles or 30 s pass on `ctx.clock`, whichever is first. Events that arrive while one is pending cause exactly one more read after it, and a read never commits after its 30 s or after a read started later.
- `status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or a read is pending or failed for any other reason; `offline` while `ctx.net.online()` is false; `denied` once the channel denies or a read is refused. A read is refused when its `err` is `api.status` with `status` 401 or 403, or a KeelError with code `keel.denied` (a direct loader call). A refused read commits nothing, closes the stream and stops reading, as a channel denial stops `subscribe`. `denied` ends that `live` call; a later sign-in shows on the next navigation or reload, which mounts the page again.
- A failed read (an `err`, or a throw of any value, k.supervise), or one not settled within 30 s, commits nothing and runs again 1 s later, doubling to 30 s on `ctx.clock`, or at the next event, whichever is first.
- Disposing the scope closes the stream and drops the result of a read in flight.
- A read's `signal` aborts when its 30 s pass while it is pending and when the scope is disposed while it is pending, so a read whose result can no longer commit is cancelled; a read that ignores `signal` stays bounded.

A live view is a client store kept current by its hydrating transaction. Values never travel on the push, so each caller holds what its own `read` returns, and each hydration is a logged transaction that a session records and a replay re-derives. The head a write names as its `base` (k.sync) is data the app's `read` returns like any other field.

**Rules.** None.

**Conformance.**
- After the stream opens, `read` runs once and its value is committed with `hydrate`; `status()` is `connecting` before that commit and `live` after it.
- Three `saved` events during one read cause exactly one more read.
- A read that resolves after a read started later commits nothing.
- A read returning `err` commits nothing, `status()` is `connecting`, and reads run again 1 s, then 2 s, then 4 s later on `ctx.clock` until one succeeds.
- Under sim, after `setOnline(false)`, `status()` is `offline` and no read runs; after `setOnline(true)` the stream reopens and exactly one read runs.
- With callers A and B subscribed to one sim server, a write by A is in B's hydrated store after B's next read (B's `read` of the board snapshot through B's ctx storage, started by the `saved` that reached B's stream), with no input from B.
- Disposing the scope closes the stream, and a read in flight then commits nothing.
- Under one seed, two runs of one script of saves give byte-equal logs on the hydrated store.
- Under sim, after a committed read, a `saved` event starts a read that never settles; once `ctx.clock` passes 30 s from its start, `status()` is `connecting`, and 1 s later a second read runs; when that one settles `ok`, it commits and `status()` is `live`.
- Under sim, a read that never settles has its `signal` not aborted 29,999 ms after it starts and aborted at 30,000 ms; disposing the scope while another such read is pending aborts its `signal`.
- A `changed` event during one read causes exactly one more read; with callers A and B on one sim server whose route follows a database, a write by A that calls `changed` is in B's hydrated store after B's next read.
- A read answering `api.status` 403 commits nothing, `status()` is `denied`, the stream's request is aborted, and no read runs after 1 s, 2 s or 30 s on `ctx.clock`; a read answering `api.status` 502 leaves `status()` at `connecting` and reads again 1 s later.
- A read returning a KeelError `keel.denied` gives `denied`.
- With callers A and B live on one sim server and B's session removed, A's write leaves B's `status()` at `denied` and B's hydrated store as it was.
- Under sim, with callers A and B live on one page, A through a `createApp` on ctx `a` and B through one on `replica(a)` (k.sim Replicas), a write by A to a store the channel's `stores` creates is in B's hydrated store after B's next read, with no input from B.
