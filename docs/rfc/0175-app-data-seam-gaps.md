# RFC 0175: k.data, std.postgres: migrations found by module, a build that fails on E1006, retried migration passes, dev and compose defaults

Status: implemented (ADR-0197). Amends RFC 0158 (D11 and the Migrations and Modes text of std.postgres). From golden-2's move onto `@keel/std-postgres`, the first app on the app-data seam.

## Decisions
- D1: the build-time evaluation bundles as the server build does, with `require` defined for CommonJS packages. A graph that reaches `pg` evaluates; only module top levels run, as now.
- D2: every problem the evaluation reports fails `keel build` and `vite build` (exit 1, counted in the summary). `keel dev` prints it and keeps serving.
- D3: the framework finds migrations: `modules/<id>/migrations/*.sql` of the app folder. `database(name)` takes no glob; `migrations` stays as an optional map that replaces the folder (fixtures, packages, a library outside an app).
- D4: the app folder is `KEEL_APP_DIR` when set, else the working directory. `keel build` copies the served modules' `migrations/` folders into `dist/<name>/modules/<id>/migrations/`; `server.mjs` sets `KEEL_APP_DIR` to its own folder when unset. The rule lives in k.data, the kernel's seam section, and names no stdlib package: any data library can read the same folder.
- D5: files are read synchronously at the database's first call, not when `database` runs: module top levels stay free of I/O (the build evaluation imports them; `server.mjs` sets `KEEL_APP_DIR` after its imports run), and a sim query still settles without a timer.
- D6: a failed migration pass keeps nothing. A refused or lost connection, opening the store or in the pass, is that call's `keel.unreachable` (502 through k.data's status table); any other failure rejects that call; the next call runs the pass again. std.postgres no longer poisons a ctx, and so no longer poisons a server process.
- D7: `keel dev` sets `KEEL_DEV_DIR` to the app's `.keel-dev/` folder (k.data). std.postgres reads a missing `KEEL_POSTGRES_URL` as `pglite:<KEEL_DEV_DIR>/postgres` there; elsewhere a missing URL stays E2455.
- D8: `deploy/compose.yaml` passes `KEEL_POSTGRES_URL` from the environment, required, to each `node` service serving a module that lists `@keel/std-postgres` in `deps`. It gains no Postgres service.
- D9: a loader's and an action's `run` take `stores` as optional. Absent, `fn` gets what the declared factory returns for `ctx`, `undefined` without one; `run` saves nothing, as now.
- D10: no new codes. E1006, E1807, E2453 and E2455 keep their meanings; their reach changes as stated.
- D11: k.compiler, k.data, k.deploy, k.server and std.postgres go from `conformance-covered` to `implemented`: each gains clauses the ledger holds at `none` until the conformance-writer and the build land (E1707 refuses `conformance-covered` with a `none` clause). Nothing becomes `frozen`.

## Problem
Golden-2 keeps recipes, profiles and API tokens through `@keel/std-postgres` (RFC 0158). Writing it as an app author found five gaps, each verified in this branch.

1. **Routes missing from a build.** `keel build` prints `E1006 modules/accounts/routes.ts failed to evaluate: Dynamic require of "events" is not supported` (and the same for kitchen), then ends `ok build ... 0 errors`. `dist/api/routes.json` holds `health` and `recipes` routes only. `@keel/server` reads that file (`peerPaths.ts`) to forward to a peer the paths it serves, so a split topology would 404 every kitchen and accounts path. Two faults:
   - (a) `evaluateProject` (`packages/compiler/src/internal/evaluateProject.ts`) bundles the graph with esbuild as ESM and bundles packages as they are. `routes.ts` imports its loaders, which import `kitchenDb.server.ts`, which imports `@keel/std-postgres/server`, which imports `pg`; `pg-pool` calls `require("events")`, and esbuild's ESM output has no `require`. The server build has no such failure: Rolldown's output defines `require` through `createRequire`.
   - (b) the plugin's `refresh` passes evaluation problems to `warn`, `buildApp` writes `routes.json` from the table without reading `problems`, and `routesRun` (node-only projects) keeps exit 0 for notes. k.compat already says a throwing contract file fails the build; nothing says so for a throwing `routes.ts`.
