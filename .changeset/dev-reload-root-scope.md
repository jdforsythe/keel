---
"@keel/compiler": patch
"@keel/reactive": patch
---

`keel dev` loads the app's server modules under one root scope per load and, after an edit, ends it once that load's apps have closed and loads the server graph again whole, so a module-level store (an outbox made at a module's top level) frees its id and the page renders again instead of failing `id already in use by a live store`.
