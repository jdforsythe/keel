---
"@keel/std-live": patch
---

A `live` read that has not settled 30 s after it started on `ctx.clock` is given up: `status()` turns `connecting`, the read runs again on the usual backoff or at the next event, and the late result commits nothing.
