---
"@keel/std-offline": patch
---

A flush already running does not post an entry from `send` or a `'mine'` `resolve` until that entry's write to `ctx.storage` settles, so a write that rejects leaves the entry `failed` with `offline.storage` and nothing posted. An `offline.storage` error's message is the outbox id, never the text the storage threw.

After a rejected storage write the outbox is written once more, so storage holds the entry `failed`; when that write is rejected too, storage keeps its last written state. A storage write not settled 10 s after it began on `ctx.clock` counts as rejected. Only a storage write's rejection becomes `offline.storage`: any other throw in a flush releases it, leaves the entries as they are, resolves the calls waiting on it `queued` and is rethrown. `resolve` with `'theirs'` resolves `true` also when its storage write rejects.
