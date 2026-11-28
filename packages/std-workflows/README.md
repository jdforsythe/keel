# @keel/std-workflows

**Spec:** std.workflows · **Status:** conformance-covered · **verified:** (none)

Durable multi-step workflows: a state chart run per instance in one server store, its steps and waits run as `@keel/std-jobs` jobs.

## Contract

- **Public API:** stdlib module `workflows` (`module.ts` at the package root; capabilities `clock`, `random`, `storage`). Every export is used from `*.server.ts` in a `node` deployable.
  - `workflow(id, { chart, steps?, waits?, keepMs = 86_400_000, limit = 1000, attempts = 3, timeoutMs = 60_000 })` returns `{ id, stores, jobs }`. A step `{ run, done, failed, attempts?, timeoutMs? }` and a wait `{ ms, event }` are keyed by their state; `run(data, ctx, { signal, key })` resolves a `Result` whose `ok` value is the `done` payload, typed by that event's schema (`StepSpec<D, Ev>` is one member per event `done` may name). `workflow` throws E2352 for a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on`, and E2355 for a chart event named `start`, `attempt` or `forget`, the names of the workflow's own transactions.
  - `stores(ctx)` is a `stores` factory (k.persist) returning `{ store, start, events, attempt, forget }`: the store `id` with state `{ instances: { [id]: { state, data, entered, attempt } } }` and the transactions `<id>.start` `{ id, data }` (an existing id: unchanged), `<id>.<event>` `{ id, payload }` per chart event (the instance moves by `chart.next`; a target the chart takes that names a `to`, its own state included, raises `entered` by one and zeroes `attempt`; an unknown or final instance: unchanged), `<id>.attempt` `{ id, entered }` and `<id>.forget` `{ id }` (removes a final instance). More than `limit` instances not final fail `store.invariant`.
  - `jobs` is the std.jobs table `{ <id>.<state> per step, <id>.wake, <id>.forget }` that the module's `queue` spreads in; job inputs are `{ id, entered }`, never `data`. A step job has the step's `attempts` plus one std.jobs attempts.
  - `flows(queue, workflows)` is a `Runner` (k.topology): at start, after each `save` of one of its workflow stores and every 60,000 ms of `ctx.clock`, it reads each store and enqueues, keyed `<id>:<flow>:<entered>`, the step job of an instance in a step state, `<id>.wake` after `ms` for one in a wait state and `<id>.forget` after `keepMs` for a final one.
  - Types `Workflow`, `WorkflowSpec`, `WorkflowStores`, `StepSpec`, `StepEnv`, `WaitSpec`, `Instance`, `Instances`, `FlowQueue`; schema `WorkflowsInstances` (the inspect section).
  - `./tools` (node): rules E2351 (a `workflow` outside `*.server.ts`, or an id not prefixed by its module; fix prefixes it), E2352, W2353 (a step's `failed` target is final while another step's `done` leads to it; names both) and E2354 (a module whose `queue` lacks a workflow's `jobs` or whose `runners` lack its `flows`; fix adds them) and E2355 (a chart event named `start`, `attempt` or `forget`), each registered at import.
- **Invariants:**
  - Every store change goes through `commitStores` (k.persist): a step job stops when the instance moved from its entry, commits `attempt` (past `attempts`: `failed` with `{ code: 'workflows.attempts' }`), calls `run` and commits `done` with its `ok` value; an `err` counts a std.jobs attempt, and on the last attempt commits `failed` with its code, as does a `done` payload the event refuses. A result arriving after the job's `signal` aborted commits nothing.
  - A wake job commits the wait's event only while the instance is still in that wait's entry; a forget job removes the instance only while it is final.
  - Each transaction changes one instance by the chart's `next`, so a chart invariant `explore` proves holds for every instance; step results are `done` and `failed` payloads, so replaying the log reproduces every instance without running a step.
  - A step runs at least once; `key` is the same on every run of one entry. A wait lasts at least `ms`.
  - Inspect section `workflows.instances`: per workflow id, a count per state holding an instance, read from the runner's last scan in this process; never `data`.
- **Dependencies:** `@keel/check` (tools only), `@keel/compiler` (`inspector`, `module`), `@keel/ctx` (`observe`), `@keel/schema`, `@keel/server` (`commitStores`), `@keel/std-jobs`, `@keel/std-statecharts`, `@keel/store`.
- **Rungs:** conformance (examples and properties, seed 1337) for per-instance transitions, steps, retries, waits, restart, replay, the inspect section and E2351 to E2355; properties that crashes at generated points of a step record its effect once, and for `limit` and forgetting.

## Extension points

Uses the **module manifest** (k.module: stdlib module `workflows`), an **inspector hook** (k.inspect: section `workflows.instances`) and the **check rule registry** (k.check: E2351 to E2355 from `./tools`).

## Unsafe

count: 2
- `unsafe/looseChart.ts`: the chart's `next` and `taken` are called with an event name from its `events` and that event's parsed payload.
- `unsafe/asEvents.ts`: the per-event transaction table is typed by each event's payload schema.
