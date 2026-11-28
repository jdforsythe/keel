---
"@keel/store": minor
"@keel/check": minor
"@keel/cli": minor
---

`.keel/surface.json` lists each store a loader's or action's `stores` factory creates, with its state schema and each transaction's payload schema (`storeShapes` from `@keel/store/internal`). `keel check --base` reports E1563 when a store's current state schema refuses its deployed one (fix: make an added required field optional) and W1564 when a deployed transaction is gone or its payload narrowed.
