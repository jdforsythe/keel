---
"@keel/std-jobs": patch
---

`@keel/std-jobs`: `job` throws E2505 for an `attempts` or `timeoutMs` that is not a positive integer; E2503 follows `job` through a namespace import and fires only for `.secret()` on `@keel/schema`'s `s`.
