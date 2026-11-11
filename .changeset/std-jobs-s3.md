---
"@keel/std-jobs": minor
---

`@keel/std-jobs`: `job`, `queue` (a `Runner` with typed `enqueue`), durable state in `ctx.storage` `std.jobs.<module>` with leases, backoff `min(1000 * 2^(n-1), 3600000)` ms, timeouts that abort the job's `signal`, idempotency `key`s, `concurrency` from the module's `std` config, the `jobs.queue` inspect section, and rules E2501 to E2504 in `./tools`.
