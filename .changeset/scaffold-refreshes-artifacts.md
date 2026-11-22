---
"@keel/cli": patch
---

In a project that holds `.keel/` artifacts, `keel scaffold` and `keel codemod` run `keel build` after writing their edit set, so `keel check` stays clean after the operation.
