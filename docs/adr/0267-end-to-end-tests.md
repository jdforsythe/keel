# ADR-0267: End-to-end tests are a built-in: `keel test --e2e` over the built app (RFC 0244)

**Status:** accepted (orchestrator, 2026-11-26).

**Context.** `@keel/testing` covers the page, property, exploration, proof and simulation rungs in a sim ctx with happy-dom. Nothing an app can use runs the built bundle in a real browser against the real server: the repo does that with internal scripts (`tooling/smoke/*.mjs`), and an app developer brings Playwright by hand. Decision D187 (b) of task 0963 makes end-to-end tests a built-in and moves the smokes onto it.

**Decision.**
- A file `*.e2e.ts` under `test/` or `modules/*/test/` is an end-to-end test. `keel test --e2e [paths] [--engine chromium|firefox|webkit]` builds the project, checks the browser, then runs those files alone under vitest (node, forks, two files at once). `keel test` runs none of them.
- `@keel/testing/e2e` exports `serve`, `answer` and `build`. `serve` starts every deployable of the topology on free ports, with fresh data, one random `KEEL_SECRET` and peers wired, and hosts static and unserved client deployables as a static host does. A page from `open` takes the harness's verbs (`fire`, `find`, `settle`, `a11y`, `navigate`, `location`, `documents`, `requests`), plus what only a real browser has: `until`, `findAll`, `press`, `reload`, `back`, `cookies`, `offline`, `scroll`, `viewport`, `layout`, `style`, held scripts with `resume`, and `problems`. Ids are the only selectors.
- `playwright-core` is an optional peer dependency pinned to one version, as `z3-solver` is. If it is missing, or the engine's browser is missing, the result is E1734, never a skip.
- A built app runs on a real ctx. The test controls the browser's network, each deployable's life, the answers of mapped origins and the time a held page's scripts run. The sim clock, the seed, net schedules, storage faults and `simulate` do not reach a built app, and the spec says so.
- No verb sleeps. A page is quiet when nothing it sent is unanswered (event streams aside), the DOM has not changed for a frame and no navigation is under way. Every wait is bounded at 10 s by default and scaled by `KEEL_TEST_TIME_SCALE`. A `fixed` part is unscaled.
- When a test fails, one T0001 is printed with the code (E1735 for a wait that ran out), then the server's records from the failing verb, then a screenshot and a trace under `reports/e2e/`. A browser problem the test did not read with `problems()` is E1738.
- Ledger: e2e files are test files the ledger reads. A passing e2e test gives `example` evidence to what it references. There is no new rung or item kind. The run report is `reports/tests/e2e.json`, beside `run.json`, and neither run removes the other's.
- A library's folder serves one component as a page with `serve({ page: 'src/Card.ts', props })`. The tool writes a one-route host project under `.keel/e2e-host/` that resolves the library's own `node_modules`, and `keel scaffold library` adds `@keel/compiler`, `@keel/router`, `@keel/server`, `@keel/testing` and `playwright-core` to `devDependencies`.
- A migration loses no assertion. To carry what the smokes checked, the page gains `title()`, padding and the `body` (no id) in `style`, `warning` problems and the island check in `resume()`; `Served` gains `log(store)` (ids and names, no payload), `open`'s write-only `cookies`, and `stop`'s `drain`.
- `apps/inspector` reads the inspect document on its server, for loopback targets only. A cross-origin call from the browser to an origin computed at run time is what Keel's policy refuses, and the old smoke passed only because its file server sent no policy.
- E1734 a missing browser, E1735 a wait that ran out, E1736 a misplaced call, E1737 a deployable that did not start, E1738 an unread browser problem.

**Alternatives.**
- Document Playwright and stop there. That is a harness each developer builds, with CSS selectors, sleeps, no server lifecycle and no ledger tie.
- `@playwright/test` as the runner. That is a second runner beside vitest, with a second report and a second set of timeouts.
- A sim clock in the browser (Playwright's fake timers). It moves the page's clock and not the server's, so they disagree. That is half a control, presented as a whole one.
- A new rung or an `e2e:` item kind. One passing run is `example` strength, so a new rung would rank it above what it shows. An item kind is left for when it is needed (RFC 0244, For the operator).

**Consequences.** `@keel/testing` gains the `./e2e` entry and an optional peer. `@keel/cli` gains `--e2e` and `--engine`. The smokes become `*.e2e.ts` files in the apps and examples they test, and the shell smokes stay as tooling until a shell driver exists. k.e2e and k.e2e-page are `proposed`. k.test-run and k.ledger-items each gain one clause, and k.cli one table cell.
