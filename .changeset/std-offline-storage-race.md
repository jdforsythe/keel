---
"@keel/std-offline": patch
---

A flush already running does not post an entry from `send` or a `'mine'` `resolve` until that entry's write to `ctx.storage` settles, so a write that rejects leaves the entry `failed` with `offline.storage` and nothing posted. An `offline.storage` error's message is the outbox id, never the text the storage threw.

After a rejected storage write the outbox is written once more, so storage holds the entry `failed`; when that write is rejected too, storage keeps its last written state. A storage write not settled 10 s after it began on `ctx.clock` counts as rejected. Only a storage write's rejection becomes `offline.storage`: any other throw in a flush releases it, leaves the entries as they are, resolves the calls waiting on it `queued` and is rethrown. `resolve` with `'theirs'` resolves `true` also when its storage write rejects.

A flush posts an entry only while, once its `sending` write settles, it is still `sending` and its owner is the ctx's; an entry a `drain` with another owner failed meanwhile is not posted and its call resolves `failed` with `offline.owner`. When the write recording the server's answer fails, the answer stands and the call resolves it. A `ctx.storage.set` that throws counts as rejected, and a write given up at the 10 s bound that lands later is followed by one more write of the outbox.
