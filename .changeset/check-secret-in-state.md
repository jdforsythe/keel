---
"@keel/check": minor
"@keel/store": patch
---

New kernel rule E1303 (k.store): a secret reaching store state. It reports a `store(...)` state schema that holds `s.secret` at any depth, read through the file's consts and relative imports into the project's files and reported at that argument with the field path, and a `reveal` from `@keel/schema` (any alias or `<namespace>.reveal`) referenced inside a `transaction(...)` function. No fix. The @keel/store README names E1303 among its checker rules.
