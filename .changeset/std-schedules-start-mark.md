---
"@keel/std-schedules": patch
---

An entry without a mark stores its start time as its mark before it waits, so a first fire whose `enqueue` errs is enqueued once at the next start.
