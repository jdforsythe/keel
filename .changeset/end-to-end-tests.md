---
"@keel/testing": minor
"@keel/cli": minor
"@keel/check": patch
---

End-to-end tests (k.e2e, k.e2e-page): `keel test --e2e [paths] [--engine chromium|firefox|webkit]` builds the project, checks the browser (E1734) and runs `test/**/*.e2e.ts` and `modules/*/test/**/*.e2e.ts` alone, writing `reports/tests/e2e.json`, which `keel test` leaves in place and the ledger reads. `@keel/testing/e2e` exports `serve`, `answer` and `build`: the built deployables on free ports with fresh data and one secret, a page over `playwright-core` (an optional pinned peer) with the harness's verbs by id, waits without sleeps (E1735), a held page's claim check (E1720), browser problems a test must read (E1738), and on failure a T0001 with `server:` records, a screenshot and a trace under `reports/e2e/`. A harness call in an e2e run, or `@keel/testing/e2e` outside one, is E1736; a deployable that does not start is E1737. A diagnostic may carry `detail` lines below its head. E1734 to E1738 are explained by `keel explain`.
