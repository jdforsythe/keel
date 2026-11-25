# ADR-0180: k.data and std.postgres: app data outside the kernel (RFC 0158)

**Status:** accepted (W14 step 1, decision D43).

**Context.** Every record golden-2 keeps (recipes, API tokens, profiles) is a server store, restored and saved whole per request through `ctx.storage`. That holds for bounded state and fails for records: no index or query, every write to one store conflicts, every request reads every row. The spec states no stance on an app's own database, no name rule for an app capability, and nothing of what simulation and the ledger mean once data leaves `ctx.storage`; `keel dev` would throw E1602 when an app file that calls `register` is edited.

**Decision.**
- The kernel validates what crosses a boundary and neither stores nor fetches app data (k.data, glossary **app data**). The seam is the existing capability registry: `register<T>` in one `*.server.ts` app file, named `<moduleId>.<name>` (E1607), real, shell (the real side) and sim sides returning one `T`, so `tsc` checks that library, fake and handlers agree, and the boundary schemas check each request and answer.
- `read` and `commit` (k.persist) keep Keel's own state: store snapshots and what stdlib packages version through it. A server store holds bounded state; records are app data.
- Under sim a data capability answers from its sim side, which keeps k.sim's rule. Data reached any other way is not simulated; k.data states what that costs. The ledger gains no record kind: a rung earned under sim is evidence about the code with each sim side.
- `keel dev` reloads the whole server graph when a file that registers changes; E1602 is unchanged.
- `@keel/std-postgres` (std.postgres, E2451 to E2458) is the battery: `database(name, { migrations })`, `sql(schema)` with a schema on every statement (`NoRows` for none), `fragment`, `query`, `one`, `run`, `transaction`, forward-only module-local SQL migrations, `KEEL_POSTGRES_URL` (`postgres:` or `pglite:`), PGlite in memory per sim ctx with a fault plan.

**Alternatives.** A kernel data API or query builder (a library choice for every app, more frozen surface); app data as a `createCtx` driver (drivers are refused under sim, where app data needs its fake); relaxing E1602 to replace (drops the duplicate check); a ledger mark for real-store tests (the ledger cannot see which side ran); migrations read from disk (break once bundled); the Postgres module in a later RFC (leaves the seam unproven against a fixed API).

**Consequences.** Apps own their data and its library; Keel's guarantees over it are the boundary schemas, the types, and simulation through the sim side. Handlers name no `stores` for app data, and an action writes to stores or to app data, not both. Explore and prove reach stores only. Out of scope until a second store asks: a store-neutral core, a seed engine, a build-time SQL check, row ownership. golden-2's records move to `kitchen.db` and `accounts.db`; std.tokens needs a way to name a token's id before `check` (RFC 0158, For the operator 1).
