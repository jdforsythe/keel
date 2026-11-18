# S8: std-db on a real Postgres (backlog 0610, 0694)

Server: `postgres:17` image, `PostgreSQL 17.12 (Debian 17.12-1.pgdg13+1) on aarch64-unknown-linux-gnu`, container `keel-s8-pg` on 127.0.0.1:54329, no volume, removed at the end. `KEEL_TEST_POSTGRES_URL=postgres://postgres:<throwaway>@127.0.0.1:54329/postgres`. For the TLS cases the container got a self-signed certificate and `ssl = on` (`alter system`, reload); `ssl` was turned off again for a run that matches CI.

## Files that take the real-Postgres path when `KEEL_TEST_POSTGRES_URL` is set

`packages/std-db/conformance/fixtures.ts` (`makeRig("postgres")`) is the only switch in the package. Files that reach it: `conformance/driver-contract.test.ts`, `conformance/serial-commits.test.ts`, `conformance/layout-e2152.test.ts`, `test/model.test.ts`, and the new `test/postgres-server.test.ts`. `conformance/e2153-no-value.test.ts` opens `127.0.0.1:1` and never reaches the server either way. `evals/tasks/golden-1-api/restartBuilt.ts` has a Postgres branch; it is not a test file and runs only inside the golden-1-api eval (`pass.ts`). No server, testing or golden-1 test file selects storage `postgres`.

## Results (each file alone, from `packages/std-db`, variable set)

| File | Result line |
|---|---|
| conformance/driver-contract.test.ts | `ok 16 tests, 0 failed, 0 skipped (0.6s)` |
| conformance/serial-commits.test.ts | `ok 2 tests, 0 failed, 0 skipped (0.6s)` |
| conformance/layout-e2152.test.ts | `ok 6 tests, 0 failed, 0 skipped (0.5s)` |
| conformance/e2153-no-value.test.ts | `ok 4 tests, 0 failed, 0 skipped (0.6s)` (never reaches the server) |
| test/model.test.ts | `ok 4 tests, 0 failed, 0 skipped (0.5s)` |
| test/postgres-server.test.ts, ssl on | `ok 14 tests, 0 failed, 0 skipped (11.3s)` |
| test/postgres-server.test.ts, ssl off | `ok 14 tests, 0 failed, 3 skipped (11.3s)` |
| test/postgres-server.test.ts, variable unset | `ok 14 tests, 0 failed, 13 skipped (10.2s)` (the connect timeout runs) |
| the five Postgres files in one vitest run, after the config fix | `ok 42 tests, 0 failed, 0 skipped (13.6s)` |
| restartBuilt.ts as committed (scratch driver, no eval) | fails on sqlite and postgres alike: every write is 422 `write.owner: Required` |
| restartBuilt.ts with `owner: ""` in its three write bodies (scratch copy) | `ok (every step holds)`, postgres branch included; `keel.store.api.board` row present in the server |

That the conformance files hit the server: `keel_meta` held `layout = 1` in the container after they ran.

## Clauses from 0610 / 0694

