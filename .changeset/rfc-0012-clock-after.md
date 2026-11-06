---
"@keel/ctx": minor
"@keel/services": patch
---

k.ctx: `ctx.clock.after(ms, signal?)` (sim `advance` resolves due waiters in deadline order; abort rejects). `@keel/services` timeouts use it instead of polling.
