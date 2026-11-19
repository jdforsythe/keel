---
"@keel/std-channels": patch
---

`@keel/std-channels`: a serving module's `perCaller`, `perAnonymous` and `maxStreams` count only the streams open on its own channel routes, so two serving modules no longer use up each other's bounds.
