# ADR-0240: k.drive: `simulate` drives the run's clock when no work of the run is pending (RFC 0218)

**Status:** accepted (orchestrator, 2026-11-24, amended four times the same day, for the operator to confirm).

**Context.** Under `simulate` a scenario that awaited server work waiting on the clock hung. A drive that moved the clock after quiet macrotask turns fixed the hang, but let machine speed reorder events: a real `setTimeout(12)` ran after a 10 ms sim waiter, and the run passed. Unheld work (`app.fetch` behind a harness, a password hash, PGlite's boot and session wait) needed app-side helpers. Tests are deterministic without the author thinking about it, so the law must hold by construction.

**Decision.**
- A new section, k.drive. `simulate` runs each scenario in the run's async context: `AsyncLocalStorage` and an `async_hooks` hook in `@keel/testing`, Node only. `@keel/ctx` gains no Node import, and a sim ctx outside `simulate` is never driven.
- Pending work is decided by tracking:
  - every non-promise async resource made in the run's context, until Node destroys it;
  - held work, until it settles;
  - a harness call, except while it waits only on an unanswered `ctx.net` route.
- Work waiting only on the sim clock or online state is promises alone, so it is parked by construction.
- The clock moves to the next moment, within the horizon or `t + ms`, on a drive turn where nothing is pending.
- `hold(label, start)` is for work that answers through something made outside the run. std-postgres holds `boot` and each call; the harness holds module loads. A clock or online wait inside a hold is E1728 at once.
- There is a closed list of seams; app code reaches nothing else (E1601, E1603, E1759). The residual is an unheld reply through a channel made before the run, or state kept across runs.
- The law check, in k.drive-law: on by default when `KEEL_TEST` is `1` (`keel test`), else off; `law: false` and `law: true` override. Each passing run is replayed after the last run and its traces compared, within the run's budget; a replay the budget stops ends the check without failing, and the result's `checked` counts the replays compared. A failing run is replayed twice whatever `law` is; shrink candidates run once. A difference is E1729 in place of E1704.
- E1727 has no grace in turns.
- E1728 also fails the run when its real-time budget is spent. The budget is `simulate`'s `budget`, else the enclosing test's timeout less a tenth, else 300,000 ms. The message names every piece of work in flight, oldest first. No piece of work has a bound of its own, so a starved short timer never fails a run the test would finish. The budget can fail a run and never changes a trace.
- A scenario that resolves with work still pending fails E1728 `work outlived the scenario: <label>`.
- The trace ends with the final values of the storage keys the run wrote (by key, as stored strings) and of the live stores (by id, log entries without `at`).
- The drive runs its callbacks in the run's context.
- Three things escape the tracker: a resource made before or outside the run, unless held; an `import()` in app code outside a harness's `routes` loader; state kept across runs. `keel check` reports none of them. The law check reports one only when `law` is on or on a failing run's replays, and only when it reaches the trace.

**Alternatives.**
- Quiet-turn idleness: speed decides the trace.
- Composite holds with clock-wait attribution: a parked rule per hold, and a concurrent branch is missed.
- Waiting on promise chains started by harness calls: their ends are not observable.
- A per-request ctx: breaks accessors keyed by ctx.
- `until(ctx, cond)`, or driving every sim ctx.

**Consequences.**
- The household's `held` and `onRun` helpers and its turn loops go.
- A library that leaves a handle open under sim fails E1728, naming its Node type.
- k.sim's clauses #15 to #24 become k.drive#1 to #10, with #5 and #9 rewritten, and k.drive gains #11 to #23. std.postgres gains #25.
- The map and docs map budgets are re-based by 10 tokens each, twice.
- k.drive's #10, #16, #17 and #20 become k.drive-law#1 to #4, k.drive's later bullets renumber, and k.drive-law gains #5 to #8.
- Every `simulate` under `keel test` costs up to twice its runs; a slow machine checks fewer.