2. **Bundler code for migrations.** Both database files read `import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true })` under `/// <reference types="vite/client" />` (RFC 0158 D11). The app writes Vite-specific code to hand the capability files whose folder and names std.postgres already fixes and W2456 already reads, and the build evaluation (esbuild) cannot run `import.meta.glob`.
3. **A refused connection is a 500; a failed pass poisons.** `makeDatabase`'s `statement` and `transaction` call `backend.ensure()` outside their `try`, so an `ECONNREFUSED` while opening the pool or migrating throws instead of answering `keel.unreachable` (`classify` already maps it). `realBackend` keeps the first failure in `failed` and rethrows it on every later call on that ctx; a server has one ctx per process, so the process answers 500 until restarted, as std.postgres Migrations now requires ("every query of that database on the ctx rejects with its error"). Sim is unaffected: a plan step `unavailable` answers before `ensure` (clause 6).
4. **No dev or deploy defaults.** golden-2's `dev` script sets `KEEL_POSTGRES_URL=pglite:.keel-dev/postgres` by hand; without it, `keel dev` answers E2455 at the first query. `composeYaml` (`@keel/scaffold`) passes `KEEL_DATABASE_URL` for `storage: 'postgres'` and nothing for `KEEL_POSTGRES_URL`; golden-2's `deploy/compose.yaml` runs a server that cannot reach its data.
5. **`stores: {}` in tests.** `LoaderInput` and `ActionInput` (`@keel/router`) require `stores`, so `loadCatalogApi.run({ ..., stores: {} }, ctx)` (golden-2 `test/catalogColumns.test.ts`) passes a value its loader never reads. The spec does not state `run` at all.

## Proposal
### Evaluation (k.compiler Build-time evaluation)
The evaluation bundles as the server build bundles: the output defines `require` with `createRequire(import.meta.url)`, as `PG_BANNER` already does for a `'postgres'` deployable, for every evaluation. Only module top levels run; no handler runs and no capability side is made (`register` is lazy, k.data). Every problem it reports (E1006, E1807, a kept code, E1049) is an error of `keel build` and of `vite build`: the build exits 1 and its summary counts it. `keel dev` prints it and keeps serving, as now.

### Migrations found by module (k.data Files, std.postgres Migrations)
```ts
// modules/kitchen/kitchenDb.server.ts
import { database } from '@keel/std-postgres/server'
export const kitchenDb = database('kitchen.db')            // tables: modules/kitchen/migrations/*.sql
```
- `database(name, { migrations? })`. Without `migrations`, the database reads `modules/<moduleId>/migrations/*.sql` of the app folder at its first call, synchronously; `<moduleId>` is the part of `name` before the dot (E2458 already holds it to its module). No folder is no migrations. Files that are not `*.sql` are not read.
- `migrations`, given, is read instead, as now: a package's conformance suite, a fixture, a library used outside a Keel app.
- The app folder: `KEEL_APP_DIR` when set, else the working directory. `keel dev`, `keel test` and an app's own vitest run there. A built server: `keel build` copies `modules/<id>/migrations/` of each module a `node` deployable serves to `dist/<name>/modules/<id>/migrations/` (the Dockerfile copies `dist/<name>/` already), and `server.mjs` sets `KEEL_APP_DIR` to its folder when unset.
- Name errors: E2453 as now, thrown when `database` runs for a given map and at the first call for found files.

How it runs:
| where | app folder | migrations from |
|-|-|-|
| sim (`keel test`, vitest) | working directory | `modules/<id>/migrations/` of the app, into each sim ctx's in-memory schema |
| `keel dev` | working directory | the same, into `pglite:<KEEL_DEV_DIR>/postgres` unless `KEEL_POSTGRES_URL` is set |
| `node dist/<name>/server.mjs` | `dist/<name>/` (`KEEL_APP_DIR`) | the copies `keel build` wrote |
| build evaluation | n/a | not read: no call runs |

Keel still owns no app data: the kernel names a folder and an app folder, and copies files. Which store reads them, and how, stays the capability's.

