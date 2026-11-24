---
"@keel/check": patch
"@keel/cli": patch
---

`keel check` keeps the type pass's results in the project's `node_modules/.cache/keel`, each used only while every file the pass read keeps its mtime, so a `keel check` after a `keel build` over the same sources skips the TypeScript program; `check()` takes the folder as `typeCache`. The `keel` binary starts under Node's compile cache.
