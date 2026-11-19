---
"@keel/testing": minor
"@keel/ctx": patch
---

`simulate(scenario, { runs, seed, horizon, replay })` (k.sim) runs a scenario under generated schedules: each run gets a sim ctx from a `SimRun` `{ seed, schedule }` and a `run()` that settles and steps the sim clock through due deadlines. Live stores are restored around every run. A failure is shrunk and thrown as E1704 with the shrunk `SimRun` as JSON on its second line; `replay` runs that `SimRun` again. `SimRun` is an exported schema. `@keel/ctx/internal` lists the plan schemas of registered capabilities.
