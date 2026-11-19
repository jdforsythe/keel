---
"@keel/testing": patch
---

`prove` keeps its query text on the Z3 heap for the whole call and runs one call at a time. Under heavy load the solver library could overwrite the tail of a query that was still being read, which showed as `Z3 refused the translation` or as a counterexample with wrong values.
