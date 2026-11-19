---
"@keel/std-jobs": minor
---

Every queue change is one `ctx.storage.commit` against the value read, rerun when refused; a lease ends `timeoutMs` plus 1,000 ms after it starts, and a stopped runner frees its leases. Two runners over one storage run a job once.
