# keel review findings

`keel review --all --format=json` over the monorepo root and over each app and example, on the tree at the `lane-r178` merge. Findings at `fail` and `warn` only; the `list` findings (R1010 in `examples/third-party-origin`, R1012 and R1014 in `apps/golden-2`) carry their reasons and need no call. No `keel-review.json` exists, so nothing is `accepted`. The orchestrator decides each line.

## Counts

| Run | fail | warn | list |
| --- | --- | --- | --- |
| repo root | 5 | 11 | 3 |
| apps/golden-1 | 4 | 5 | 0 |
| apps/golden-2 | 4 | 6 | 2 |
| apps/inspector | 3 | 0 | 0 |
| apps/sessions | 3 | 0 | 0 |
| apps/household | 3 | 0 | 0 |
| examples/host-component | 3 | 0 | 0 |
| examples/openapi-import | 3 | 0 | 0 |
| examples/static-client | 3 | 0 | 0 |
| examples/third-party-origin | 3 | 0 | 1 |

An app's run inside the monorepo reads the workspace root's `package.json` and `pnpm-workspace.yaml`, so the three root findings appear in every run. Apart from those, inspector, sessions, household and the four examples have no findings.

## Findings

| Code | Danger | Path | What it is | Recommendation |
| --- | --- | --- | --- | --- |
| R1101 | critical | pnpm-workspace.yaml:13 | `overrides` pins `@stryker-mutator/core>minimatch` to `^11.0.1` | Accept: it lifts a transitive dependency past a published advisory; the mutation tool is a dev dependency only. |
| R1101 | critical | pnpm-workspace.yaml:14 | `overrides` pins `typed-rest-client>qs` to `^6.16.1` | Accept: it lifts a transitive dependency past a published advisory; dev tooling only. |
| R1102 | critical | package.json:30 | the root `prepare` script runs `git config core.hooksPath .githooks` | Accept: it points git at the repo's own hooks and runs nothing from a dependency. |
| R1057 | critical | apps/golden-1/test/serverSqlite.test.ts:2 | `node:child_process` runs `keel build` and the built `server.mjs` | Accept: the test proves the built node deployable against SQLite end to end; `@keel/testing` has no seam that builds and starts a deployable. |
| R1057 | high | apps/golden-1/test/serverSqlite.test.ts:3 | `node:fs/promises` copies the app to a temporary directory | Accept with the line above. |
| R1057 | high | apps/golden-1/test/serverSqlite.test.ts:4 | `node:net` finds a free port | Accept with the line above. |
| R1057 | high | apps/golden-1/test/serverSqlite.test.ts:40 | `process.env` passed to the server child with its `DeployEnv` keys | Accept with the line above. |
| R1057 | high | apps/golden-1/test/serverSqlite.test.ts:83 | `process.env` passed to the `keel build` child | Accept with the line above. |
| R1057 | high | apps/golden-1/test/host.test.ts:4 | `node:fs` writes a fake build output (`.vite`, `assets`) to a temporary directory | Accept: the host test needs a build directory on disk; no testing seam makes one. |
| R1057 | critical | apps/golden-2/test/brands.test.ts:2 | `node:child_process` runs `keel` over a copy of the app | Accept: the test proves the brand output of the command itself; no testing seam runs the CLI. |
| R1057 | high | apps/golden-2/test/brands.test.ts:3 | `node:fs` makes and removes the copy | Accept with the line above. |
| R1057 | high | apps/golden-2/test/brands.test.ts:52 | `process.env` passed to the `keel` child | Accept with the line above. |
| R1057 | high | apps/golden-2/test/artifacts.ts:1 | `node:fs` reads the compiler's `.keel/a11y.json` | Accept for now: no `@keel/testing` export reads the compiler's a11y artifact; if one is added, use it. |
| R1057 | high | apps/golden-2/identity.server.ts:16 | `process.env` read for the sign-in library's settings (`BETTER_AUTH_SECRET`, `AUTH_DATABASE_PATH`, `AUTH_FIXTURE`, `KEEL_ORIGIN`) | Needs a person: these are the auth library's own keys, not `DeployEnv` ones, and no Keel seam gives app code its own environment keys (`DeployEnv` is internal to `@keel/server`). Accept with that reason, or add an app-facing environment seam by RFC and move both reads to it. |
| R1057 | high | apps/golden-2/modules/accounts/authOf.server.ts:37 | `process.env` read for the same settings | Same call as `identity.server.ts:16`. |
| R1057 | high | apps/golden-2/modules/accounts/authOf.server.ts:1 | `node:fs` `mkdirSync` makes the directory for the auth library's SQLite file | Accept: the library opens a file path; Keel's storage seam does not own the library's database. |

## Findings against the rules

- R1057's remedy names `DeployEnv` and `ctx` (`keel-escapes` skill, R1057 row), but app code cannot reach `DeployEnv`: `@keel/server` does not export it and no section gives an app its own keys. For a third-party library's keys the remedy points at a seam that does not exist; either the skill row says so or an RFC adds the seam.
- R1057 rates `node:child_process` in a test file `critical`, the same as in a server file. A test that builds and starts the app it tests has no seam to use instead; consider `high` in test files, or a testing seam for a built deployable.
- In an app inside a workspace, the run reports the workspace root's `package.json` and `pnpm-workspace.yaml` with root-relative paths, so each app's run carries the same three `fail` findings. Not wrong, but an app author reading their own app's run sees findings outside the app.
- No false positive in `apps/household` or in the code this branch gained since the lane's last merge (the scaffold, std-channels, `@keel/testing` and the static build): household's run has only the three root findings.
