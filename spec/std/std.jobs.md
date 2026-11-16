# std.jobs: Background jobs
status: conformance-covered

**Extension points.** Module manifest (k.module): `@keel/std-jobs` is stdlib module `jobs`; a module that defines jobs lists it in `deps` and `clock`, `random` and `storage` in `capabilities`, and is placed in a `node` deployable. Inspector hooks (k.cli): section `jobs.queue`. Check rule registry (k.check): `@keel/std-jobs/tools` registers E2501-E2504.

**API** (`@keel/std-jobs`; every export is used from `*.server.ts`).
```ts
export const sendReceipt = job({ input: Receipt, attempts: 5 }, async (input, ctx, signal) => ok(null))  // sendReceipt.server.ts
export const jobs = queue({ 'orders.sendReceipt': sendReceipt })   // modules/orders/jobs.server.ts
export const runners = [jobs]                                       // modules/orders/runners.server.ts (k.topology)
const r = await jobs.enqueue(ctx, 'orders.sendReceipt', { orderId }, { key: orderId })  // Result<Id<'Job'>, KeelError>
```
- `job({ input, attempts = 3, timeoutMs = 60000 }, fn)` (positive integers, else `job` throws E2505): `fn(input, ctx, signal)` returns `Promise<Result<null, KeelError>>`. `input` holds no `s.secret` (E2503): a job's input is stored.
- `queue(table)` is a `Runner` with `enqueue(ctx, id, input, { delayMs?, key? })`. `enqueue` parses `input` with the job's schema (fail: `err` `keel.fields`), stores `{ id: random.id('Job'), job, input, at: now + delayMs, attempt: 0 }` under `ctx.storage` key `std.jobs.<module>`, and returns `ok(id)`. A `key` equal to a pending job's, or to one of the last 1,000 finished in that queue (a job that failed after its last attempt is finished), returns that job's id and stores nothing.
- **Run.** The runner starts due jobs in `at`, then `id` order, at most `concurrency` at once (module `std` config `{ concurrency }`, 1 to 16, default 1). Before `fn` it stores a lease as its end time, `now + timeoutMs + 1000`. Every change to the queue is one `commit` (k.persist) against the value it read, retried on `false`, so processes sharing a storage driver never lease one job twice. `ok` removes the job. `err`, a throw, or no result within `timeoutMs` (then `signal` aborts) counts an attempt: the job waits `min(1000 · 2^(attempt-1), 3600000)` ms on `ctx.clock`, and after `attempts` moves to the newest 100 `failed`, with its error code and no input. Between jobs it waits on `ctx.clock.after` for the next `at` or an `enqueue`.
- **Restart.** Everything above lives in `ctx.storage`, so it survives a restart. A lease past its end is free, so a job leased by a stopped process runs again, counted as an attempt: a job runs at least once, so `fn` must be idempotent. Each runner reads its own clock, so clocks that disagree by more than the second of margin can also run a leased job again. When the runner's `signal` aborts no job starts, and running ones get their `signal` aborted and the runner frees their leases; a starting runner frees none.
- **Inspect.** `jobs.queue` is, per module, `{ pending, running, failed: { id, job, code, at }[] }`: counts and codes, never an input.
- A job runs only in its module's deployable. Another module starts one by calling an action of the owning module (k.services), never by importing its queue.

**Rules.** E2501 a `queue` key not prefixed by its module id, or a `queue` outside `modules/<id>/jobs.server.ts` (fix prefixes the key) · E2502 `jobs` in `public.exports` (fix removes it) · E2503 a job `input` schema holding `s.secret` (no fix; `queue` also throws it) · E2504 a module with `jobs.server.ts` whose `runners` lacks `jobs` (fix adds it), or placed in a non-`node` deployable · E2505 `attempts` or `timeoutMs` not a positive integer (`job` throws it).

**Conformance.**
- Under sim, a job enqueued with `delayMs: 500` runs when the clock reaches 500, not before, with the parsed input; `ok` removes it.
- A job returning `err` twice then `ok` with `attempts: 3` runs at 0, 1,000 and 3,000 ms; with `attempts: 2` it ends in `failed` with its code and no input.
- Two `enqueue`s with one `key` return one id and run once, also when the second comes after the first finished.
- After `close()` while `fn` is pending, a new `createApp` on the same ctx runs that job again; a job finished before `close()` never runs again; a pending one runs after the new start.
- With `concurrency: 2` and five due jobs, at most two `fn` calls are pending at any time.
- An `fn` not settled after `timeoutMs` sees its `signal` aborted, and the run counts as an attempt.
- The `jobs.queue` section holds counts and failures and no input value.
- E2501-E2504 each fire on a fixture and not on its clean twin; a `queue` whose input holds `s.secret` throws E2503.
- E2503 fires for `job` reached through `import * as jobs` and not for a `.secret()` call on an object other than `@keel/schema`'s `s`.
- `job` with `attempts: 0` or `timeoutMs: 1.5` throws E2505.
- Two `createApp`s on one sim ctx, each running the queue with five due jobs: each job's `fn` runs once.
