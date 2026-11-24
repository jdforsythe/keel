---
"@keel/testing": minor
"@keel/ctx": minor
"@keel/std-postgres": patch
"@keel/check": patch
---

`simulate` drives the run's clock while a scenario is pending: whenever nothing in the run can move without it, the clock goes to the next deadline or offline window edge, up to the horizon, so a scenario awaits a job's effect, a statement or a delayed request directly and no harness call moves the clock. `run()` waits to the horizon, `run(ms)` to exactly `ms` on, `run(0)` drains at the current time, `horizon: 0` leaves the clock to the scenario. A capability's sim factory gets `hold(work, label)` for real I/O; std-postgres holds each PGlite call. Two runs of one `SimRun` take the same moments and end with equal snapshots. E1727 (the scenario waits on nothing the run can move) and E1728 (work in flight never answers) reach the operator as E1704 with the shrunk `SimRun`; `keel explain` gains both.
