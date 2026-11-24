---
"@keel/testing": minor
"@keel/ctx": minor
"@keel/std-postgres": patch
"@keel/check": patch
---

`simulate` runs each scenario in the run's async context (Node only; `@keel/ctx` imports no Node module) and drives the run's clock while the scenario is pending: on each turn where no work of the run is pending (an asynchronous resource other than a promise, held work, a harness call not stalled on `ctx.net`) the clock goes to the next deadline or offline window edge, up to the horizon, so a scenario awaits a job's effect, a statement or a delayed request directly and real durations decide nothing. `run()` waits to the horizon, `run(ms)` to exactly `ms` on, `run(0)` drains at the current time, `horizon: 0` leaves the clock to the scenario. A capability's sim factory gets `hold(label, start)` for work that answers through something made outside the run; std-postgres holds its engine boot and each PGlite call. `simulate(..., { law: true })` runs each run twice and compares traces; a failing run is replayed twice; a difference is E1729. E1727 (the scenario waits on nothing the run can move) and E1728 (held work waits on the sim clock, or work pending for 10,000 ms of real time) reach the operator as E1704 with the shrunk `SimRun`; `keel explain` gains E1727, E1728 and E1729.
