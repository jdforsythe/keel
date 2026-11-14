# std.workflows: Workflows
status: proposed

**Extension points.** Module manifest (k.module): `@keel/std-workflows` is stdlib module `workflows`; a module with workflows lists it, `@keel/std-jobs` and `@keel/std-statecharts` in `deps`, `clock`, `random` and `storage` in `capabilities`, and is placed in a `node` deployable. Inspector hooks: section `workflows.instances`. Check rule registry: `@keel/std-workflows/tools` registers E2351-E2354.

**API** (`*.server.ts`).
```ts
export const removal = workflow('api.removal', {                       // modules/api/removal.server.ts
  chart: removalChart,                                                  // std.statecharts; `data` is an instance's data
  steps: { purging: { run: purgeList, done: 'purged', failed: 'stuck', attempts: 3 } },
  waits: { hidden: { ms: 600_000, event: 'expired' } },
})
export const purgeList = async (data, ctx, { signal, key }) => ok({})  // purgeList.server.ts; ok value: the `done` payload
export const jobs = queue({ ...removal.jobs })                         // modules/api/jobs.server.ts (std.jobs)
export const runners = [jobs, flows(jobs, [removal])]                  // modules/api/runners.server.ts
tx(s.removal.start, { id: ctx.random.id('Flow'), data: { list } })    // in an action whose `stores` include `removal.stores`
tx(s.removal.events.undo, { id, payload: {} })
```
`workflow(id, { chart, steps?, waits?, keepMs = 86_400_000, limit = 1000, attempts = 3, timeoutMs = 60_000 })`. A step names a state, its `run`, the chart events for its `done` and `failed` (payload `{ code }`) and optional `attempts` and `timeoutMs`; a wait names a state, `ms` and an event with payload `{}`.

**Store.** `removal.stores(ctx)` creates the store `id`, state `{ instances: { [Id<'Flow'>]: { state, data, entered, attempt } } }`, and its transactions: `start` `{ id, data }` (an existing id: unchanged; past `limit` instances not final: `store.invariant`), one per chart event `{ id, payload }` (the instance moves by `chart.next`; when its state name changes `entered` rises by one and `attempt` returns to 0; an unknown or final instance: unchanged), `attempt` `{ id, entered }` and `forget` `{ id }` (removes a final instance). Each changes one instance, so an invariant of the chart's `{ state, data }` that a closed-form `explore` of the chart proves holds for every instance. Every instance lives in this one store rather than an `instance` (std.statecharts) each, so one `stores` factory and one `commit` hold any number of them.

**Run.** `flows(queue, workflows)` is a `Runner` (k.topology). At start, after each `save` of a workflow store (k.sync) and every 60,000 ms of `ctx.clock`, it reads each store and enqueues, with std.jobs keys `<id>:<flow>:<entered>` so a repeat enqueues nothing: for an instance in a step state, `<id>.<state>`; in a wait state, `<id>.wake` after `ms`; in a final state, `<id>.forget` after `keepMs`. Job inputs are `{ id, entered }`, never `data`. A step job, through `commitStores` (k.persist): stops if the instance has moved; commits `attempt`; past `attempts`, commits `failed` `{ code: 'workflows.attempts' }`; else calls `run` with `signal` and `key`, then commits `done` with its `ok` value, or on the last attempt `failed` with the `err` code. A wake job commits its event if the instance is still there. A wait therefore lasts at least `ms`, later by the time the runner took to see the instance.

**Crashes and replay.** A step runs at least once (std.jobs); `key` is the same on every run of one entry, so the effect it calls can deduplicate. After a crash the instance is in the store as committed: its step's job runs again once its lease expires, or its result is committed and the next run stops. Every change is an entry of the store's log, step results as `done` and `failed` payloads, so replaying the log reproduces every instance without running a step. Compensation is chart states: a `failed` event leads to states whose steps undo earlier ones.

**Inspect.** `workflows.instances`: per workflow, a count per state; no `data`.

**Rules.** E2351 a `workflow` outside `*.server.ts`, or an id not prefixed by its module (fix prefixes it) · E2352 a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on` (no fix; `workflow` throws it) · W2353 a step's `failed` target is final while another step's `done` lies on a path to it, so its effect is never undone (names both) · E2354 a module whose `queue` lacks a workflow's `jobs` or whose `runners` lack its `flows` (fix adds them).

**Conformance.**
- For generated instances and events, a workflow event changes only its instance, to `chart.next` of it.
- Under sim, a started instance reaching a step state runs `run` once with `key` `<id>:<flow>:<entered>` and moves by its `done` event with the `ok` value.
- A `run` that returns `err` 3 times with `attempts: 3` leaves the instance after its `failed` event with that code; one that never settles ends there with `workflows.attempts`.
- A wait state moves by its event when the sim clock passes `ms`, not before; an undo sent first leaves the wake job doing nothing.
- After `close()` while `run` is pending, a new `createApp` on the same ctx runs it again with the same `key`, and the instance takes its `done` event once.
- Restoring the store's snapshot and replaying its log from `initial` gives its state.
- `workflows.instances` holds counts and no `data` value.
- E2351, E2352, W2353 and E2354 each fire on a fixture and not on its clean twin; `workflow` throws E2352.
