# @keel/std-jobs

**Spec:** std.jobs · **Status:** proposed · **verified:** (none)

Durable background jobs per module: enqueue, retry with backoff, lease and restart.

## Contract

- **Public API:** stdlib module `jobs` (`module.ts` at the package root; capabilities `clock`, `random`, `storage`). Every export is used from `*.server.ts` in a `node` deployable.
  - `job({ input, attempts = 3, timeoutMs = 60000 }, fn)`: `fn(input, ctx, signal)` returns `Promise<Result<null, KeelError>>` and must be idempotent, since a job runs at least once.
  - `queue(table)` in `modules/<id>/jobs.server.ts`, keyed by module-prefixed job ids, is a `Runner` (k.topology `run(ctx, signal)`) listed in `runners.server.ts`. It throws E2503 when a job's `input` schema holds `s.secret`.
  - `jobs.enqueue(ctx, id, input, { delayMs?, key? })` is typed by the table and resolves `Result<Id<'Job'>, KeelError>`: `keel.fields` (`{ [path]: rule }`) when `input` does not parse, else `ok(id)`. A `key` equal to a pending job's, or to one of the last 1,000 finished, returns that job's id and stores nothing.
  - Types `Job`, `JobTable`, `InputOf`, `EnqueueOptions`, `Queue`; schemas `JobsConfig` (`{ concurrency? }`, 1 to 16, registered under the package name) and `JobsQueue` (the inspect section).
  - `./tools` (node): rules E2501 (a `queue` outside `modules/<id>/jobs.server.ts`, or a key not prefixed by the module id; fix prefixes it), E2502 (`jobs` in `public.exports` of a module with `jobs.server.ts`; fix removes it), E2503 (a `job` input schema, inline or a `const` of the same file, holding `s.secret`; no fix), E2504 (a module with `jobs.server.ts` whose literal `runners` lacks `jobs`, fix adds it and its import; no `runners.server.ts`; or a deployable with an adapter other than `node` serving it). `./tools/internal` holds the rule helpers `@keel/std-schedules/tools` shares; it is not app-facing.
- **Invariants:**
  - State lives in `ctx.storage` `std.jobs.<module>` as JSON: the jobs (`id`, `job`, the input encoded by its schema, `at`, runs counted `n`, lease `l`, optional `key`), the last 1,000 finished `{ k, id }` and the newest 100 failures `{ id, job, code, at }`. A stored value that is not a queue throws instead of dropping jobs. Writes to one key are serialized in the process.
  - The runner releases the leases a stopped process left (their run already counted), then starts due jobs in `at`, then `id` order, at most the module's `concurrency` (k.module `std` config, default 1) at once. Before `fn` it stores the lease and counts the run. `ok` removes the job. `err`, a throw (`jobs.thrown`) or no result within `timeoutMs` (`jobs.timeout`, then the job's `signal` aborts) waits `min(1000 * 2^(n-1), 3600000)` ms on `ctx.clock`; after `attempts` runs the job moves to the failures with its code and no input. Between jobs it waits on `ctx.clock.after` for the next `at`, an enqueue or a finished run.
  - When the runner's `signal` aborts no job starts; running ones see their `signal` abort and stay leased, so the next start runs them again. `run` resolves without waiting for them.
  - Inspect section `jobs.queue`: per module `{ pending, running, failed }`, counts and codes only, read from the last write in this process.
  - Every effect goes through `ctx`: `clock.now`, `clock.after`, `random.id('Job')`, `storage`.
- **Dependencies:** `@keel/check` and `oxc-parser` (tools only), `@keel/compiler` (`inspector`, `stdConfig`, `parseTopology`), `@keel/ctx`, `@keel/schema`, `@keel/server`.
- **Rungs:** conformance (examples and properties, seed 1337) for delay, backoff, keys, restart, concurrency, timeout, the inspect section and E2501 to E2504; properties for the backoff sequence, concurrency from 1 to 16, and enqueue, failure and restart scripts that never lose a job or run a finished key twice.

## Extension points

Uses the **module manifest** (k.module: stdlib module `jobs` and `std` config `{ concurrency }`), an **inspector hook** (k.cli: section `jobs.queue`) and the **check rule registry** (k.check: E2501 to E2504 from `./tools`).

## Unsafe

count: 0
