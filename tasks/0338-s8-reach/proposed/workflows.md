# workflows lane: record and spec sentences to apply (orchestrator, before the root gates)

Commits: cf55210 (std-statecharts `next`), 7462f5e (std-jobs on `read`/`commit`), 2bbebaf (std-workflows).
Exports: `chart.next<K, T extends string>(state: ChartState<T, D>, event: K, payload: Infer<Ev[K]>): ChartState<S | T, D>`; `workflow(id, spec): Workflow` (`{ id, stores, jobs }`), `stores(ctx)` returns `{ store, start, events, attempt, forget }`, `flows(queue: FlowQueue, workflows): Runner`, schema `WorkflowsInstances`, module `workflows`; tools rules E2351, E2352, W2353, E2354. `Chart` gained `data`; std-statecharts gained a `./tools/internal` export (needs a `tooling/deps.json`/budget look).
Suites: statecharts 35, jobs 49, workflows 25, schedules 36 (read-only), all green.

## Proposed sentences
- std.statecharts (+3): "The chart exposes `store`, `events`, `states`, `initial`, `data` (the `data` schema), `enabled(...)`..."
- std.workflows Inspect (+8): "`workflows.instances`: per workflow id, `{ [state]: count }` for the states holding an instance; no `data`."
- std.workflows Store (+15): "Transactions are named `<id>.start`, `<id>.<event>`, `<id>.attempt`, `<id>.forget`; a `done` payload its event refuses commits `failed` with that code."
- W2353 wording: "a step's `failed` event leads to a final state while another step's `done` event leads to a state from which that step is reachable."
- E2354 addition: "a module with no `jobs.server.ts` or `runners.server.ts` is reported on the workflow's file, without a fix."
- std.jobs: the "One runner owns..." sentence is gone; clause 11 replaces it.

## Conformance changed
- `std-statecharts/conformance/next.test.ts`: the fixture's `take` action gave `n: 4` against the data schema's `max: 3`, so `tx` threw; now `Math.min(3, d.n + p.by)`.
- `std-jobs/conformance/e2505.test.ts`: header line 3 (citing the removed "One runner owns..." sentence) deleted.

## Decisions (confirm or reverse)
- std-jobs lease `l` is a lease end time (`now + timeoutMs + 1000`); startup no longer frees every lease (that double-ran jobs across runners); a stopping runner frees its own.
- Workflow payload `id` is `s.string({ min: 1 })`; instances start with `entered: 0`; a wake delay counts from when the runner sees the instance; `flows` skips keys it enqueued in its last scan; a late result after `signal` aborts commits nothing.
- A chart event named `start`, `attempt` or `forget` throws as a duplicate transaction name; the spec names no code (backlog line).
- Tools limit: E2352 and W2353 read the chart file's syntax tree only when `keel check` hands it over, so they are silent when the chart file is not among the checked files (backlog line).

## Bytes
std-statecharts root 1,650 of 1,690, tools 3,061; std-jobs 2,297, tools 2,816; std-workflows 2,610 of 3,072, tools 3,064 of 3,072 (8 B left). Unsafe +2 in std-workflows (`asEvents`, `looseNext`), justified.
