# std.workflows: Workflows
status: conformance-covered

**Extension points.** Module manifest (k.module): `@keel/std-workflows` is stdlib module `workflows`; a module with workflows lists it, `@keel/std-jobs` and `@keel/std-statecharts` in `deps`, `clock`, `random` and `storage` in `capabilities`, and is placed in a `node` deployable. Inspector hooks: section `workflows.instances`. Check rule registry: `@keel/std-workflows/tools`, E2351-E2355.

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
`workflow(id, { chart, steps?, waits?, keepMs = 86_400_000, limit = 1000, attempts = 3, timeoutMs = 60_000 })`. A step names a state, its `run`, the chart events for its `done` and `failed` (payload `{ code }`) and optional `attempts` and `timeoutMs`; a wait names a state, `ms` and an event with payload `{}`. The package's entry is server-only, `src/index.server.ts` (k.boundary): a value import of `@keel/std-workflows` from client code is E1004; its types import anywhere.

**Store.** `removal.stores(ctx)` creates the store `id`, state `{ instances: { [Id<'Flow'>]: { state, data, entered, attempt } } }`, and its transactions: `start` `{ id, data }` (an existing id: unchanged; past `limit` instances not final: `store.invariant`), one per chart event `{ id, payload }` (the instance moves by `chart.next`; a taken target with a `to`, its own state too, raises `entered` by one and `attempt` resets to 0; an unknown or final instance: unchanged), `attempt` `{ id, entered }` and `forget` `{ id }` (removes a final instance). Transactions are named `<id>.start`, `<id>.<event>`, `<id>.attempt` and `<id>.forget`. Each changes one instance, so an invariant of the chart's `{ state, data }` that a closed-form `explore` of the chart proves holds for every instance. Every instance lives in this one store, so one `stores` factory and one `commit` hold any number.

**Run.** `flows(queue, workflows)` is a `Runner` (k.topology). At start, after each `save` of a workflow store (k.sync) and every 60,000 ms of `ctx.clock`, it reads each store and enqueues, with std.jobs keys `<id>:<flow>:<entered>` so a repeat enqueues nothing: for an instance in a step state, `<id>.<state>`; in a wait state, `<id>.wake` after `ms`; in a final state, `<id>.forget` after `keepMs`. Job inputs are `{ id, entered }`, never `data`. A step job, through `commitStores` (k.persist): stops if the instance has moved; commits `attempt`; past `attempts`, commits `failed` `{ code: 'workflows.attempts' }`; else calls `run` with `signal` and `key`, then commits `done` with its `ok` value, or on the last attempt `failed` with the `err` code; a `done` payload its event refuses commits `failed` with that code. A wake job commits its event if the instance is still there. A wait lasts at least `ms`, counted from when the runner sees the instance.

**Crashes and replay.** A step runs at least once (std.jobs); `key` is the same on every run of one entry, so the effect it calls can deduplicate. After a crash the instance is as committed: its step's job runs again once its lease expires, or its result is committed and the next run stops. Every change is an entry of the store's log, step results as `done` and `failed` payloads, so replaying the log reproduces every instance without running a step. Compensation is chart states: a `failed` event leads to states whose steps undo earlier ones.

**Inspect.** `workflows.instances`: per workflow id, `{ [state]: count }` for the states holding an instance; no `data`.

**Rules.** E2351 a `workflow` outside `*.server.ts`, or an id not prefixed by its module (fix prefixes it) · E2352 a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on` (no fix; `workflow` throws it) · E2355 a chart event named `start`, `attempt` or `forget`, a name its transactions take (no fix; `workflow` throws) · W2353 a step's `failed` event leads to a final state while another step's `done` event leads to a state from which that step is reachable, so its effect is never undone (names both) · E2354 a module whose `queue` lacks a workflow's `jobs` or whose `runners` lack its `flows` (fix adds them); a module with no `jobs.server.ts` or `runners.server.ts` is reported on the workflow's file, without a fix.

**Conformance.**
- For generated instances and events, a workflow event changes only its instance, to `chart.next` of it.
- Under sim, a started instance reaching a step state runs `run` once with `key` `<id>:<flow>:<entered>` and moves by its `done` event with the `ok` value.
- A `run` that returns `err` 3 times with `attempts: 3` leaves the instance after its `failed` event with that code; one that never settles ends there with `workflows.attempts`.
- A wait state moves by its event when the sim clock passes `ms`, not before; an undo sent first leaves the wake job doing nothing.
- After `close()` while `run` is pending, a new `createApp` on the same ctx runs it again with the same `key`, and the instance takes its `done` event once.
- Restoring the store's snapshot and replaying its log from `initial` gives its state.
- `workflows.instances` holds counts and no `data` value.
- E2351, E2352, W2353, E2354 and E2355 each fire on a fixture and not on its clean twin; `workflow` throws E2352 and E2355.
