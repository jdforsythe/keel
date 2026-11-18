# Test coverage snapshot

Measured on 2026-11-17 at commit 99569e2a, with a builder editing `packages/std-offline`, `packages/store` and `packages/check` at the same time. Counts for those three packages may shift by a few. This file is a snapshot: regenerate it, do not edit it by hand.

Sources: `tooling/ledger/ledger.json` (the committed ledger, for tables A and C), the test files under `packages/*/` and `apps/*/` (table B), the mutation reports' dates and the sha256 of each claimed source file (table C). One `pnpm ledger --diff` run supplied the cross-check.

To regenerate: run `pnpm ledger` to refresh `ledger.json`, then a script that groups `clauses` by the part of `item` before `#`, counts `it(`/`test(` and `fc.assert(`/`properties(` per file, and compares each claim's `sha` with the file on disk. The script used here is not in the repo.

## Cross-check with the ledger line

`pnpm ledger --diff` ended: 1456 items, 1194 verified, 18 unsafe, 21 warnings, 1088 example, 327 probabilistic, 15 exhaustive, 55 proven, 4 monitored, 21 stale, 0 lowered, 0 uncovered.

The committed `ledger.json` holds 1444 items (729 clauses, 415 exports, 300 route and WCAG items), 1182 verified (items above `none`), and `rungs` of 1077 example, 324 probabilistic, 15 exhaustive, 55 proven, 4 monitored. The `rungs` counts are items holding any evidence at each rung, so they sum to more than the verified count. The live run is 12 items and 12 verified above the file, with 11 more example and 3 more probabilistic: the working tree has moved since the ledger was written. The stale count matches (21, computed here from the claims' hashes). Unsafe matches (18).

## A. Spec clauses by section

A clause is one conformance sentence of a section. The columns after `none` give the highest rung held. Every clause of every section is verified (none at `none`), so no section has an uncovered clause. `std.outbox` is `proposed` and has no clause list yet.

| section | status | clauses | verified | none | example | probabilistic | exhaustive | proven | monitored |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| k.a11y | conformance-covered | 10 | 10 | 0 | 9 | 1 | 0 | 0 | 0 |
| k.api | conformance-covered | 14 | 14 | 0 | 9 | 0 | 0 | 5 | 0 |
| k.aria | conformance-covered | 10 | 10 | 0 | 7 | 0 | 0 | 3 | 0 |
| k.check | conformance-covered | 13 | 13 | 0 | 13 | 0 | 0 | 0 | 0 |
| k.cli | conformance-covered | 19 | 19 | 0 | 19 | 0 | 0 | 0 | 0 |
| k.compat | conformance-covered | 13 | 13 | 0 | 13 | 0 | 0 | 0 | 0 |
| k.compiler | conformance-covered | 20 | 20 | 0 | 13 | 7 | 0 | 0 | 0 |
| k.component | conformance-covered | 16 | 16 | 0 | 16 | 0 | 0 | 0 | 0 |
| k.ctx | conformance-covered | 18 | 18 | 0 | 13 | 4 | 0 | 1 | 0 |
| k.deploy | conformance-covered | 11 | 11 | 0 | 11 | 0 | 0 | 0 | 0 |
| k.errors | conformance-covered | 13 | 13 | 0 | 9 | 4 | 0 | 0 | 0 |
| k.evidence | conformance-covered | 10 | 10 | 0 | 9 | 1 | 0 | 0 | 0 |
| k.forms | conformance-covered | 16 | 16 | 0 | 13 | 2 | 0 | 1 | 0 |
| k.guards | conformance-covered | 3 | 3 | 0 | 2 | 1 | 0 | 0 | 0 |
| k.head | conformance-covered | 8 | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| k.hosting | implemented | 6 | 6 | 0 | 6 | 0 | 0 | 0 | 0 |
| k.ledger | conformance-covered | 11 | 11 | 0 | 9 | 2 | 0 | 0 | 0 |
| k.model | conformance-covered | 7 | 7 | 0 | 0 | 0 | 6 | 1 | 0 |
| k.module | conformance-covered | 14 | 14 | 0 | 14 | 0 | 0 | 0 | 0 |
| k.openapi | conformance-covered | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| k.persist | conformance-covered | 12 | 12 | 0 | 10 | 2 | 0 | 0 | 0 |
| k.prefix | conformance-covered | 7 | 7 | 0 | 5 | 1 | 0 | 1 | 0 |
| k.privacy | conformance-covered | 8 | 8 | 0 | 3 | 4 | 0 | 1 | 0 |
| k.prove | conformance-covered | 10 | 10 | 0 | 8 | 0 | 0 | 2 | 0 |
| k.reactive | conformance-covered | 20 | 20 | 0 | 11 | 9 | 0 | 0 | 0 |
| k.reveal | conformance-covered | 8 | 8 | 0 | 5 | 3 | 0 | 0 | 0 |
| k.router | conformance-covered | 15 | 15 | 0 | 7 | 5 | 0 | 3 | 0 |
| k.runtime | conformance-covered | 13 | 13 | 0 | 11 | 2 | 0 | 0 | 0 |
| k.scaffold | conformance-covered | 10 | 10 | 0 | 10 | 0 | 0 | 0 | 0 |
| k.schema | conformance-covered | 15 | 15 | 0 | 0 | 12 | 0 | 3 | 0 |
| k.security | conformance-covered | 13 | 13 | 0 | 13 | 0 | 0 | 0 | 0 |
| k.server | conformance-covered | 16 | 16 | 0 | 15 | 1 | 0 | 0 | 0 |
| k.services | conformance-covered | 12 | 12 | 0 | 4 | 8 | 0 | 0 | 0 |
| k.shell | proposed | 6 | 6 | 0 | 6 | 0 | 0 | 0 | 0 |
| k.sim | conformance-covered | 10 | 10 | 0 | 7 | 3 | 0 | 0 | 0 |
| k.store | conformance-covered | 23 | 23 | 0 | 8 | 15 | 0 | 0 | 0 |
| k.sync | conformance-covered | 12 | 12 | 0 | 3 | 9 | 0 | 0 | 0 |
| k.testing | conformance-covered | 13 | 13 | 0 | 12 | 1 | 0 | 0 | 0 |
| k.topology | conformance-covered | 9 | 9 | 0 | 9 | 0 | 0 | 0 | 0 |
| k.ui | conformance-covered | 15 | 15 | 0 | 10 | 2 | 0 | 3 | 0 |
| std.brands | conformance-covered | 6 | 6 | 0 | 6 | 0 | 0 | 0 | 0 |
| std.channels | conformance-covered | 11 | 11 | 0 | 11 | 0 | 0 | 0 | 0 |
| std.conflicts | conformance-covered | 8 | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| std.credentials | conformance-covered | 15 | 15 | 0 | 8 | 7 | 0 | 0 | 0 |
| std.db | proposed | 8 | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| std.geo | conformance-covered | 5 | 5 | 0 | 5 | 0 | 0 | 0 | 0 |
| std.headless | conformance-covered | 7 | 7 | 0 | 6 | 0 | 0 | 1 | 0 |
| std.health | conformance-covered | 7 | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| std.i18n | conformance-covered | 8 | 8 | 0 | 5 | 3 | 0 | 0 | 0 |
| std.jobs | conformance-covered | 11 | 11 | 0 | 11 | 0 | 0 | 0 | 0 |
| std.live | conformance-covered | 10 | 10 | 0 | 10 | 0 | 0 | 0 | 0 |
| std.messages | conformance-covered | 9 | 9 | 0 | 7 | 2 | 0 | 0 | 0 |
| std.money | conformance-covered | 7 | 7 | 0 | 2 | 5 | 0 | 0 | 0 |
| std.monitor | conformance-covered | 7 | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| std.multi | conformance-covered | 7 | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| std.offline | conformance-covered | 15 | 15 | 0 | 15 | 0 | 0 | 0 | 0 |
| std.options | conformance-covered | 7 | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| std.report | conformance-covered | 6 | 6 | 0 | 1 | 5 | 0 | 0 | 0 |
| std.schedules | conformance-covered | 9 | 9 | 0 | 9 | 0 | 0 | 0 | 0 |
| std.sessions | conformance-covered | 13 | 13 | 0 | 10 | 3 | 0 | 0 | 0 |
| std.shells | conformance-covered | 6 | 6 | 0 | 1 | 5 | 0 | 0 | 0 |
| std.statecharts | conformance-covered | 10 | 10 | 0 | 3 | 5 | 0 | 2 | 0 |
| std.tables | conformance-covered | 9 | 9 | 0 | 6 | 3 | 0 | 0 | 0 |
| std.temporal | conformance-covered | 12 | 12 | 0 | 5 | 7 | 0 | 0 | 0 |
| std.text | conformance-covered | 11 | 11 | 0 | 1 | 10 | 0 | 0 | 0 |
| std.timings | conformance-covered | 7 | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| std.tokens | conformance-covered | 10 | 10 | 0 | 1 | 9 | 0 | 0 | 0 |
| std.workflows | conformance-covered | 8 | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| total (68 sections) | | 729 | 729 | 0 | 532 | 163 | 6 | 28 | 0 |

Other ledger items in the committed file: 415 exports (134 probabilistic, 223 example, 27 proven, 1 exhaustive, 30 none; the 30 are spread over inspector, compiler, ctx, scaffold, std-conflicts, std-jobs, std-live, std-offline, std-sessions (10), std-tables, std-temporal, std-text, std-timings, std-workflows) and 300 route and WCAG items (68 example, 232 none).

## B. Tests by package and kind

Static counts from the files, not a run. A case is an `it(` or `test(` occurrence (with `.only`, `.skip`, `.each`) plus `it.fails(` and `test.fails(`. Conformance is a file under `conformance/`, unit a file under `test/`, other a test file elsewhere. A property call is `fc.assert(` or `properties(` (a case can hold more than one). The simulate, explore and prove columns count files that call `simulate(`, `explore(` or `prove(`. Fails is the expected-failure cases, already inside the case counts.

| unit | conformance files | conformance cases | unit files | unit cases | other files | other cases | property calls | simulate files | explore files | prove files | fails | skip/todo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| packages/check | 75 | 434 | 41 | 337 | 0 | 0 | 163 | 0 | 0 | 0 | 0 | 0 |
| packages/cli | 71 | 248 | 79 | 763 | 0 | 0 | 149 | 3 | 3 | 5 | 1 | 5 |
| packages/compiler | 35 | 130 | 53 | 518 | 0 | 0 | 66 | 0 | 0 | 0 | 0 | 0 |
| packages/ctx | 29 | 116 | 12 | 57 | 0 | 0 | 46 | 0 | 0 | 0 | 0 | 0 |
| packages/forms | 17 | 39 | 10 | 105 | 0 | 0 | 34 | 0 | 0 | 0 | 0 | 0 |
| packages/reactive | 15 | 93 | 16 | 78 | 0 | 0 | 30 | 0 | 0 | 0 | 0 | 0 |
| packages/router | 35 | 124 | 28 | 181 | 0 | 0 | 58 | 0 | 0 | 0 | 0 | 0 |
| packages/runtime-dom | 24 | 83 | 31 | 161 | 0 | 0 | 67 | 0 | 0 | 0 | 0 | 0 |
| packages/scaffold | 29 | 119 | 17 | 116 | 0 | 0 | 61 | 0 | 0 | 0 | 0 | 0 |
| packages/schema | 27 | 163 | 18 | 159 | 0 | 0 | 128 | 0 | 0 | 0 | 0 | 0 |
| packages/server | 78 | 327 | 87 | 460 | 0 | 0 | 190 | 0 | 0 | 0 | 0 | 0 |
| packages/services | 20 | 63 | 12 | 43 | 0 | 0 | 45 | 0 | 0 | 0 | 0 | 0 |
| packages/std-brands | 1 | 7 | 1 | 2 | 0 | 0 | 6 | 0 | 0 | 0 | 0 | 0 |
| packages/std-capacitor | 6 | 17 | 3 | 9 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 |
| packages/std-channels | 11 | 24 | 12 | 29 | 0 | 0 | 22 | 0 | 0 | 0 | 0 | 0 |
| packages/std-conflicts | 8 | 23 | 6 | 24 | 0 | 0 | 17 | 0 | 0 | 0 | 0 | 0 |
| packages/std-credentials | 14 | 78 | 12 | 43 | 0 | 0 | 49 | 0 | 0 | 0 | 0 | 0 |
| packages/std-db | 8 | 19 | 2 | 3 | 0 | 0 | 14 | 0 | 0 | 0 | 0 | 0 |
| packages/std-geo | 1 | 5 | 1 | 1 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| packages/std-headless | 15 | 75 | 9 | 23 | 0 | 0 | 19 | 0 | 1 | 0 | 0 | 0 |
| packages/std-health | 5 | 7 | 1 | 1 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| packages/std-i18n | 8 | 9 | 2 | 9 | 0 | 0 | 7 | 0 | 0 | 0 | 0 | 1 |
| packages/std-jobs | 13 | 35 | 8 | 14 | 0 | 0 | 26 | 0 | 0 | 0 | 0 | 0 |
| packages/std-live | 10 | 12 | 4 | 10 | 0 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| packages/std-messages | 9 | 14 | 3 | 12 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| packages/std-money | 6 | 7 | 3 | 9 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 0 |
| packages/std-offline | 17 | 42 | 11 | 38 | 0 | 0 | 29 | 0 | 0 | 0 | 0 | 0 |
| packages/std-report | 3 | 6 | 1 | 1 | 0 | 0 | 6 | 0 | 0 | 0 | 0 | 0 |
| packages/std-schedules | 10 | 29 | 6 | 14 | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |
| packages/std-sessions | 31 | 100 | 45 | 201 | 0 | 0 | 59 | 0 | 0 | 0 | 0 | 0 |
| packages/std-statecharts | 10 | 31 | 5 | 9 | 0 | 0 | 25 | 0 | 2 | 0 | 0 | 0 |
| packages/std-tables | 9 | 18 | 10 | 28 | 0 | 0 | 21 | 0 | 0 | 0 | 1 | 0 |
| packages/std-tauri | 6 | 18 | 3 | 8 | 0 | 0 | 21 | 0 | 0 | 0 | 0 | 0 |
| packages/std-temporal | 12 | 16 | 3 | 16 | 0 | 0 | 18 | 0 | 0 | 0 | 0 | 0 |
| packages/std-text | 11 | 43 | 5 | 20 | 0 | 0 | 28 | 0 | 0 | 0 | 0 | 0 |
| packages/std-timings | 8 | 13 | 2 | 9 | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 0 |
| packages/std-workflows | 10 | 27 | 6 | 21 | 0 | 0 | 24 | 0 | 0 | 0 | 0 | 0 |
| packages/store | 37 | 134 | 20 | 139 | 0 | 0 | 101 | 0 | 0 | 0 | 0 | 0 |
| packages/testing | 78 | 352 | 37 | 249 | 0 | 0 | 159 | 4 | 11 | 22 | 0 | 0 |
| packages/ui | 26 | 106 | 18 | 75 | 0 | 0 | 42 | 0 | 0 | 0 | 0 | 0 |
| apps/golden-1 | 0 | 0 | 24 | 166 | 0 | 0 | 14 | 2 | 3 | 1 | 1 | 0 |
| apps/golden-2 | 0 | 0 | 9 | 101 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 |
| apps/inspector | 0 | 0 | 2 | 17 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| apps/sessions | 0 | 0 | 5 | 12 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| total | 838 | 3206 | 683 | 4291 | 2 | 2 | 1847 | 9 | 20 | 28 | 3 | 6 |

## C. Mutation by package

Score and threshold come from `ledger.json` `mutation.packages`. The date is the modification date of the package's `reports/mutation/mutation.json`. Claims are per mutated file; a claim is stale when the file's sha256 differs from the claim's. Total stale: 21. Exclusions are the extra mutation-only ones in `stryker.config.mjs` beyond the shared `!src/index.ts` and `!src/types/**`. The 28 packages not listed (every `std-*` package) have no mutation run.

| package | score | threshold | report date | claims | stale | mutation-only exclusions |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| check | 74.52 | 70 | 2026-11-17 | 134 | 0 | src/internal/EXPLANATIONS.ts |
| cli | 79.59 | 70 | 2026-11-17 | 146 | 2 | none |
| compiler | 79.26 | 70 | 2026-11-17 | 108 | 3 | none |
| ctx | 78.34 | 70 | 2026-11-16 | 30 | 2 | none |
| forms | 89.44 | 70 | 2026-11-16 | 28 | 0 | none |
| reactive | 86.22 | 80 | 2026-11-17 | 23 | 0 | none |
| router | 85.47 | 80 | 2026-11-17 | 63 | 3 | none |
| runtime-dom | 77.38 | 70 | 2026-11-17 | 69 | 0 | none |
| scaffold | 79 | 70 | 2026-11-16 | 114 | 0 | none |
| schema | 90.91 | 80 | 2026-11-17 | 40 | 1 | none |
| server | 81.63 | 70 | 2026-11-17 | 115 | 8 | none |
| services | 83.82 | 70 | 2026-11-17 | 35 | 0 | none |
| store | 91.13 | 80 | 2026-11-17 | 27 | 2 | none |
| testing | 86.64 | 70 | 2026-11-17 | 72 | 0 | none |
| ui | 74.31 | 70 | 2026-11-16 | 42 | 0 | none |

Mutation runs also leave tests out, in `vitest.mutate.config.ts`: `check` skips three conformance files and one E1501 test; `cli` skips 13 conformance files that spawn `keel` or reach outside the sandbox; `compiler` skips only `node_modules`.

## Line and branch coverage

The repo does not measure line or branch coverage: no vitest config sets `coverage`, no package has a coverage script, and there is no coverage report directory.

## What this does not show

- Static counts are not runs. A case may be skipped or failing; six are `skip` or `todo`.
- A rung of `example` means a passing test references the item, which can be one case. It is not a proof and not a bound on inputs.
- A verified clause means a conformance test cites it, not that the test is strong. Mutation scores are the check on that, and only 15 kernel packages have one.
- Stale claims (21) are left out of a package's score, so the score describes the unchanged files only.
- `probabilistic` needs a seeded property of at least 100 runs, `exhaustive` a bounded `explore`, `proven` a type-level test, a closed `explore` or a `prove`. `monitored` is production only: 4 items.
- Property calls are counted per call, not per generated run.
- The ledger line and the file differ by the working tree's drift until `pnpm ledger` is run again.
