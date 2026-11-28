---
"@keel/std-live": patch
---

`live()` outside a scope throws E1203 through `defect`; its message reads `E1203 live() called outside any scope; wrap it in scope(fn)`. The package has no `unsafe/` folder.
