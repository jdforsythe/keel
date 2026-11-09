---
"@keel/reactive": minor
"@keel/check": minor
---

`scope(fn, { detached: true })` creates a root scope: it has no `parent`, no owner disposes it or lends it an `onError`, and `fn` runs untracked with writes still checked. Only its own `dispose()` ends it. Check rule E1207 reports `detached: true` or a non-literal options object passed to `scope` in app code: a detached scope escapes `uses` and the request store registry, so only kernel and stdlib code create one.
