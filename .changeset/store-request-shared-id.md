---
"@keel/store": patch
---

Two `stores` factories in one request that create a store with the same id: the second one to open rejects with `store <id>: id already in use by a live store`, so no save drops a change made through the first.