### Failed passes (std.postgres Migrations)
"After a failed pass every query of that database on the ctx rejects with its error" becomes: a failed pass keeps nothing. A refused or lost connection, opening the store or in the pass, is that call's `keel.unreachable`, as a statement's is. Any other failure (a migration's SQL, E2453, E2454) rejects that call. The next call, on that ctx or another, runs the pass again. The advisory lock and `keel_migrations` rows make a repeated pass safe: an applied migration is not run twice.

### Dev and compose defaults
- k.data: `keel dev` sets `KEEL_DEV_DIR` to the app's absolute `.keel-dev/` folder, where `keel dev` already keeps each deployable's storage file (k.topology Local topology) and where a capability keeps its dev data.
- std.postgres Modes: a missing `KEEL_POSTGRES_URL` is `pglite:<KEEL_DEV_DIR>/postgres` when `KEEL_DEV_DIR` is set; else E2455 as now. The scaffold's `.gitignore` already lists `.keel-dev/`, so the scaffold needs no dev script and no setup step.
- k.deploy Deploy files: `deploy/compose.yaml` passes `KEEL_POSTGRES_URL: ${KEEL_POSTGRES_URL:?}` to each `node` service serving a module whose `deps` list `@keel/std-postgres`, as it passes `KEEL_DATABASE_URL` for `storage: 'postgres'`. No URL is written.

### `run` (k.server API)
A loader's `run(args, ctx)` and an action's `run(input, args, ctx)` call `fn` directly, outside a request. `args.stores` is optional: absent, `fn` gets what the declared `stores` factory returns for `ctx`, `undefined` without one. `run` saves nothing; a request saves (Server state).

## Alternatives
- **Evaluation stubs every package outside the project.** Rejected: a route table is built from package values (`@keel/schema` schemas, a placed stdlib module's `./contract` and `./routes`), so stubs would change `routes.json`.
- **Evaluation stubs `*.server.ts` files only.** Rejected: `routes.ts` binds loaders that are `*.server.ts` exports; stubbing them loses the binding `routesArtifact` reads (`stores`, kind, live).
- **`routes.json` from static reading, no evaluation.** Rejected: schemas become JSON Schema by running `@keel/schema`; W1005 already covers the parts static reading cannot see.
- **Evaluation marks packages external (Node imports them).** Rejected for now: workspace packages ship TypeScript sources, and which file Node imports would differ from the one bundled for `server.mjs`.
- **E1006 stays a warning; `keel check` reports it.** Rejected: the build writes a `routes.json` that forwards nothing to a peer; a build that cannot list its routes is a failed build.
- **Keep `import.meta.glob` and teach the evaluation to run it.** Rejected: the app still writes bundler code and a `vite/client` type reference to hand over files whose place the spec fixes.
- **The compiler inlines migrations into the bundle** (a virtual module, or a transform of `database(...)` calls). Rejected: the kernel compiler would name a stdlib API (k.parity), and a sim test run outside the plugin would read nothing.
- **Migrations in `std.json`** (k.module Std config). Rejected: a sim ctx no `createApp` bound reads `{}`, so tests would need `bindStd`; `std.json` is configuration, and part of it reaches browsers.
- **Read files when `database` runs.** Rejected: the build evaluation and every test import would do I/O, and `server.mjs`'s imports run before it can set `KEEL_APP_DIR`.
- **Remove the `migrations` option.** Rejected: no feature cuts; packages and fixtures pass a map.
- **Keep the poisoned ctx.** Rejected: one refused connection at startup ends a server's data access until a restart.
- **`keel dev` sets `KEEL_POSTGRES_URL` itself.** Rejected: the kernel would name one stdlib package's variable; `KEEL_DEV_DIR` serves any data library.
- **A Postgres service in `compose.yaml`.** Rejected: its password would be a secret in a generated file (k.deploy: no generated file holds a URL), and Keel would own a database's lifecycle. `storage: 'postgres'` takes its URL from the environment the same way.
- **`stores` stays required; the testing harness wraps `run`.** Rejected: one more API for a value the loader never reads.

## Spec diff
Applied in this commit:
- **k.compiler** (status `implemented`, D11): Build-time evaluation states the server build's bundling, top levels only, and that each problem fails `keel build` and `vite build` (exit 1), `keel dev` printing it. Conformance gains two clauses (21, 22).
- **k.data** (status `implemented`): new paragraph Files: the migrations folder, the app folder (`KEEL_APP_DIR`, else the working directory), the build's copy, `server.mjs` setting `KEEL_APP_DIR`, `keel dev` setting `KEEL_DEV_DIR`. Conformance gains three clauses (7 to 9).
- **k.deploy** (status `implemented`): the compose bullet gains `KEEL_POSTGRES_URL`. Conformance gains one clause (12).
- **k.server** (status `implemented`): API gains the `run` bullet. Conformance gains one clause (17).
- **std.postgres** (status `implemented`): API example without a glob; Migrations: `database(name, { migrations? })`, the found files, when E2453 throws, the failed pass; Modes: the `KEEL_DEV_DIR` default. Conformance gains four clauses (9 to 12).
- **Map** and `spec/std/README.md`: the five rows read `implemented`.
- **Ledger**: the eleven clauses are in `tooling/ledger/ledger.json` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0175`, from the spec text alone:
- `packages/compiler/conformance/`: k.compiler 21 (a CommonJS `require` of `events` in a `routes.ts` graph evaluates) and 22 (`keel build` exits 1 on E1006, both build paths).
- `packages/ctx/conformance/` (k.data's owner; the build cases may sit where k.deploy's build fixtures do, `packages/cli/conformance/`): k.data 7 to 9.
- `packages/cli/conformance/` or `packages/scaffold/conformance/` (where k.deploy's compose clause 2 lives): k.deploy 12.
- `packages/router/conformance/` or `packages/server/conformance/` (where k.server's loader clauses live): k.server 17.
- `packages/std-postgres/conformance/`: std.postgres 9 to 12; clause 10 needs a closed port only, clause 11 a `pglite:` folder.
Spec topics: `pnpm spec k.compiler`, `pnpm spec k.data`, `pnpm spec k.deploy`, `pnpm spec k.server`, `pnpm spec std.postgres`; for context `pnpm spec k.compat`, `pnpm spec k.topology`, `pnpm spec k.sim`.

## Build
- `@keel/compiler`: `evaluateProject` adds the `createRequire` banner; the plugin's build and `buildApp` turn evaluation problems into build errors; the server build copies served modules' `migrations/` folders; the generated server entry sets `KEEL_APP_DIR`; the dev path sets `KEEL_DEV_DIR`.
- `@keel/cli`: `routesRun` returns code 1 when `buildRoutes` reports a problem; the build summary counts it.
- `@keel/std-postgres`: `DatabaseOptions.migrations` optional; a found-files reader at the first call; `ensure` inside the answering `try` (`classify` maps the refused connection); no `failed` cache; the `KEEL_DEV_DIR` default in `engineFor`.
- `@keel/scaffold`: `composeYaml` takes which `node` deployables serve a `@keel/std-postgres` module.
- `@keel/router`: `LoaderInput.stores` and `ActionInput.stores` optional; `run` fills an absent one from `decl.stores(ctx)`.
- golden-2: both database files lose the glob and the `vite/client` reference; the `dev` script loses `KEEL_POSTGRES_URL`; `deploy/compose.yaml` regenerated; `stores: {}` dropped from `test/catalogColumns.test.ts`.
- Docs: the `keel-data` and `keel-deploy` skills, `docs/guide` pages on app data, the std-postgres README, golden-2's README.

## Known limits
- A migration added while `keel dev` runs applies after `keel dev` restarts or the database's file is saved: files are read once per `database` call, and a process applies a URL and capability's migrations once.
- Clause 22 counts every evaluation problem, so an E1801 kept from `compileStyles` also fails a build; `keel check` already reports it as an error.
- `keel test` and vitest read the working directory; a workspace that runs an app's tests from another folder sets `KEEL_APP_DIR`.

## Migration
None: unreleased.

## Token impact
k.compiler 6,005 to 6,684 characters; k.data 5,539 to 6,660; k.deploy 5,997 to 6,350; k.server 5,986 to 6,512; std.postgres 6,014 to 7,400 (1,850 tokens). `spec.section` and `docs.section` are re-based from 1,750 to 1,850: std.postgres states the migration source, the pass retry and the dev default, and each is a clause a conformance writer needs. Map unchanged in size.

## For the operator
1. Every evaluation problem now fails a build (D2). Recommendation: accept; golden-2 builds clean once D1 lands, and a build that drops routes is worse than one that stops.
2. Two kernel variables, `KEEL_APP_DIR` and `KEEL_DEV_DIR` (D4, D7). Recommendation: accept; both are generic, and the alternative names std.postgres in the kernel.
3. No Postgres service in compose (D8). Recommendation: accept; the operator's database, as for `storage: 'postgres'`.
