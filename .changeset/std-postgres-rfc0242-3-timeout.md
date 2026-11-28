---
"@keel/std-postgres": minor
---

On a `pglite:` engine, which keeps no statement timer, a statement that leaves `statement_timeout` other than `0` sets it back to `0` and fails with SQLSTATE `0A000`, the defect E2461.
