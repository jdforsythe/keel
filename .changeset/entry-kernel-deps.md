---
"@keel/compiler": patch
---

A kernel package the generated client entry imports (`@keel/store`, `@keel/ctx` and the rest) resolves from the compiler's own dependencies when the app does not list it, so an app without stores builds without `@keel/store`.
