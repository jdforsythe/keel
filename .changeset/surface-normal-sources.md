---
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": minor
---

`.keel/surface.json`'s `sources` hashes each file's normal form (k.compat Sources), built from its syntax tree by `sourceForm` and `sourceHash` of `@keel/compiler/internal`: a formatter's import sort, re-indent, quote or comma change, a comment or a line ending is not E1005, and a change to anything else is. `keel check` builds the form from a parse and evaluates nothing.
