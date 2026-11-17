---
"@keel/std-offline": minor
---

`resolve(ctx, outbox, key, 'mine')` resolves the re-sent entry's `OutboxResult` once the outbox answers it, or `false` when no entry was re-sent; `'theirs'` resolves a `boolean`. A rejected storage write in a `'mine'` `resolve` leaves the entry `failed` with `offline.storage`. The value of a `sent` result is typed by the endpoint's output.
