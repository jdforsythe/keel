---
"@keel/router": patch
---

`createRouter` makes its roots detached, and `Form` registers its cleanup only when a scope runs.
