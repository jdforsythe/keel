---
"@keel/ctx": minor
"@keel/compiler": patch
"@keel/check": patch
---

`ctx.storage` gains `read(keys)` (one cut) and `commit(writes)` (compare-and-set over several keys; one key twice rejects E1606) in real, sim and `fileStorage`. `createCtx({ drivers: { storage?, net? } })` replaces the `storage` option on a `real` or `shell` ctx and throws E1605 on `sim`; a sim `read` or `commit` takes one schedule step. The `keel dev` entry passes `fileStorage` as `drivers.storage`, and `keel explain` has E1605 and E1606.
