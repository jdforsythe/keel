---
"@keel/check": patch
"@keel/cli": patch
---

`keel check`, and the check `keel build` runs, keep the type pass's results in the project's `node_modules/.cache/keel` when `node_modules` exists (k.check-cache). An entry records every file system question the pass asked (file bytes by SHA-256, existence, real paths, listings) and is used only when all of them answer the same again, so a result taken from it is the one a run with the folder deleted gives; `check()` takes the folder as `typeCache`, and its in-process memo is held to the same questions. The `keel` binary starts under Node's compile cache where Node has one.
