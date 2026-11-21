# ADR-0106: a workflow is a chart run per instance in one server store, with steps and waits as std.jobs jobs (RFC 0085)

**Status:** accepted (2026-11-11), user decisions D1 and D2, under the WORKFLOW RFC defaults 2, 3 and 4.

**Context.** Checkouts, removals with an undo window and approvals need many instances, steps with retries, timed waits and compensation, recorded so they replay. std.jobs runs one function at least once; std.statecharts compiles a chart to stores and transactions; `explore` proves a chart's closed form. A second runtime would sit beside stores, the log and sessions.

**Decision.** `workflow(id, { chart, steps, waits, keepMs, limit, attempts, timeoutMs })` declares one server store whose state maps instance ids to `{ state, data, entered, attempt }`, with transactions `start`, one per chart event (moving an instance by the chart's `next`), `attempt` and `forget`. `flows(queue, workflows)` is a runner that enqueues keyed std.jobs jobs for step states, waits and finished instances. A step job checks the instance has not moved, commits `attempt`, calls `run(data, ctx, { signal, key })` and commits `done` or, on its last attempt, `failed`, all through `commitStores`. Job inputs hold `{ id, entered }`, never `data`. Compensation is chart states; W2353 names a failure that ends an instance after another step succeeded.

**Alternatives.**
- A workflow engine with code replay, rejected: it needs every branch and effect to be deterministic code Keel cannot check, and a second runtime.
- One chart store per instance (RFC 0084's `instance`), rejected: instance stores live in a scope, and a runner would open one store id per instance.
- Retries inside the workflow runner, rejected: a second lease, backoff and timeout beside std.jobs.

**Consequences.**
- Step results are log entries, so replaying the store reproduces every instance without running a step.
- Each transaction changes one instance, so the chart's closed-form `explore` covers every instance.
- Steps run at least once; `key` lets an effect deduplicate.
- Waits never run early and can run late by the runner's delay in seeing an instance.
- One snapshot holds every instance; `limit` bounds active instances.
