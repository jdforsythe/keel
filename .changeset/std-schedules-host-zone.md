---
"@keel/std-schedules": patch
---

`schedule` throws E2551 for a `zone` the server's `Intl.DateTimeFormat` lacks, so an entry never fails at its first tick.
