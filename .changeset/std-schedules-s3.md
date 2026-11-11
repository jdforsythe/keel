---
"@keel/std-schedules": minor
---

`@keel/std-schedules`: `schedule(queue, table)`, a `Runner` that enqueues a job at each fire time of a five-field cron read in a `TimeZone` (skipped local times fire after the gap, repeated ones once), with key `<id>@<t>` and a mark in `ctx.storage` `std.schedules.<module>` for catch-up (`missed: 'once' | 'skip'`), and rules E2551 to E2553 in `./tools`.
