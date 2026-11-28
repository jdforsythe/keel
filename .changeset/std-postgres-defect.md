---
"@keel/std-postgres": patch
---

std.postgres raises its errors as defects (`defect` from `@keel/schema`, E2453 to E2455, E2457, E2460 as the code; a database error that is not expected is a defect naming its SQLSTATE) and reads the driver's errors with `attempt(fn, expect)` and `try`/`finally`; the package holds no `unsafe` call.
