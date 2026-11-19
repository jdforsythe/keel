# golden lane: record

Commits: 0286ec8 (api on `storage: 'sqlite'`; `serverSqlite.test`), b358965 (`hideList`/`showList`; `board.prove.test` proves six transactions), ad710a2 + aeecec0 (workflow `api.removal`, steps, jobs, runners, routes, Undo bar), 9e267be (shells declared, `deploy/web/{capacitor,tauri}`, lockfile), b2c3329 (eval: proof twins, E1563 twin, `restartBuilt.ts`, shared-storage sim tests; acceptance 7/7). Suite 136.
Pinned: `@capacitor/{android,ios,cli}` 8.6.2, `@tauri-apps/cli` 2.12.4, `z3-solver` 5.3.3 (dev); the Capacitor and Tauri runtime packages are `dependencies` (`cap sync` finds plugins there).

## Differences from the RFC (confirm or reverse)
- E1563 for optional-made-required carries no fix (the RFC says the fix restores the optional).
- `RemovalData.list` is optional: a chart's `start` cannot hold a branded id. `flow` is `s.string`, not `s.id('Flow')`.
- The failure code is an enum so closed-form `explore` works. Steps are `purge.server.ts`/`restore.server.ts` (`purgeList` is the transaction's name).
- `removalStores.server.ts` sits beside a zero-argument `boardStores` (`findRaces` and the eval use it; importing the workflow from a non-server file is E1004).
- `host: 'api'` and `sessions` kept, which the RFC drops.

## Package bug (being fixed)
`packages/std-workflows/src/internal/stepJob.ts`: `failed` drops its `tx` result; a `failed` schema that refuses the code strands the instance.

## Unverified (no native toolchain), each in `apps/golden-1`
`KEEL_ORIGIN=... pnpm exec keel build --target tauri` (so no `Cargo.lock` committed; refused today with `E1575 cargo is older than Rust 1.95`); `--target capacitor --platform android` and `--platform ios`; the Tauri replay smoke; the CI shell jobs. Not run: the Postgres branch of `restartBuilt` (`KEEL_TEST_POSTGRES_URL`), the ledger rungs (`RUNG_OF` in `pass.ts`), the whole `pnpm eval --task golden-1-api`.

## Friction (backlog candidates)
- E2351 and E2501 apply to test files, so a test cannot declare a twin workflow.
- The board channel misses saves that touch only `api.removal`.
- Tests against a real process need `@vitest-environment node` and a real ctx (E1601 on `fetch`, `setTimeout`).
- `KEEL_DATABASE_URL` must be an absolute file URL.
- `node:22-slim` may be older than 22.13, which `node:sqlite` needs (check the image; pin the Dockerfile's minor).
- The acceptance test's `artifacts()` leaves `golden-1-race-*`/`golden-1-split-*` folders in `$TMPDIR`.
