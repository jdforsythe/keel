---
"@keel/std-channels": minor
"@keel/check": patch
---

A serving module's contract writes a channel's stream and publish entries out, naming the schemas `channel` gives (`events`, `body`) and the channel's `params` as their `query`; `channelRoute(contract, channel, { id, publish?, stores, member })` returns `{ loader, action }`, which `manifest` binds by entry, its handlers declared through the serving module's `contract` (E1515 naming each member of an entry that is not the channel's). `publish` is required exactly when the channel has `message`. Params that fail the channel's schema answer 422 `keel.fields`. E1111 reports an unreadable spread of contract entries at the spread and still reads the entries beside it.
