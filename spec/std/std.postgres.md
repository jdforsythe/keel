# std.postgres: Postgres app data
status: proposed

**Extension points.** Capability registry (k.ctx, k.data): `database(name, ...)` registers one capability per call. Check rule registry: `@keel/std-postgres/tools` (E2451, E2452, E2458, W2456). A module using it lists it in `deps`, the database's name in `capabilities`.

**API.** `@keel/std-postgres` is client-safe; `/server` and `/testing` are Node only.
```ts
import { database } from '@keel/std-postgres/server'   // modules/kitchen/kitchenDb.server.ts
export const kitchenDb = database('kitchen.db', {
  migrations: import.meta.glob<string>('./migrations/*.sql', { query: '?raw', import: 'default', eager: true }),
})
import { NoRows, fragment, sql } from '@keel/std-postgres'
const r = await kitchenDb(ctx).query(sql(Recipe)`select ... where id = ${id}`)   // Result<Recipe[], E>
```
- `sql(schema)` tags a template into a `Query<T>`, `T` the schema's type. Each `${value}` is a parameter (`$1`, ...), never text; a `fragment` value is spliced with its own parameters; nothing else is. A parameter is a JSON value: a string, finite number, boolean, `null`, an array of these (a Postgres array) or a plain object (JSON text); anything else, a `Secret` too, throws E2457 naming its position.
- `query(q)`: every row, parsed by `q`'s schema. `one(q)`: the one row; none is `keel.notFound`, more than one throws. `run(q)`: the count of rows changed; `q` is `sql(NoRows)`, which refuses any row. `transaction(fn, { isolation? })`: `fn(tx)`, `tx` with `query`, `one` and `run`, in one transaction (`read committed`, `repeatable read` or `serializable`); `ok` commits, `err` or a throw rolls back. A serialization failure or deadlock runs `fn` again, at most 3 runs, then is `keel.conflict`.
- Errors: a row failing its schema is `postgres.result`, data `{ row, issues }` (paths, rules); a unique, foreign key, check or not-null violation is `postgres.constraint`, data `{ constraint, kind }`, `kind` `unique`, `foreign`, `check` or `notNull`; a refused or lost connection is `keel.unreachable`; a serialization failure outside `transaction` is `keel.conflict`. Any other database error throws with its SQLSTATE. No error, log line or diagnostic holds a parameter or row value.
- Values arrive as JSON values: `bool` as a boolean; `int2`, `int4`, `int8`, `float4`, `float8` as numbers (an `int8` past 2^53 - 1 as its text); `json` and `jsonb` parsed; arrays as arrays; every other type as Postgres's text form (`date` `2026-11-21`). An instant is an `int8` of `ctx.clock.now()` milliseconds.

**Migrations.** `migrations` maps `./migrations/NNNN-<kebab>.sql` to its text, numbered from 0001 without a gap; another key or a gap throws E2453 when `database` runs. Forward only: there is no down file. The first query of a database on a ctx applies its pending migrations in order, each in its own transaction with its row in `keel_migrations (capability, id, name, digest)`, under an advisory lock per capability, so processes apply each once. An applied migration whose file is gone or whose SHA-256 differs is E2454. After a failed pass every query of that database on the ctx rejects with its error.

**Modes.** `KEEL_POSTGRES_URL` picks the store, read at the first query: `postgres:` or `postgresql:` uses `pg`, a pool per URL per process of at most 10 connections, TLS as `sslmode` says, idle ones letting the process exit; `pglite:<folder>` uses PGlite on disk, one process (dev: `pglite:.keel-dev/postgres`). Missing or another scheme is E2455, naming no part of the value. Under sim each database is PGlite in memory, migrated, one per sim ctx and capability, `setseed` from the capability seed; after `await ready()` (`/testing`, in the app's vitest `setupFiles`) every sim query settles without a timer. The plan (k.sim) is `{ delay, fault }[]`, `delay` integer 0 to 60,000 sim ms, `fault` `none`, `unavailable` (`keel.unreachable`, runs nothing) or `conflict` (a serialization failure); each `query`, `one`, `run` and `transaction` run takes one step.

**Rules.** E2451 `@keel/std-postgres/server` imported, statically or by `import()`, outside a `*.server.ts` file, tests and type-only imports aside · E2452 that import in a module a deployable other than `node` serves · E2453 a bad migration key or gap · E2454 applied migrations disagree with the files · E2455 `KEEL_POSTGRES_URL` missing or of another scheme · W2456 `now()`, `current_timestamp`, `clock_timestamp()`, `random()` or `gen_random_uuid()` in a template's text or a migration, which does not replay under sim (pass `ctx.clock.now()` or `ctx.random.id(brand)`) · E2457 a parameter that is not a JSON value; E2453 to E2455 and E2457 throw · E2458 a `database` name that is not a literal `<moduleId>.<name>` of its module (E1607).

**Conformance.**
- `` sql(S)`select ${"x'; drop table t"}` `` sends one parameter and the text `select $1`; a spliced `fragment` renumbers its parameters after the outer ones.
- `query` parses every row with the schema; a row failing it is `postgres.result`, holding no value; `one` of no row is `keel.notFound`; `run` of a statement returning a row is `postgres.result`.
- An insert breaking a unique index is `postgres.constraint` naming it, `kind` `unique`; a `Secret` or `undefined` parameter throws E2457.
- A `serializable` transaction refused twice then accepted runs `fn` three times and commits once; refused three times it is `keel.conflict` and nothing is committed; `err` rolls back.
- Two processes on one database apply each pending migration once; a changed applied file is E2454; `0001`, `0003` is E2453.
- Under sim, two ctxs of one seed give equal answers to the same calls; one ctx sees none of another's rows; a plan step `unavailable` is `keel.unreachable` and writes nothing.
- On PGlite and on Postgres 17 in CI, `int8`, `jsonb`, `date` and `text[]` columns arrive as the API says.
- E2451, E2452, E2458 and W2456 each fire on a fixture, not on its clean twin; a missing `KEEL_POSTGRES_URL` is E2455.
