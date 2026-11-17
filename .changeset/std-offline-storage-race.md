---
"@keel/std-offline": patch
---

A flush already running does not post an entry from `send` or a `'mine'` `resolve` until that entry's write to `ctx.storage` settles, so a write that rejects leaves the entry `failed` with `offline.storage` and nothing posted. An `offline.storage` error's message is the outbox id, never the text the storage threw.
