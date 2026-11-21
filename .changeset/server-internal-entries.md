---
"@keel/server": minor
---

`@keel/server/dom` is now `@keel/server/internal/dom` and `@keel/server/start` is now `@keel/server/internal/start`. Both are kernel-only entries the generated server and dev entries import; app code that names them is E1576.

Migration: drop any import of `@keel/server/dom` or `@keel/server/start` from app code; the generated entries import the new paths.
