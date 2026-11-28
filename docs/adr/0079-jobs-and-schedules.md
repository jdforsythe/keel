# ADR-0079: jobs run at least once on `ctx.storage`, and schedules enqueue with a key (RFC 0080)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1, 4 and 5.

**Context.** S3 adds background jobs and schedules. Every effect goes through `ctx`, the only durable state a deployable has is `ctx.storage`, and a module must carry its state with it when a split moves it. No runtime has a cron facility; `Intl.DateTimeFormat` reads local time in any IANA zone on Node 22 and 24.

**Decision.** `@keel/std-jobs`: `job({ input, attempts, timeoutMs }, fn)` and one `queue({...})` per module in `jobs.server.ts`, a `Runner` with a typed `enqueue(ctx, id, input, { delayMs?, key? })`. The queue, leases, the last 1,000 finished keys and the newest 100 failures live in `ctx.storage` `std.jobs.<module>`. A job runs at least once: a job leased when a process stops runs again at the next start, so `fn` is idempotent, and a `key` matching a pending or recently finished job enqueues nothing. Failures back off on `ctx.clock` up to an hour. Inputs holding `s.secret` are refused (E2503), failures keep the error code and never the input, and the `jobs.queue` inspector section shows counts and codes. A module enqueues only its own jobs (E2502). `@keel/std-schedules`: `schedule(jobs, {...})`, a `Runner` that enqueues at each fire time of a five-field cron in an explicit zone with key `<id>@<t>`, then stores a mark in `std.schedules.<module>`; after downtime `missed: 'once'` enqueues one job for the latest missed time. Skipped local times fire at the first minute after the gap; repeated ones fire once.

**Alternatives.**
- An external queue (Redis, SQL), rejected: an external service with no sim implementation and a second storage path; S8's std-db is where a shared store arrives.
- Exactly-once jobs, rejected: they need a transaction spanning a job's effects and the queue.
- A cron library, rejected: wider dialects E2551 would refuse anyway, computed from `Date` in the host zone; a parser and next-time search prototype is 695 B gzip.
- UTC-only schedules, rejected: the common case is local time in a named zone, and S2 brings `TimeZone`.

**Consequences.**
- One instance per deployable runs a queue, since `ctx.storage` is a local file.
- An action that enqueues and then gets 409 leaves its job enqueued; a retried request with the same `key` adds nothing.
- Diagnostic blocks E2500-E2549 (std.jobs) and E2550-E2599 (std.schedules).
