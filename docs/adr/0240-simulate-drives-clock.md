# ADR-0240: k.drive: `simulate` drives the run's clock when no work of the run is pending (RFC 0218)

**Status:** accepted (orchestrator, 2026-11-24, amended the same day, for the operator to confirm).

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
- The law check: `law: true` runs each run twice and compares traces, and a failing run is always replayed twice. A difference is E1729 in place of E1704.
- E1727 has no grace in turns. E1728 also fails work pending through 10,000 ms of real time; this can fail a run and never changes a trace.

**Alternatives.**
- Quiet-turn idleness: speed decides the trace.
- Composite holds with clock-wait attribution: a parked rule per hold, and a concurrent branch is missed.
- Waiting on promise chains started by harness calls: their ends are not observable.
- A per-request ctx: breaks accessors keyed by ctx.
- `until(ctx, cond)`, or driving every sim ctx.

**Consequences.**
- The household's `held` and `onRun` helpers and its turn loops go.
- A library that leaves a handle open under sim fails E1728, naming its Node type.
- k.sim's clauses #15 to #24 become k.drive#1 to #10, with #5 and #9 rewritten, and k.drive gains #11 to #17. std.postgres gains #25.
- The map and docs map budgets are re-based by 10 tokens each.
