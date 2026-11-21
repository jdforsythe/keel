---
"@keel/std-schedules": patch
---

`@keel/std-schedules`: `schedule` throws E2554 for a job absent from the queue, of another module, or with an input its schema refuses; a fire stores its mark only after `enqueue` returns `ok`, and an `err` rejects `run`; a day field not starting with `*` is restricted.
