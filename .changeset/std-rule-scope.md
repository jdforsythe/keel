---
"@keel/check": patch
"@keel/compiler": patch
---

A rule a `@keel/std-*` package registers runs on every `check()` call, unless `importDeps` imported the package first in the process and the project's `deps` no longer list it. `importDeps` imports a std package's `./tools` export when the package has no entry.
