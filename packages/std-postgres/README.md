# @keel/std-postgres

**Spec:** std.postgres · **Status:** proposed · **verified:** (none)

App data in Postgres for `node` deployables (k.data). `database(name, { migrations? })` registers a capability whose real side is Postgres through `pg` or PGlite on disk, and whose sim side is PGlite in memory, so a test and a seeded simulation run the same SQL. Every statement names the schema its rows are parsed with.

## Contract

- **Public API:**
  - `@keel/std-postgres` (client-safe): `sql(schema)`, a template tag giving `Query<T>` `{ text, params, schema }`; `fragment`, a tag for text `sql` splices; `NoRows`, the closed empty schema `run` takes. Types `Query`, `Fragment`, `StatementError`, `ResultError` (`postgres.result`), `ConstraintError` (`postgres.constraint`), `Unreachable`, `Conflict`, `NotFound`.
  - `@keel/std-postgres/server` (Node, `*.server.ts`): `database(name, { migrations? }): (ctx) => Database`. `Database` has `query(q): Promise<Result<T[], StatementError>>`, `one(q)` (adds `keel.notFound`), `run(q: Query<NoRows>): Promise<Result<number, StatementError>>` and `transaction(fn, { allow, reason }?)`, `fn(tx)` returning a `Result` (a union of results too); `tx` has `query`, `one` and `run`. Types `Allow` (`'write skew' | 'lost updates'`), `Database`, `DatabaseOptions`, `TransactionOptions`, `Tx`.
  - `@keel/std-postgres/testing`: `ready(): Promise<void>`, for the app's vitest `setupFiles`.
  - `@keel/std-postgres/tools`: `serverImport` (E2451), `nodeDeployable` (E2452), `databaseName` (E2458), `allowReason` (E2459), `replayless` (W2456).
- **Invariants:**
  - `${value}` is always a parameter, `$1` onward in template order; a `fragment` is spliced with its parameters numbered in place. A parameter is a string, finite number, boolean, `null`, an array of these or a plain object; anything else at any depth throws E2457 naming its `$N` and the kind of value. Both engines get each parameter as Postgres text: an array as an array literal, an object as JSON text.
  - Rows arrive as JSON values from Postgres text, by column type: `bool` a boolean; `int2`, `int4`, `int8`, `float4`, `float8` numbers, with an `int8` past 2^53 - 1 and a non-finite float as text; `json` and `jsonb` parsed; arrays as arrays, element by element; every other type its text. Then the statement's schema parses each row; the first that fails is `postgres.result` `{ row, issues }`.
  - `one` of more than one row rejects. `run` of a statement that returns a row is `postgres.result`, each column an `unknown-key` issue.
  - A unique, foreign key, check or not-null violation is `postgres.constraint` `{ constraint, kind }` (a not-null violation names its column). A serialization failure or deadlock past its third run is `keel.conflict`; a refused or lost connection `keel.unreachable`. Any other database error throws an error holding its SQLSTATE only, since Postgres's own message can quote a value.
  - `transaction` runs `fn` in one `serializable` transaction; `allow: 'write skew'` runs it at `repeatable read`, `allow: 'lost updates'` at `read committed`, each with a non-blank `reason`, else it throws, as another `allow` does. Each lone `query`, `one` and `run` is its own `serializable` transaction (on `pg`, each pool connection starts with `default_transaction_isolation=serializable`; on PGlite, a transaction around the statement), rerun on a serialization failure or deadlock as `fn` is, at most 3 runs, then `keel.conflict`. Each statement on `tx` runs inside a savepoint, so a constraint error leaves the transaction usable. `ok` commits; `err` or a throw rolls back. A serialization failure or deadlock, at a statement or at commit, runs `fn` again, at most 3 runs, then answers `keel.conflict`. A constraint checked at commit is `postgres.constraint`.
  - Migrations: the `*.sql` files of `modules/<moduleId>/migrations/` in the app folder (`KEEL_APP_DIR`, else the working directory; `<moduleId>` the part of `name` before the dot), read at the database's first call; no folder is none. A given `migrations` map, keys `./migrations/NNNN-<kebab>.sql`, is read instead. Names run from 0001 without a gap, else E2453: when `database` runs for a map, at the first call for files. At a database's first query the pending files run in order, each in its own transaction with its `keel_migrations (capability, id, name, digest)` row, under `pg_advisory_xact_lock` per capability. A row whose file is gone or whose SHA-256 differs from its `digest` is E2454. A process checks a URL and capability once. A failed pass keeps nothing: a refused or lost connection is that call's `keel.unreachable`, any other failure rejects that call, and the next call runs the pass again.
  - Modes: `KEEL_POSTGRES_URL`, read at a ctx's first query; missing, `pglite:<KEEL_DEV_DIR>/postgres` when `KEEL_DEV_DIR` is set (`keel dev`). `postgres:` and `postgresql:` use a `pg` pool of at most 10 per URL per process with `allowExitOnIdle`; `pglite:<folder>` opens PGlite on disk, at most 2 folders open per process, the least recently used idle one closing first and opening again at its next query. Anything else, or no URL outside `keel dev`, is E2455, naming no part of the value.
  - Sim: one PGlite in memory per process, made by `ready()`, holds a schema per sim ctx and capability, migrated at its first call. Each run of a lone statement and each run of `fn` takes one plan step; a `conflict` step runs it and commits nothing (`{ delay, fault }`, `delay` on the sim clock); past the plan's end a call takes `none`. Each transaction sets `setseed` from the capability seed and the call count, so a seed replays `random()`. After `ready()` every sim query settles in microtask rounds, with no timer.
- **Dependencies:** `@keel/check`, `@keel/compiler`, `@keel/ctx`, `@keel/schema`; `pg` 8.23.1 and `@electric-sql/pglite` 0.5.16 (Postgres 18 in WASM, loaded by `import()` only for `pglite:` and under sim); `createHash` of `node:crypto`; `node:fs` reads the migrations folder.
- **Rungs:** conformance on sim, PGlite and, with `KEEL_TEST_POSTGRES_URL`, Postgres 17; properties for `sql`, `fragment`, the parameter check and the value codec.

## A database in a module

```ts
// modules/kitchen/kitchenDb.server.ts
import { database } from '@keel/std-postgres/server'

export const kitchenDb = database('kitchen.db')   // tables: modules/kitchen/migrations/0001-recipes.sql, ...

// in a loader's fn
const recipes = await kitchenDb(ctx).query(sql(Recipe)`select id, title from recipes where minutes <= ${max}`)
if (!recipes.ok) return recipes
```

The module lists `@keel/std-postgres` in `deps` and `kitchen.db` in `capabilities`. `keel build` copies `modules/kitchen/migrations/` into `dist/<name>/`, and `server.mjs` sets `KEEL_APP_DIR` to its folder; `deploy/compose.yaml` requires `KEEL_POSTGRES_URL` from the environment. Its tests await `ready()` in a vitest setup file; each sim ctx starts with migrated, empty tables.

## Extension points

Uses the **capability registry** (k.ctx `register(name, { real, shell, sim, plan })`, one capability per `database` call) and the **check rule registry** (k.check: E2451, E2452, E2458, E2459 and W2456 from `./tools`). `keel review` lists each `allow` (R2451, k.escapes).

## Unsafe

count: 0
