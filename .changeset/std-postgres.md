---
"@keel/std-postgres": minor
---

`@keel/std-postgres`: app data in Postgres (std.postgres). `database(name, { migrations })` registers a capability with `query`, `one`, `run` and `transaction`; `sql(schema)` makes statements whose every `${value}` is a parameter and whose rows the schema parses; `fragment` is spliced text; `NoRows` is `run`'s schema. `KEEL_POSTGRES_URL` picks `pg` (`postgres:`) or PGlite on disk (`pglite:<folder>`); under sim each ctx gets migrated tables in PGlite in memory, plan-driven `unavailable` and `conflict` steps, and `setseed` from its seed. Forward-only migrations run once across processes under an advisory lock. `/testing` exports `ready()`; `/tools` registers E2451, E2452, E2458 and W2456.
