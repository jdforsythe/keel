# @keel/std-jobs

**Spec:** std.jobs · **Status:** conformance-covered · **verified:** (none)

Durable background jobs per module: enqueue, retry with backoff, lease and restart.

## Contract

- **Public API:** stdlib module `jobs` (`module.ts` at the package root; capabilities `clock`, `random`, `storage`). Every export is used from `*.server.ts` in a `node` deployable.
  - `job({ input, attempts = 3, timeoutMs = 60000 }, fn)` (positive integers, else `job` throws E2505): `fn(input, ctx, signal)` returns `Promise<Result<null, KeelError>>` and must be idempotent, since a job runs at least once.
  - `queue(table)` in `modules/<id>/jobs.server.ts`, keyed by module-prefixed job ids, is a `Runner` (k.topology `run(ctx, signal)`) listed in `runners.server.ts`. It throws E2503 when a job's `input` schema holds `s.secret`.
  - `jobs.enqueue(ctx, id, input, { delayMs?, key? })` is typed by the table and resolves `Result<Id<'Job'>, KeelError>`: `keel.fields` (`{ [path]: rule }`) when `input` does not parse, else `ok(id)`. A `key` equal to a pending job's, or to one of the last 1,000 finished, returns that job's id and stores nothing.
  - Types `Job`, `JobTable`, `InputOf`, `EnqueueOptions`, `Queue`; schemas `JobsConfig` (`{ concurrency? }`, 1 to 16, registered under the package name) and `JobsQueue` (the inspect section).
  - `./tools` (node): rules E2501 (a `queue` outside `modules/<id>/jobs.server.ts`, or a key not prefixed by the module id; fix prefixes it), E2502 (`jobs` in `public.exports` of a module with `jobs.server.ts`; fix removes it), E2503 (a `job`, named or reached through a namespace import, whose `input` schema, inline or a `const` of the same file, holds a `.secret()` call on `@keel/schema`'s `s`; no fix), E2504 (a module with `jobs.server.ts` whose literal `runners` lacks `jobs`, fix adds it and its import; no `runners.server.ts`; or a deployable with an adapter other than `node` serving it), E2505 (`attempts` or `timeoutMs` not a positive integer; `job` throws it, the registry holds the explanation), E2506 (an argument of `<q>.enqueue(…)` that carries a value `reveal` returns, by `carriesReveal` of `@keel/check`, `<q>` a name imported from a relative `jobs.server` file, `<ns>.<name>` of a namespace import of one, or a `const` of the file bound to `queue(…)`; one finding per call, no fix; it does not see `enqueue` taken into a local, its `.call` or `.apply`, a helper that enqueues, or a value revealed in another file). `./tools/internal` holds the rule helpers `@keel/std-schedules/tools` shares; it is not app-facing.
- **Invariants:**
  - State lives in `ctx.storage` `std.jobs.<module>` as JSON: the jobs (`id`, `job`, the input encoded by its schema, `at`, runs counted `n`, lease end `l` in `ctx.clock` ms, 0 for none, optional `key`), the last 1,000 finished `{ k, id }` and the newest 100 failures `{ id, job, code, at }`. A stored value that is not a queue throws instead of dropping jobs. Every change is one `ctx.storage.commit` against the value read, read again and rerun when refused, so processes sharing a storage driver never lease one job twice; writes to one key are also serialized in the process.
  - The runner starts due jobs whose lease is free or past its end (a job leased by a stopped process runs again, its run already counted) in `at`, then `id` order, at most the module's `concurrency` (k.module `std` config, default 1) at once. Before `fn` it stores a lease ending `timeoutMs` plus 1,000 ms later and counts the run. `ok` removes the job. `err`, a throw of any value (`jobs.thrown`: `fn` runs under `supervise(ctx, 'jobs.run', …)`, k.supervise, so a defect or a thrown string is reported once and retried like any failure) or no result within `timeoutMs` (`jobs.timeout`, then the job's `signal` aborts) waits `min(1000 * 2^(n-1), 3600000)` ms on `ctx.clock`; after `attempts` runs the job moves to the failures with its code and no input. Between jobs it waits on `ctx.clock.after` for the next `at` or lease end, an enqueue or a finished run.
  - When the runner's `signal` aborts no job starts; running ones see their `signal` abort and their leases are freed, so the next start runs them again. `run` resolves once the leases are freed, without waiting for `fn`.
  - Inspect section `jobs.queue`: per module `{ pending, running, failed }`, counts and codes only, read from the last write in this process.
  - Every effect goes through `ctx`: `clock.now`, `clock.after`, `random.id('Job')`, `storage`.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/compiler` (`inspector`, `stdConfig`, `parseTopology`), `@keel/ctx`, `@keel/schema`, `@keel/server`.
- **Rungs:** conformance (examples and properties, seed 1337) for delay, backoff, keys, restart, concurrency, timeout, the inspect section and E2501 to E2506; properties for the backoff sequence, two processes over one storage running each job once, concurrency from 1 to 16, enqueue, failure and restart scripts that never lose a job or run a finished key twice, and E2506 over generated `enqueue` calls.

## Extension points

Uses the **module manifest** (k.module: stdlib module `jobs` and `std` config `{ concurrency }`), an **inspector hook** (k.cli: section `jobs.queue`) and the **check rule registry** (k.check: E2501 to E2506 from `./tools`).

## Unsafe

count: 0
