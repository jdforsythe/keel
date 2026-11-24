# k.sim: Schedules and simulation
status: implemented

Under sim (k.ctx) every capability is deterministic by seed. A schedule fixes what the seed leaves alone: how long each request takes, which requests and storage calls fail, and when the network is offline. `simulate` runs one scenario under many generated schedules, as `properties` (k.testing) runs one property under many inputs.

**Clock.** The sim clock starts at 0 and moves only through `advance(ms)`, which resolves each waiter whose deadline it crosses in deadline order (ties: registration order), with `now()` at that deadline for code that runs synchronously as the waiter resolves. `next()` returns the earliest pending deadline, else `null`.

**Schedule** (`@keel/ctx`, a schema; JSON):
```ts
type Schedule = { net: NetStep[]; storage: ('ok' | 'fail')[]; offline: { at: number; ms: number }[]; plans: { [capability: string]: JsonValue[] } }
type NetStep = { delay: number; fault: 'none' | 'drop' | 'lost' | 'unavailable' }   // delay: integer 0 to 60000
```
`createCtx({ mode: 'sim', seed, schedule })` applies it:
- **net.** The n-th `fetch` of the ctx (from 0) takes `net[n]`, or `{ delay: 0, fault: 'none' }` past the end. It waits `delay` ms on the sim clock, then: `none` runs the route and resolves its response; `drop` rejects with a `TypeError` and runs nothing; `lost` runs the route, then rejects with a `TypeError`; `unavailable` resolves a 503 and runs nothing. Each step is taken when the fetch is made, so responses can arrive out of order.
- **storage.** The n-th `get` or `set` takes `storage[n]`; `fail` rejects with an `Error`, and a failed `set` stores nothing.
- **offline.** Each window sets the net offline (k.sync) when the clock reaches `at` and online again at `at + ms`.
- **plans.** `register(name, { real, shell, sim, plan? })`: `plan` is the schema of one step of that capability's plan. Its sim factory gets `{ seed, plan }`, `plan` being `plans[name]` parsed by it (default `[]`), and consumes it in call order as its own documentation says.

A ctx without `schedule` behaves as with an empty one. `schedule` on a real or shell ctx, or one that fails `Schedule`, throws E1604.

**Replicas.** `replica(ctx)` (`@keel/ctx`) of a sim ctx is a sim ctx standing for another process on the same storage, as two replicas of a `node` deployable are. It shares `ctx`'s clock, random, net, schedule and capability implementations (a capability accessor returns one object for both). Its `ctx.storage` is another storage object on the same data: commits through either serialize as one storage's (k.persist), they take steps of one schedule, and each sees the other's through `watch` (k.persist Watch). Its observers are its own: an event reported on one, a `save` of a `createApp` on it among them, reaches only that one's observers, but `net`, reported to both. `replica` of a real or shell ctx throws E1604. A test of two replicas serves one `createApp` on `ctx` and one on `replica(ctx)`, and renders each page with `app` (k.testing) against the one it reaches.

**simulate** (`@keel/testing`).
```ts
await simulate(async ({ ctx, run }) => {
  const t = await renderRoute('todos.list', { routes, params: { listId: 'l1' }, ctx })
  await t.fire('todos.addTodo', { type: 'click' })
  await run()
  expect(t.state(serverBoard).todos).toHaveLength(3)
}, { runs: 100, seed: 7 })
```
`simulate(scenario, { runs = 100, seed?, horizon = 600000, replay? })`. Each run draws a `SimRun` `{ seed, schedule }` from fast-check, the schedule generated from `Schedule` and each registered `plan` schema, creates that sim ctx, and awaits `scenario({ ctx, seed, schedule, run })`. `run()` settles as the harness does (k.testing `settle`), then (a `ctx.net` route that has not answered is work in flight: `run()` waits for it, and with nothing else moving the run's clock steps) while the earlier of `ctx.clock.next()` and the next edge (`at` or `at + ms`, later than the clock) of a window in the run's `schedule.offline` is at most `horizon` ms past the run's start, it advances the clock to it and settles again: no window edge within the horizon is left ahead of the clock. Each run starts from the snapshots the live stores (`stores()`) held before `simulate`, restored after it. A scenario that throws or rejects fails the run. The seed is `seed`, else `KEEL_SEED`, else 1337; success resolves `{ seed, runs }`.

**Failure.** A failing run is shrunk (fewer steps, shorter delays, fewer faults and windows) and reported as E1704 (k.testing) with the seed, the run, and the shrunk `SimRun` as JSON on the next line. `simulate(scenario, { replay: simRun })` runs that one `SimRun` once, and two runs of one `SimRun` take the same steps in the same order.

**Conformance.**
- `clock.next()` is the earliest pending `after` deadline, and `null` once `advance` has passed every one or each waiter aborted.
- With `net` `[{ delay: 50, fault: 'none' }, { delay: 10, fault: 'none' }]`, two fetches made at time 0 resolve the second at 10 and the first at 50, and a route that records calls sees the second first.
- `drop` and `unavailable` never run the route; `lost` runs it once and the fetch rejects with a `TypeError`; `unavailable` resolves status 503.
- A `ctx.net` route that awaits a promise the scenario resolves after `run()` starts, or a `ctx.clock.after` of the run: `run()` resolves once the route has answered, never before.
- A `fail` storage step rejects that call and a failed `set` leaves the key's earlier value.
- An `offline` window `{ at: 100, ms: 50 }` makes `ctx.net.online()` false from clock time 100 to 150, and an observer gets the two `net` events.
- A registered capability with a `plan` schema receives `plans[name]` in its sim factory; a plan step that fails its schema, or `schedule` on a real ctx, throws E1604.
- A ctx with an empty schedule gives the same results and observer events as one without.
- A scenario that fails only when a response is `lost` fails `simulate` with E1704 whose shrunk `SimRun` holds exactly one `lost` step and no other fault; `replay` of it fails the same way.
- Two `simulate` runs with one seed pass the same `SimRun`s to the scenario in the same order.
- A module store written by one run holds its pre-`simulate` state when the next run starts and after `simulate` resolves.
- `replay` of a `SimRun` whose `offline` is `[{ at: 100, ms: 50 }]`, its scenario advancing the clock to 120 with no `after` waiter pending: after `run()`, `ctx.net.online()` is true and `clock.now()` is 150; with `horizon: 130` it is still false.
- With `b = replica(a)` of a sim ctx `a`: a value `set` through `a.storage` is what `b.storage.get` returns; `b.clock.now()` equals `a.clock.now()` after `advance(100)` on `a`'s clock; a capability accessor returns the same object for `a` and `b`; `replica` of a real ctx throws E1604.
- With `createApp` A on sim ctx `a` and B on `b = replica(a)`, an action on A that saves store `s` reports one `save` event to an observer of `a` and none to an observer of `b`; overlapping actions on A and B that save `s` from one read leave one saved and the other 409 `keel.conflict`.
