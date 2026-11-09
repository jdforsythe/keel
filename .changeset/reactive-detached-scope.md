---
"@keel/reactive": minor
---

`scope(fn, { detached: true })` creates a root scope: it has no `parent`, no owner disposes it or lends it an `onError`, and `fn` runs untracked with writes still checked. Only its own `dispose()` ends it.
