# std.schedules: Schedules
status: conformance-covered

**Extension points.** Module manifest (k.module): `@keel/std-schedules` is stdlib module `schedules`; a module that schedules lists it and `@keel/std-jobs` in `deps`, `clock` and `storage` in `capabilities`. Check rule registry (k.check): `@keel/std-schedules/tools` registers E2551-E2553.

**API** (`@keel/std-schedules`; used from `*.server.ts`).
```ts
export const schedules = schedule(jobs, {                           // modules/orders/schedules.server.ts
  'orders.nightly': { cron: '0 3 * * *', zone: 'UTC', job: 'orders.digest', input: {} },
})
export const runners = [jobs, schedules]                             // modules/orders/runners.server.ts
```
- `schedule(queue, table)` is a `Runner` (k.topology). Each entry: `cron`, `zone` (a `temporal.TimeZone`, std.temporal; default `UTC`), `job` (a key of `queue`'s table) and `input` (that job's input type; `schedule` throws E2554 for a `job` not in `queue` or not its module's, or an `input` the job's schema refuses), `missed` (`'once'` default, or `'skip'`).
- `cron` has five fields, minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, Sunday 0); each field is `*`, `n`, `a-b`, a comma list of those, or any of them with `/step`. Names, macros, seconds and `L`, `W`, `#` are not accepted. A day field not starting with `*` is restricted; when both are, a day matching either matches, else both must match (`0 0 */2 * 1`: odd-day Mondays).
- Times are read in `zone` through `Intl.DateTimeFormat`. A local time a clock change skips fires at the first minute after the gap; a repeated local time fires once, at its first occurrence.
- **Run.** At each fire time `t` (a minute on `ctx.clock`) the runner calls `queue.enqueue(ctx, job, input, { key: '<id>@<t>' })`, and on `ok` stores `t` as the entry's mark in `ctx.storage` key `std.schedules.<module>`. The key makes a fire time enqueue at most one job (std.jobs), also when a crash falls between the two steps. An `err` stores no mark and rejects `run`, which k.topology runs again.
- **Restart.** The mark survives a restart. At start, an entry without a mark starts from now: it stores the start time as its mark before it waits, so a fire whose `enqueue` errs has passed at the next start. If fire times passed since the mark, `'once'` enqueues one job for the latest of them and `'skip'` none. When `signal` aborts, the runner stops waiting.
- A schedule enqueues only its own module's jobs, so it runs in that module's deployable.

**Rules.** E2551 a `cron` or `zone` literal that does not parse, naming the field (no fix; `schedule` also throws it) · E2552 a `schedule` key not prefixed by its module id, or a `schedule` outside `modules/<id>/schedules.server.ts` (fix prefixes the key) · E2553 a module with `schedules.server.ts` whose `runners` lacks `schedules` (fix adds it) · E2554 a `schedule` entry's `job` or `input` refused (thrown by `schedule`).

**Conformance.**
- With `0 3 * * *` in `UTC` and the sim clock at 2026-11-10T02:59Z, one job is enqueued at 03:00Z and the next 24 h later, each with key `<id>@<t>`.
- For generated `cron` values and instants `t`, the next fire time after `t` matches the expression, and no minute strictly between them does (checked by a minute-by-minute scan).
- `30 2 * * *` in `Europe/Berlin` fires at 03:00 local on 2027-03-28 and once at the first 02:30 on 2026-10-25.
- Closed across three fire times then started: `'once'` enqueues one job, for the latest; `'skip'` none; a crash after the enqueue and before the mark gives one job run.
- `60 * * * *`, `* * * *`, `@daily` and `0 0 * * MON` are each one E2551, and `schedule` throws E2551 for each.
- E2552 and E2553 each fire on a fixture and not on its clean twin.
- `0 0 */2 * 1` fires on Mondays that are odd days of the month and on no other day.
- `schedule` throws E2554 for a `job` absent from `queue`, one of another module, and an `input` its job's schema refuses.
- With no mark, a first fire whose `enqueue` errs rejects `run`; started again after that fire time, `'once'` enqueues exactly one job for it, with key `<id>@<t>`.
