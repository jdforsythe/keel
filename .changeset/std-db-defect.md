---
"@keel/std-db": patch
---

std.db raises its rejections as defects (`defect` from `@keel/schema`, E1606, E2152, E2153 as the code) and reads the driver's errors with `attempt(fn, expect)` and `try`/`finally`; the package holds no `unsafe` call.
