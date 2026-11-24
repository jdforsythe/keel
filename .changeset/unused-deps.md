---
"@keel/check": minor
"@keel/scaffold": minor
---

E1165: a `deps` entry the module does not use, an error at the entry with a fix that removes it. An app module in `deps` is used when a non-test file of the module imports from it (static, type-only, re-export or literal dynamic import, the contract included) or a binding of either module names a layout of the other; `@keel/std-*` entries are not judged, and E1153 is unchanged. `keel explain E1165` is new. `keel codemod move` removes each `deps` entry the move leaves unused, and the check stand-in of `@keel/scaffold` reads E1165.
