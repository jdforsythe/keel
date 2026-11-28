---
"@keel/std-postgres": minor
"@keel/std-channels": minor
"@keel/std-live": minor
---

A channel follows app data. `t.changed(channel, params)` in a std-postgres transaction is delivered after commit, across processes by `pg_notify` and one `LISTEN` connection per URL, in process on PGlite and sim; `db.changed` is its own transaction and `db.follow(channel, key, on)` is the seam. E2460 for params failing the channel's schema or a payload over 7,900 bytes. `channelRoute` takes `follows: [db]` and `stores` is optional; a followed commit is `{ kind: 'changed' }`, naming nothing, and a lost listening connection ends its streams as a drop. `live` re-reads on `changed`.
