---
"@keel/compiler": minor
---

`@keel/compiler/entry/*` is now `@keel/compiler/internal/entry/*`, a kernel-only entry `@keel/server` imports; app code that names it is E1576. The generated server and dev entries import `@keel/server/internal/dom` and `@keel/server/internal/start`.

Migration: drop any import of `@keel/compiler/entry/*` from app code.
