---
"@keel/ctx": minor
"@keel/std-db": minor
"@keel/std-channels": minor
"@keel/check": patch
---

A server store's save reaches the live streams of every replica. A storage may have `watch(on)`, reporting the `keel.store.` keys another storage object on the same data committed (never a value); a sim ctx's storage has one, and `replica(ctx)` from `@keel/ctx` makes a second sim ctx on the same data, clock, net and capabilities with its own observers (E1604 off sim). `std-db`'s `postgres` driver provides `watch` over `LISTEN`/`NOTIFY`, a `pg_notify` inside each store commit's transaction on one listening connection. `channelRoute` with `stores` watches before `reset`, reads each reported key and delivers `saved` with the stored head, heads rising per stream; a lost watch ends the stream as a drop. `message` stays in the serving process. An app on one process or on `'file'` or `'sqlite'` storage pays nothing.
