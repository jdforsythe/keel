---
"@keel/store": minor
"@keel/ctx": minor
"@keel/server": minor
---

A store has a head: `head()` rises by one per commit and per undo that undoes, and `snapshot()` carries it. `tx` takes `base` and `key`: a `key` a kept entry holds commits nothing; a `base` other than the head is a concurrent write, refused with `keel.conflict` (409 from an action) or, for a transaction declared `{ concurrent: 'rebase' }`, run on the current state. `ctx.net.online()` reports connectivity; the sim net has `setOnline`. Observers receive `{ kind: 'net', online }` and, after an action's saves are stored, `{ kind: 'save', store, head }` per saved store.
