---
"@keel/std-offline": minor
---

`@keel/std-offline`: `outbox` (a client store of writes persisted in `ctx.storage`, E2651 for a secret in an endpoint body), `Write` `{ key, base }`, `send`, `drain` and `resolve('mine' | 'theirs')`; entries flush in order one request at a time with their original keys, back off on `ctx.clock` (1 s doubling to 60 s), resume on reconnect, and keep a k.sync conflict's head; rule E2651 in `./tools`.
