---
"@keel/ctx": patch
---

A `localStorage` commit whose write throws midway, such as on a full quota, puts back each key it wrote, newest first, and rejects with that error: it stores all its writes or none.