| Clause | Test exists | Ran on real Postgres | Passed |
|---|---|---|---|
| std.db conformance clause 1 (driver contract on Postgres) | yes, conformance | yes | yes |
| Advisory locks across two connections | new: a commit waits on another connection's `pg_advisory_xact_lock` on its key (seen in `pg_stat_activity` as a Lock wait), finishes after the holder commits; 8 concurrent commits from two pools expecting `null`: exactly one true, 10 rounds | yes | yes |
| Lock order | new: two pools commit `x,y,z` and `z,y,x` concurrently, 25 rounds, no deadlock (40P01), exactly one wins | yes | yes |
| Read committed visibility | new: the waiting commit compares against the holder's committed row (false), and against the old value when the holder rolls back (true); pool A's commit is read by pool B at once, 20 rounds; property (seed 1337, 40 runs): concurrent commits from two pools equal a serial order of the true ones | yes | yes |
| TLS | new: `sslmode=no-verify` connects with `pg_stat_ssl.ssl = true`, `sslmode=disable` with false; `verify-full` against a self-signed certificate rejects E2153. Skipped unless the server has `ssl` on | yes (local container only) | yes; `sslmode=require` is a finding, below |
| Pool cap | new: 15 commits blocked on one lock hold exactly 10 server connections; the rest wait and all finish, one true | yes | yes |
| Connect timeout | new: a server that accepts and never answers rejects E2153 after 9 to 20 s (the pool's 10 s) | does not need one | yes |
| Connection loss mid-commit | new: `pg_terminate_backend` of the commit's backend while it waits on a lock: the commit rejects `std.db postgres: commit failed (57P01)`, nothing stored, the next commit succeeds; backend terminated after the upsert and before `COMMIT`: rejects, the row is absent, the next commit succeeds | yes | yes, after the fix below |
| E2153 on a refused login | new: a wrong password rejects E2153 naming `KEEL_DATABASE_URL` and no part of the URL | yes | yes |
| `restartBuilt`'s Postgres branch | exists (eval helper) | yes, from a scratch copy | yes with the owner field; the committed file fails before reaching Postgres |

Connection loss was made from the test with `pg_terminate_backend` over SQL (the same server function `docker exec ... psql` would call), so CI can run it.

## Fixed

- `packages/std-db/src/postgres/postgres.ts`: a backend lost while a commit was in flight crashed the process: the checked-out `pg` client emitted an `error` event nobody listened to (`Error: Connection terminated unexpectedly`, exit 1, reproduced outside vitest). `quietPool` now drops client errors on every client from `connect`, so the query in flight or the next one rejects and reports it. Changeset `.changeset/std-db-postgres-connection-lost.md`.
- `packages/std-db/vitest.config.ts`: with the variable set, the package suite ran files in parallel on one server and the conformance rigs dropped each other's tables (`fail 38 tests, 9 failed`). Files run one after another when `KEEL_TEST_POSTGRES_URL` is set.

## CI

`tooling/ci.source.json` gains job `postgres` (regenerated into `.github/workflows/ci.yml` with `node tooling/generate.mjs`; no other generated file changed): `needs: check`, beside `test` and not before it, `timeout-minutes: 15`, service `postgres:17` on 5432 with a `pg_isready` health check, `KEEL_TEST_POSTGRES_URL` set at job level, the usual setup steps, then one step in `packages/std-db` running the six files one at a time with `set -e`. No existing job changed.

## Proposals (not built)

1. **`sslmode=require` verifies the certificate.** `pg` 8.23 reads `require`, `prefer` and `verify-ca` as `verify-full`: `require` against a self-signed or private-CA server is refused (E2153), where libpq would encrypt without verifying. It also prints a multi-line `SECURITY WARNING` through `process.emitWarning` at every connect with those modes, outside `docs/OUTPUT.md`. Pinned by a `test.fails` case in `test/postgres-server.test.ts`. std.db line 13 today: "- `postgres(url)` uses `pg`, a pool of at most 10 connections, TLS as the URL's `sslmode` says; ...". Change to either (a) "TLS as libpq reads the URL's `sslmode` (`require` encrypts without verifying the certificate)": the driver adds `uselibpqcompat=true`; or (b) "TLS as the URL's `sslmode` says, `require` and `verify-ca` verifying the certificate as `verify-full` does". spec/std/std.db.md is 4,306 chars (1,077 tokens), about 1,100 after either. No conformance header quotes the sentence. Conformance wanted: on a server with a self-signed certificate, `require` resolves (a) or rejects E2153 (b); `disable` connects with `pg_stat_ssl.ssl = false`; no output line outside OUTPUT.md. The user's call (security). Recommendation: (b), the stricter one, plus silencing the warning by passing `verify-full` to `pg` when the URL says `require`.
2. **`restartBuilt.ts` is stale against the `Write.owner` field** in the std-offline working tree: its three write bodies need `owner: ""` (no one signed in). Owned by the std-offline/golden-1 lane and `evals/**`; diff in the scratch copy was three lines.
3. **`restartBuilt`'s Postgres branch is not in CI.** The weekly `eval` job sets no `KEEL_TEST_POSTGRES_URL`. Once proposal 2 lands, a step in job `postgres` (or the service on `eval`) would run it.
4. **Conformance rigs share one database.** `conformance/fixtures.ts` drops `keel_kv` per rig on the one URL; files can only run serially against a real server. A database per rig would remove the config switch; needs the conformance writer.

## Not shown

- TLS in CI: the service container has no certificate and GitHub services cannot pass `-c ssl=on`; the three TLS cases skip there.
- A pool wait past 10 s: the 11th caller would reject `commit failed (unknown)` after `connectionTimeoutMillis`; not exercised, and the spec names no connect or pool timeout.
- `restartBuilt` from the committed file: fails on both drivers before Postgres matters (proposal 2).

## Runs on 2026-11-18, head 2c713d05

Server: `postgres:17` image, `PostgreSQL 17.12 (Debian 17.12-1.pgdg13+1) on aarch64-unknown-linux-gnu`, container `keel-s8-pg` on 127.0.0.1:54329, removed afterwards. Host arm64 (Apple silicon), Node 24.19.0. Three runs each.

| Run | Command | Result |
|---|---|---|
| `restartBuilt`, SQLite and Postgres branches (committed file, with the owner field) | `KEEL_TEST_POSTGRES_URL=... node <scratch driver calling restartBuilt(root)>` | 3 of 3 `ok` (10.1 s, 9.7 s, 9.8 s); `keel.store.api.board` row present in `keel_kv` afterwards |
| `tooling/smoke/restart.mjs`, SQLite | `node tooling/smoke/restart.mjs` | 0 of 3: `fail restart 9 steps, 4 failed (2.7s)`; every write 422 |
| `tooling/smoke/workflow.mjs`, SQLite | `node tooling/smoke/workflow.mjs` | 0 of 3: `fail workflow 15 steps, 8 failed (22.7s)`; add list, remove and undo fail |
| `restart.mjs` and `workflow.mjs`, Postgres | none | both scripts are SQLite only; no Postgres run exists (0822) |

Cause of the two failures: the smokes' write bodies carry no `owner`, and the std-offline write shape requires it (`write.owner: Required`, 422), the same fault `restartBuilt.ts` had before b0324bc2. Not fixed here; backlog 0822. `restartBuilt`'s Postgres branch is not in CI (0823).

## Runs on 2026-11-18 after the owner field, head 2c713d05 plus the two smoke edits

The two smokes' write bodies gained `owner: ""` (the shape `restartBuilt.ts` took in b0324bc2); no assertion changed. Same host (arm64, Node 24.19.0), SQLite only, five runs each.

| Run | Command | Result |
|---|---|---|
| `tooling/smoke/restart.mjs`, SQLite | `node --disable-warning=ExperimentalWarning tooling/smoke/restart.mjs` | 5 of 5 `ok` (13 s, 13 s, 12 s, 13 s, 13 s) |
| `tooling/smoke/workflow.mjs`, SQLite | `node --disable-warning=ExperimentalWarning tooling/smoke/workflow.mjs` | 5 of 5 `ok` (18 s, 19 s, 19 s, 18 s, 19 s) |

Both now run in the `built-smokes` job of pull-request CI (0822); its first CI run is pending. The failing runs above stay as recorded.
