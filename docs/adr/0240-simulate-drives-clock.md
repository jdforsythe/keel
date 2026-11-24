# ADR-0240: k.sim: `simulate` drives the run's clock while nothing else can move (RFC 0218)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** Under `simulate` the clock moved only inside `run()` or a harness call stalled on `ctx.net`. A scenario that awaited server work waiting on the clock (a std-postgres plan delay, a job's backoff, a runner's poll) hung, and `vitest` reported only its timeout. std-postgres's PGlite calls are real I/O the harness did not see, so `run()` could step the clock mid-statement and the order of commits and timeouts depended on PGlite's speed. The household worked around both with `setImmediate` yields that advanced the clock.

**Decision.**
- One drive: while a run's scenario is pending, `simulate` advances the run's clock to its next moment (the earlier of `ctx.clock.next()` and the next offline edge) whenever the run is idle, within the horizon, or within `t + ms` while a `run(ms)` waits. No harness call moves the clock.
- Idle: no held work pending, two drained macrotask turns with no store-log or DOM change, no harness call in progress but one stalled on an unanswered `ctx.net` route.
- A sim capability factory gets `hold(work, label)`; std-postgres holds each PGlite call, not a plan delay, a queue wait or `fn`'s awaits.
- `run(ms?)`: `run()` to the horizon; `run(ms)` to `t + ms` exactly; `run(0)` drains with no clock move; another `ms` is `schema.invalid`. `horizon: 0` leaves the clock to the scenario.
- The law: one `SimRun` and one scenario give the same moments, observer events and clock times in the same order and equal final stores.
- E1727 (the scenario waits on nothing the run can move, after 1,000 idle turns) and E1728 (held work or a `ctx.net` route that never answers, after 200,000 turns), each failing the run and reported through E1704.

**Alternatives.**
- `until(ctx, cond)`: a second helper moving the clock beside `run()`.
- Driving any sim ctx: changes every harness test; a plain sim ctx keeps a test-owned clock.
- Holding a whole transaction: deadlocks a `fn` that awaits the clock.
- Labels on every `ctx.clock.after` for E1727: touches every caller for a message.

**Consequences.** A scenario awaits server work directly and asserts at a time with `run(ms)`. The household's `moving`, `steadily` and `turn` reduce to awaits and `run(ms)`. Work the run cannot see (a file read, an unloaded `import()`, a timer) is outside the law. k.sim, k.testing and std.postgres stay `implemented`; the map does not change.
