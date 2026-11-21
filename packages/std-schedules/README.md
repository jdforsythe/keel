# @keel/std-schedules

**Spec:** std.schedules · **Status:** conformance-covered · **verified:** (none)

Five-field cron schedules in a time zone that enqueue a module's jobs, with catch-up after downtime.

## Contract

- **Public API:** stdlib module `schedules` (`module.ts` at the package root; deps `@keel/std-jobs`; capabilities `clock`, `storage`). Used from `*.server.ts`.
  - `schedule(queue, table)` in `modules/<id>/schedules.server.ts` is a `Runner` (k.topology) listed in `runners.server.ts` after the queue. Each entry, keyed by a module-prefixed id: `cron`, `zone` (a `temporal.TimeZone`, default `UTC`), `job` (a key of the queue's table, prefixed by the entry key's module id), `input` (that job's input type), `missed` (`'once'` default, or `'skip'`). It throws E2551, naming the field, for a `cron` or `zone` that does not parse or a `zone` the server's `Intl.DateTimeFormat` lacks, and E2554 for a `job` absent from the queue or of another module, or an `input` its job's schema refuses.
  - Type `ScheduleEntry`.
  - `./tools` (node): rules E2551 (a `cron` or `zone` string literal of a `schedule` entry that does not parse, naming the field; no fix), E2552 (a `schedule` outside `modules/<id>/schedules.server.ts`, or a key not prefixed by the module id; fix prefixes it), E2553 (a module with `schedules.server.ts` whose literal `runners` lacks `schedules`, fix adds it and its import, or with no `runners.server.ts`), E2554 (a `schedule` entry's `job` or `input` refused; `schedule` throws it, the registry holds the explanation).
- **Invariants:**
  - `cron` has five fields: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, Sunday 0). Each is `*`, `n`, `a-b` or a comma list of those, any with `/step`; `n/step` steps from `n` to the field's maximum. A day field not starting with `*` is restricted; when both are, a day matching either matches, else both must match. Names, macros, seconds and `L`, `W`, `#` are refused.
  - Local times are read in `zone` through `Intl.DateTimeFormat`. A local time a clock change skips fires at the first minute after the gap; a repeated one fires once, at its first occurrence. The next fire time is searched up to eleven years ahead; a `cron` that never matches never fires.
  - At each fire time `t` (epoch ms, a whole minute) the runner calls `queue.enqueue(ctx, job, input, { key: '<id>@<t>' })`, then, once `enqueue` returns `ok`, stores `t` as the entry's mark in `ctx.storage` `std.schedules.<module>`. An `err` from `enqueue` stores no mark and rejects `run`, which k.topology runs again. The key makes a fire time enqueue at most one job, also when a crash falls between the two steps; a failed mark write rejects `run`.
  - At start, an entry whose mark is older than its latest fire time enqueues that one (`'once'`) or none (`'skip'`); an entry without a mark starts from now: it stores the start time as its mark before it waits, so a fire whose `enqueue` errs has passed at the next start. When `signal` aborts `run` stops waiting and resolves.
  - Every effect goes through `ctx`: `clock.now`, `clock.after`, `storage`, and the queue's `enqueue`.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/ctx`, `@keel/schema`, `@keel/server` (the `Runner` type), `@keel/std-jobs`, `@keel/std-temporal` (`TimeZone`).
- **Rungs:** conformance (examples and properties, seed 1337) for daily fire keys, next fire time against a minute scan, the Europe/Berlin clock changes, missed fire times and E2551 to E2554; properties for the next and previous fire time against an independent minute scan in five zones (UTC, Europe/Berlin, America/New_York, Australia/Lord_Howe, Asia/Kolkata), their monotonicity, and the cron grammar.

## Extension points

Uses the **module manifest** (k.module: stdlib module `schedules`) and the **check rule registry** (k.check: E2551 to E2554 from `./tools`).

## Unsafe

count: 0
