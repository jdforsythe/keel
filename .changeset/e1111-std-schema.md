---
"@keel/check": patch
---

E1111 reads a route `search` or `params` schema built by a call to a function imported from a `@keel/std-*` package (`tableSearch(columns)`, also through a namespace import) as the package's, as it reads a package's route table; the package's own rule guards it.
