# Feature coverage by apps

Which Keel features a real app exercises, which only package tests cover, and the walkthrough app's layers that close the holes. Read from `apps/*` (imports, topology, routes, tests), `tooling/smoke/*.mjs` and `.github/workflows/ci.yml`.

Marks: `x` used by the app's code; `t` used only by the app's tests; `p` pending in `lane-w14g2` (golden-2's data on `@keel/std-postgres`); `-` not used. "Smoke" is a script that drives a built or `keel dev` app end to end: `ci` runs in CI, `man` is a manual script. "Pkg" is covered by package tests and conformance only.

Apps: G1 golden-1 (todo board: `web` client + `api` node on SQLite), G2 golden-2 (recipes: `web` client + `api` node), Ins inspector (`web` client only), Ses sessions (one `node` deployable).

## Smokes

| script | app | drives |
|-|-|-|
| `restart.mjs` (ci) | G1 built `api`, SQLite | writes, SIGKILL, restart, board row byte-equal |
| `workflow.mjs` (ci) | G1 built `api` | removal workflow resumes after a kill inside a step |
| `workflow-postgres.mjs` (ci) | G1 built `api` on Postgres 17 | the same workflow with its store and jobs on Postgres; the step's effect once |
| `csp.mjs` (ci) | G1 built `api` and `examples/third-party-origin` | `csp.txt` equals the host's document policy; declared origins present, others absent |
| `resume.mjs` (ci) | G2 built `web` and `api`, peers | five pages resume in Chromium; forms; identity mount sign-up and sign-in; the built household's setup page resumes into its runs channel with a form |
| `dev-signin.mjs` (ci) | G2 `keel dev` | sign-in over HTTP, server stubs for the browser |
| `shell.mjs`, `shell-drive.mjs`, `shell-launch.mjs` (ci) | G1 Tauri (Linux, macOS), Capacitor iOS | recorded session replayed in the shell; offline outbox drains after SIGKILL; cookie survives relaunch |
| Android build, `docker build` per node deployable (ci) | G1 | the build runs; nothing is driven |
| `persist.mjs`, `monitor.mjs`, `inspector.mjs`, `interact.mjs`, `todo-flow.mjs`, `smoke.mjs` (man) | G1, Ins | list create, reload, toggle, undo; production tallies; the inspector over a dev server |

## Matrix

| feature | G1 | G2 | Ins | Ses | smoke | pkg only | evidence |
|-|-|-|-|-|-|-|-|
| **Kernel** | | | | | | | |
| k.schema | x | x | x | x | ci | | `apps/*/modules/**/*.schema.ts` |
| k.formats (id brands) | x | x | x | - | | | `apps/golden-1/modules/api/Todo.schema.ts` |
| k.reactive | x | x | - | x | | | `apps/golden-1/modules/todos/view.ts` |
| k.store | x | x | t | - | ci | | `apps/golden-1/modules/api/boardStores.ts` |
| k.component | x | x | x | x | ci | | `apps/golden-2/modules/recipes/RecipeList.tsx` |
| k.compiler | x | x | x | x | ci | | `apps/*/vite.config.ts` |
| k.boundary (server stubs) | x | x | x | - | ci | | `tooling/smoke/dev-signin.mjs` |
| k.bundle (workers) | - | - | - | - | | x | no `Worker` in any app |
| k.runtime (islands) | x | x | x | - | ci | | `tooling/smoke/resume.mjs` |
| k.resume | - | x | - | - | ci | | `tooling/smoke/resume.mjs`; G1 is a client build |
| k.claim | - | x | - | - | ci | | `tooling/smoke/resume.mjs` (scripts held, input kept) |
| k.defaults (queued) | t | - | - | - | | | `apps/golden-1/test/outbox.sim.test.ts` |
| k.place | x | x | - | - | | | `apps/golden-1/modules/todos/Suggestions.tsx` |
| k.router | x | x | x | x | ci | | `apps/*/modules/*/routes.ts` |
| k.contract | x | x | x | x | | | `apps/*/modules/*/*.contract.ts` |
| k.routes (table) | x | x | x | x | | | `apps/golden-2/test/routes.test.ts` |
| k.guards | x | x | - | x | | | `apps/golden-1/modules/todos/editable.guard.ts`, `apps/golden-2/modules/recipes/cook.guard.ts`; a redirecting guard in a shell: `examples/shell-mount` |
| k.prefix | - | t | - | - | | | `apps/golden-2/test/routes.test.ts` |
| k.forms | x | x | - | - | ci | | `apps/golden-2/modules/recipes/NewRecipePage.tsx` |
| k.ui (tokens, styling) | x | x | x | x | | | `apps/*/tokens.ts` |
| k.ctx | x | x | - | x | | | `apps/golden-1/modules/api/removal.server.ts` |
| k.owner | x | x | - | - | | | loaders and runners |
| k.errors | x | x | x | - | | | `apps/golden-1/modules/api/WriteRefusal.schema.ts` |
| k.check | x | x | x | x | ci | | `pnpm check` runs on every app |
| k.explain | - | - | - | - | | x | |
| k.host (host reads) | - | - | - | - | | x | |
| k.cli: `keel dev` | x | x | x | - | ci | | `tooling/smoke/dev-signin.mjs`, `inspector.mjs` |
| k.cli: `keel build` | x | x | x | x | ci | | `restart.mjs`, `resume.mjs` |
| k.cli: `keel check`, `keel test` | x | x | x | x | ci | | CI `check` and a11y report steps |
| k.cli: `keel docs` | - | - | - | - | | x | |
| k.cli: `keel evidence` | - | - | - | - | | x | `pnpm evidence:report --check` reads the ledger, not an app bundle |
| k.cli: `keel codemod` | - | - | - | - | ci | | `examples/codemod-place`: the smoke runs `keel codemod place stock --to api --adapter node` on a copy, checks, tests, builds and serves the result as peers, then places it back byte for byte |
| k.cli: MCP, LSP | - | - | - | - | | x | |
| k.docs | - | - | - | - | | x | |
| k.scaffold | - | - | - | - | | x | |
| k.testing: render, fire, settle | x | x | x | x | | | `apps/*/test` |
| k.testing: a11y | x | x | x | - | ci | | `apps/*/reports/a11y.json` |
| k.model (explore) | x | - | - | - | | | `apps/golden-1/test/board.explore.test.ts` |
| k.prove | x | - | - | - | | | `apps/golden-1/test/board.prove.test.ts` |
| k.sim (faults) | x | - | - | - | | | `apps/golden-1/test/outbox.sim.test.ts` |
| k.ledger | x | x | x | x | ci | | `pnpm ledger --diff` |
| k.server | x | x | - | x | ci | | `apps/golden-1/modules/api/loadBoard.server.ts` |
| k.leave | x | x | - | - | | | loaders return data only |
| k.user (caller) | x | x | - | - | ci | | `apps/golden-2/modules/accounts/loadMe.server.ts` |
| k.mount (mount pages) | - | x | - | - | ci | | `apps/golden-2/identity.server.ts`, `dev-signin.mjs` |
| k.mount-scope | - | - | - | - | | x | |
| k.return (shell mount) | - | - | - | - | ci | | `examples/shell-mount/test/shellGuard.test.ts` (redirect with `next`, mount post); the return after sign-in is untestable in process (`tasks/p1/scenario3-findings.md` S3-1) |
| k.opening | t | - | - | - | | | `apps/golden-1/test/editor.test.ts` |
| k.links (links in) | - | - | - | - | ci | | `examples/links-in/test/linksIn.test.ts` (a link at launch and while running lands on the page; other schemes and paths ignored); the smoke checks the Tauri scheme, that the shell build carries the deep-link listener without `identity.ts`, and opens the page path on a plain client host |
| k.serverlog | t | - | - | - | | | `apps/golden-1/test/realtime.test.ts` |
| k.sync (concurrent writes) | x | - | - | - | ci | | `apps/golden-1/modules/api/postEdit.server.ts` (409 `keel.conflict`) |
| k.persist: SQLite | x | - | - | - | ci | | `apps/golden-1/topology.ts`, `restart.mjs` |
| k.persist: Postgres | - | p | - | - | ci | | `tooling/smoke/workflow-postgres.mjs`; `evals/tasks/golden-1-api/restartProof.ts` runs G1 on Postgres in CI |
| k.data (app data seam) | - | p | - | - | | x | `lane-w14g2` |
| k.topology: client + node | x | x | x | x | ci | | `apps/*/topology.ts` |
| k.topology: peers | - | x | - | - | ci | | `resume.mjs` (web and api name each other) |
| k.topology: `servedBy` | x | x | - | - | ci | | `apps/golden-1/test/host.test.ts` |
| k.deploy (entry, deploy files) | x | x | - | x | ci | | `apps/golden-1/deploy`, docker build |
| k.shell: Tauri | x | - | - | - | ci | | `apps/golden-1/topology.ts`, `shell.mjs` |
| k.shell: Capacitor iOS | x | - | - | - | ci | | `shell-drive.mjs --shell ios` |
| k.shell: Capacitor Android | x | - | - | - | ci (build) | | nothing is driven |
| k.compat | - | - | - | - | | x | |
| k.api (API routes) | x | x | - | x | ci | | `apps/golden-1/modules/api/routes.ts` |
| k.hosting | x | x | - | - | ci | | `apps/golden-1/test/host.test.ts` |
| k.head | - | x | - | - | ci | | `apps/golden-2/modules/recipes/routes.ts` (`title`) |
| k.services (clients) | x | - | x | - | | | `apps/golden-1/modules/todos/todosApi.ts` |
| k.openapi (import) | - | - | - | - | | x | |
| k.module (manifest) | x | x | x | x | | | `apps/*/modules/*/module.ts` |
| k.a11y | x | x | x | - | ci | | `reports/a11y.json` |
| k.aria, k.roles (widget parts) | x | x | - | - | | | `apps/golden-1/test/removalParts.test.ts` |
| k.host-element, k.host-code (custom components) | - | - | - | - | | x | no app owns a `Host` element |
| k.security (headers, CSP) | x | x | x | x | ci | | `tooling/smoke/csp.mjs` reads the built policies |
| k.origins (third-party origins) | - | - | - | - | ci | | `examples/third-party-origin`, `examples/client-only-api` (`connect` on a `client`), `tooling/smoke/csp.mjs` |
| k.privacy (`pii`, `secret`) | - | x | - | - | | | `apps/golden-2/modules/accounts/Credentials.schema.ts` |
| k.reveal | - | x | - | - | | | `apps/golden-2/modules/accounts/postToken.server.ts` |
| k.privacy-reads | - | - | - | - | | x | |
| k.evidence | - | - | - | - | | x | |
| k.parity | - | - | - | - | | x | proposed section |
| **Stdlib** | | | | | | | |
| std.sessions: record, replay, to-test | x | x | - | x | ci | | `apps/sessions/test`, `shellSession.ts`, `shell.mjs`; a signed-in user: `apps/golden-2/test/signedInSession.test.ts` |
| std.sessions: GitHub Action | - | - | - | - | | x | |
| std.i18n | - | x | - | - | | | `apps/golden-2/modules/accounts/AccountsLocale.schema.ts` |
| std.money | - | x | - | - | | | `apps/golden-2/modules/recipes/currencyOptions.ts` |
| std.temporal | - | x | - | - | | | `apps/golden-2/modules/recipes/module.ts` |
| std.text | - | x | - | - | | | `apps/golden-2/modules/recipes/ShoppingList.schema.ts` |
| std.messages, std.copy | - | x | - | - | | | `apps/golden-2/modules/recipes/RecipesText.schema.ts` |
| std.brands | - | x | - | - | | | `apps/golden-2/test/brands.test.ts` |
| std.geo | - | x | - | - | | | `apps/golden-2/modules/recipes/NearestMarket.tsx` |
| std.health | - | x | - | - | | | `apps/golden-2/test/health.test.ts` |
| std.timings | - | x | - | - | | | `apps/golden-2/test/timings.test.ts` |
| std.report | - | x | - | - | | | `apps/golden-2/test/report.test.ts` |
| std.jobs | x | - | - | - | ci | | `apps/golden-1/modules/api/jobs.server.ts`, `workflow.mjs` |
| std.schedules | x | - | - | - | | | `apps/golden-1/modules/digest/schedules.server.ts` (tests only) |
| std.channels | x | - | - | - | man | | `apps/golden-1/modules/api/boardEvents.server.ts` |
| std.live | x | - | - | - | man | | `apps/golden-1/modules/todos/AppShell.tsx` |
| std.offline (outbox) | x | - | - | - | ci | | `OutboxPanel.tsx`, `shell.mjs --session outbox` |
| std.contracts | - | - | - | - | | x | proposed section |
| std.outbox, std.outbox-owner | t | - | - | - | | | `apps/golden-1/test/outbox.sim.test.ts` |
| std.conflicts (races report) | - | - | - | - | | x | dependency only; no import |
| std.multi | t | - | - | - | | | `shellSession.ts` records a one-user group |
| std.statecharts | x | - | - | - | | | `apps/golden-1/modules/api/removalChart.ts` |
| std.monitor | x | t | - | - | man | | `monitor.mjs`; `sessions.tally` behind the reader guard: `apps/golden-2/test/sessionsReader.test.ts` |
| std.headless: Dialog, Disclosure, Toaster | - | x | - | - | ci | | `apps/golden-2/modules/recipes/toasts.ts` |
| std.options: Listbox, Combobox, Menu, Tabs | - | x | - | - | | | `apps/golden-2/modules/recipes/CatalogPage.tsx` |
| std.lists | - | - | - | - | | x | |
| std.tables | - | x | - | - | | | `apps/golden-2/test/catalogColumns.test.ts` |
| std.db (SQLite) | x | - | - | - | ci | | `restart.mjs` |
| std.db (Postgres) | - | p | - | - | | x | CI Postgres jobs run package tests |
| std.postgres | - | p | - | - | | x | `lane-w14g2` |
| std.workflows | x | - | - | - | ci | | `workflow.mjs`, `workflow-postgres.mjs` |
| std.shells | x | - | - | - | ci | | Tauri and iOS smokes |
| std.capacitor | x | - | - | - | ci | | iOS drive, Android build |
| std.tauri | x | - | - | - | ci | | Tauri drive |
| std.tokens | - | x | - | - | | | `apps/golden-2/test/tokens.test.ts` (bearer tokens) |
| **Deploy shapes** | | | | | | | |
| static client hosting (CDN, no server) | - | - | x | - | | | `apps/inspector` is `adapter: "client"` with no host; nothing serves it in a smoke except `vite preview` |
| front end with no server, calling another organisation's API | - | - | - | - | ci | | `examples/client-only-api`: one `client` deployable, no `node`, no `identity.ts`; `origins.connect` and `service({ base })` to GitHub's API; the smoke serves `dist/web` as plain files with `csp.txt`, maps `api.github.com` to a local stand-in, and records no `/__keel/*` request on load, navigation or reload (preflight from `x-keel`: `tasks/p1/examples-findings.md` 10) |
| node deployable | x | x | - | x | ci | | `restart.mjs`, `resume.mjs` |
| compose | x | x | - | - | | | `apps/*/deploy/compose.yaml`; CI builds only G1's Dockerfiles |
| Tauri shell | x | - | - | - | ci | | |
| Capacitor iOS shell | x | - | - | - | ci | | |
| Capacitor Android shell | x | - | - | - | ci (build) | | |
| two nodes as peers (`KEEL_PEER_<NAME>`) | - | x | - | - | ci | | `resume.mjs`; `examples/compose-peers` (a `service({ contract })` call to the peer with the user carried in `x-keel-user`; a forged header is 403) |

## Counts

120 rows. 87 are used by an app's code, 6 only by an app's tests, 4 are pending in `lane-w14g2`, 23 are used by no app. Built-app smokes drive about 40 of the 87; the rest are covered by app tests, which run under simulation and not in a built server.

## Findings

### a. Features no app uses, by how much an app author leans on them

1. Postgres app data (`std.postgres`, `k.data`, `std.db` on Postgres): pending in `lane-w14g2`; until it merges, no app stores data in Postgres.
2. Third-party origins (`k.origins`) and the CSP they widen: only `examples/third-party-origin` and the `csp.mjs` copy of golden-1 declare one.
3. Custom components (`k.host-element`, `k.host-code`): charts and editors are the usual reason to leave the building blocks.
4. OpenAPI import (`k.openapi`): the way an app reaches an existing service; `k.services` is used only against the app's own routes.
5. Shell mounts (`k.return`, `k.mount-scope`): `examples/shell-mount` shows the guard redirect and the mount post; the sign-in round trip is not driven in a shell (S3-1).
6. Links in (`k.links`) and `keel codemod`: deep links into an installed app; moving code between deployables.
7. `keel docs`, `keel evidence` over an app, MCP and LSP: an app author meets them on day one; only package tests drive them.
8. Static client hosting with no server behind it (`apps/inspector` has no host in a smoke).
9. `std.conflicts` (the races report), `std.multi` beyond one user, `std.lists`.
10. `k.privacy-reads`, `k.explain`, `k.host`, `k.compat`, `k.mount-scope`.

### b. Used by one app only, in a trivial way

- `k.guards`: each guard is one predicate (`editable.guard.ts`, `cook.guard.ts`); no guard redirects, none depends on a session, none runs on a node deployable's API route.
- `k.privacy`: `pii` on four account schemas and one `reveal` in G2; no `s.secret` in app code, no `clientPii`, no loader returning personal data.
- `std.tokens`: bearer tokens for one route; no rotation, no expiry path in a built app.
- `std.schedules`: one digest schedule; no built smoke waits for a fire or a catch-up.
- `std.channels` and `std.live`: one board channel; the live path has a manual smoke (`monitor.mjs`) and no CI step.
- `k.prefix`, `k.head`: G2 only (one test; `title` on three routes).
- `k.services`: a typed client for the app's own API; Ins reads one JSON route.
- `std.statecharts`: two charts, both in G1.
- `std.i18n` and `std.messages`: G2's locale switch is client-side; no built smoke switches locale.

### c. Combinations nothing exercises together

1. Offline writes, conflicts and live updates: G1 queues writes (`outbox.sim.test.ts`) and answers 409 `keel.conflict`, and the board channel pushes, but no test or smoke queues a write that conflicts while a push arrives for the same row.
2. Workflows with jobs on Postgres: `workflow-postgres.mjs` covers the kill and restart; no schedule fires into one.
3. `pii` with tokens and the privacy rules: the `reveal` of a minted token in G2 is checked in tests; no built smoke asserts that a `pii` field never reaches a log, the session recording or the evidence bundle.
4. A guard redirect into a shell: `examples/shell-mount` under `renderRoute` with `shell`; no Tauri or Capacitor run drives it.
5. Sessions recorded from a user who signs in: G2 places `sessions` and records a signed-in page under sim; no built smoke records one.
6. Identity with the outbox: a queued write whose owner differs from the caller (`std.outbox-owner`) is checked in package tests, never after a sign-out in a shell.
7. Resume with live updates and forms: covered. `resume.mjs` loads the built household's setup page (a `node` web deployable; the page holds a form and the weekly staples panel, a `live` island with a status line) with the name typed before resume: the island resumes in place and says Live, a run a second client starts shows with the typed name, caret and focus kept, the form saves that name, and the page says Connecting through a server kill, Offline through an offline window, and Live with the run it missed after each.
8. Schedules with workflows with Postgres, `servedBy` with peers and a shell, i18n with money in a form: each pair has no test.

## Where each proof lives

Every uncovered feature and combination goes to exactly one of three vehicles. Sizes: S under a day, M one to three days, L more.

- The walkthrough app holds what a real app naturally has, in layers a reader follows.
- A scenario test drives a hard combination or a fault deterministically, with no app UI.
- A minimal example is a tiny app for one standalone feature, run in CI so it cannot rot.

### 1. The walkthrough app

One app, one lane, built in order; each layer is a tagged commit range with its own tests (`tasks/p1/PLAN.md` W7). The subject is a shared shopping and receipts ledger for a household: it needs money, users, offline use and personal data. Layers 1 to 4 are being built and stay as they are.

| layer | adds | proof | size |
|-|-|-|-|
| 1 Scaffold and a page | `keel scaffold project`, `keel dev`, `keel docs`, `title`, `k.head` | app test; `keel check` | S |
| 2 Schema, store, component | schema, store, component, `std.headless` widgets | app tests; a11y report | S |
| 3 Forms, text, money, messages | `k.forms`, `std.text`, `std.money`, `std.messages` | app tests; resume smoke step that submits | M |
| 4 Routes, guard, server API, services | loaders, actions, a guard that redirects, API routes, `k.services` | app tests; built-app smoke step for the redirect | M |
| 5 Postgres app data and restart | `std.postgres`, `k.data`, `std.db` on Postgres, migrations; `k.persist` | app tests on PGlite; built-app smoke with SIGKILL and restart on Postgres 17 | M |
| 6 Sign-in, personal data, tokens | identity through `k.mount` (an example seam, not a library), `pii`, `s.secret`, `reveal`, `k.privacy-reads`, `std.tokens` with expiry | app tests; built-app smoke that signs in and reads a token | M |
| 7 Channels and live, two users | `std.channels`, `std.live`, `std.multi` with two signed-in users | app tests under simulation; built-app smoke with two browser contexts (replaces the manual `monitor.mjs` path in CI) | M |
| 8 Jobs, schedules, a workflow | receipt parsing as a job, a nightly digest schedule, a removal-style workflow, `std.statecharts` | app tests with the sim clock; built-app smoke that waits for one schedule fire | M |
| 9 (README) The weekly staples, built | `std.workflows` (chart, a step job per staple, a wait), `std.jobs` (a start job), `std.schedules` (weekly, `missed: 'once'`), `commitStores`, `std.channels` over a workflow store; `apps/household/modules/shopping/restock.server.ts` | `test/restock.test.ts`, `test/restock.sim.test.ts` (kill at eleven points, `simulate` faults, schedule catch-up), `test/restockChart.test.ts`; `tooling/smoke/household.mjs` Run now, SIGKILL mid-run, restart, one run, each staple once | M |
| 9 Sessions and evidence | `std.sessions` record, replay, to-test, `std.monitor`, `keel evidence`, `--verify` | app tests; `keel evidence --verify` over the app in CI | S |

Offline writes, conflicts and the native shells stay out of the walkthrough's layers. The outbox and the shell are covered by golden-1 today (sections 2 and 4 below); a tenth layer may add the outbox once layers 5 to 9 are built, and the walkthrough takes it only if it reads naturally in the ledger (a household member adds a receipt on a train).

The walkthrough is also the demo app (`tasks/p1/PLAN.md` W10 and its Feature moments table), and it stays a realistic app. Layer 9 shows in the UI what the session records as the person uses the app, and nothing more: there is no replay page built into the app. Replay, stepping back, turning a session into a test and filing a bug from one are done with the normal tools (the `keel` commands, the inspector, `std.sessions`' own entries), the way a team running a real app does it. The public docs walk through that with this app: use the app, find the recorded session, replay it, reproduce a bug from it, make a test of it. Each earlier layer names one moment a reader can try in under a minute with the normal tools (kill the server and find the data kept; open two windows and watch a live update; read the evidence bundle), and the README lists them in order.

Closes: findings a.1, a.9 (`std.multi`), b (`k.guards`, `std.tokens`, `std.schedules`, `std.channels`, `k.privacy` use), c.5 (sessions from a signed-in user), c.8 (schedules with workflows with Postgres).

### 2. Scenario tests

Placement follows what the repo does today: a scenario that belongs to one package's fault lives in that package's `test/` (as `packages/std-db/test/postgres-server.test.ts` takes `KEEL_TEST_POSTGRES_URL`); a scenario that needs a whole app's modules lives in that app's `test/` (`apps/golden-1/test/outbox.sim.test.ts` is the model, driven by `simulate`, `explore` and `prove` from `@keel/testing`); a scenario that needs a built server and a kill is a script in `tooling/smoke/`, run in the `built-smokes` or `postgres` CI job. No new package is needed.

| scenario | home and why | drives | size |
|-|-|-|-|
| Racing and concurrent writes to one row, `transaction concurrent`, 409 `keel.conflict` | `packages/std-db/test/` (the package owns the rule) plus `apps/golden-1/test/` for the route's answer | `simulate` with seeded interleavings on PGlite; the same file on a real Postgres 17 where `KEEL_TEST_POSTGRES_URL` is set | M |
| Offline write that conflicts while a live push arrives for the same row (c.1) | `apps/golden-1/test/` (the only app with outbox, 409 and a channel) | `simulate` with fault schedule: offline, push, reconnect, drain; `explore` over the order | L |
| Connection loss: stream cut, outbox kept, reconnect with a replayed event | `apps/golden-1/test/`, beside `realtime.test.ts` | `simulate` network faults; `@keel/std-live` package test for the resubscribe rule | M |
| Workflow with jobs on Postgres under kill and restart (c.2) | `tooling/smoke/workflow-postgres.mjs`, next to `workflow.mjs`; runs in the `postgres` CI job | built golden-1 `api` on Postgres 17, SIGKILL inside a step, restart; the instance ends once | M |
| Schedule fire and catch-up after downtime | `packages/std-schedules/test/` for the rule; `apps/golden-1/test/digest.test.ts` for the app's digest | sim clock jumps over missed fires | S |
| `pii` with tokens kept out of the log, recording and evidence (c.3, canaries) | `apps/golden-2/test/` for the sim canary (golden-2 has `pii`, `reveal`, tokens); `tooling/smoke/canary.mjs` for the built server's log | plant a canary value in a `pii` field, mint a token, then grep the server log, the session recording and the `keel evidence` bundle | L |
| Sessions from a signed-in user (c.5) | `apps/golden-2/test/` after it gains a sessions module (a golden extension, section 5) | record under sim with an identity, replay, assert redaction | M |
| Evidence bundle over an app: `keel evidence --verify` passes and a tampered bundle fails | `packages/cli/test/` (the command's home) | run the command over a fixture app; flip one byte | S |
| Identity with the outbox: a queued write after sign-out (c.6) | `packages/std-offline/test/` for `std.outbox-owner`; the walkthrough's app tests after layer 6 | `simulate` sign-out with a pending write | M |
| Guard redirect into a shell (c.4) | `tooling/smoke/shell.mjs` as a new session (Linux Tauri in CI, `shell-drive.mjs` on macOS) after the walkthrough has a redirecting guard | WebDriver; the redirected route and a later sign-in | M |
| Resume with live updates and forms (c.7) | `tooling/smoke/resume.mjs`, the `setup` steps of each run, over the built `apps/household` (its `web` is a `node` deployable; nothing is copied or changed) | built app in Chromium: scripts held while the name is typed, a run started through the API as a second client, the form submitted, the server killed and restarted, the browser context offline and back | M |
| Locale switch with money in a form; `servedBy` with peers and a shell (c.8) | `apps/golden-2/test/` for the first; `tooling/smoke/resume.mjs` for the second | sim and Chromium | S |
| CSP header read: the default policy on a built server and what a third-party origin widens | `packages/cli/test/` for the build, `tooling/smoke/` header step on one built app | built server, one `fetch` and a header parse | S |

Proofs that need no new vehicle: the sim and PGlite scenarios run in the ordinary `test` shards; only the three `tooling/smoke/` scripts and the Postgres 17 run need a CI job, and each fits an existing one.

### 3. Minimal examples

Where they live: `examples/<name>/` at the repository root. The repository has no `examples/` folder today; `docs/BRAND.md` already counts "example apps" among what a person sees (marks, `brandTokens`, voice lint V0003 apply), and `tasks/p1/PLAN.md` W7 makes the walkthrough app the tutorial and W15 step 3 puts component examples inside a golden app. The walkthrough is one app; one-feature examples would clutter it, and `apps/` holds the apps the ledger and CI treat as products. Adding `examples/*` to `pnpm-workspace.yaml` gives each example `keel check`, `keel test` and `keel build` in the same CI jobs, and the docs check (W6 step 6) can compile any snippet that quotes one. This is a decision for the operator to confirm: the alternative is `apps/example-<name>`, which needs no workspace change and costs a longer `apps/` listing.

Each example: under 15 files, one topology, a README of one screen that says the feature and the command to run, its own `test/` (one app test that asserts the feature), and a built step that runs in CI. A single shared script, `tooling/smoke/examples.mjs`, builds each example and runs its check.

| example | the feature shown | proof | size |
|-|-|-|-|
| `examples/third-party-origin` | `k.origins`: one analytics or map origin, and the CSP it widens | app test reads the policy; built server's header contains exactly that origin | S |
| `examples/host-component` | `k.host-element`, `k.host-code`: a custom `Host` element that wraps a small outside library, with its data table alternative | app test and a11y report; build | M |
| `examples/openapi-import` | `k.openapi`: a typed client from a checked-in OpenAPI file against a stub service route | app test with `net` routes; build | S |
| `examples/static-client` | static client hosting with no server (`adapter: "client"`); the existing inspector is the real one | build, then a plain file server serves `dist` and Chromium loads it | S |
| `examples/client-only-api` | a front end with no server of its own: `adapter: "client"` alone, a declared `connect` origin, a page reading a public API with loading, empty and error states | app test over `ctx.net` routes recording every request; build, then a plain file server, Chromium against a local stand-in for the API, the policy refusing an undeclared origin, no `/__keel/*` request; `keel check` on a copy without `origins` is E1571 | S |
| `examples/shell-mount` | `k.mount` into a shell and a guard redirect into it (`k.return`, `k.mount-scope`) | app test; Tauri Linux run in the existing `shell-tauri` job | M |
| `examples/links-in` | `k.links`: a deep link opens a route | app test; built-in route table check; Tauri or Capacitor run only if the walkthrough does not take it | S |
| `examples/compose-peers` | compose with two nodes as peers (`KEEL_PEER_<NAME>`) | `docker compose config` in CI and a boot of both servers; the `docker build` step already exists for G1 | M |
| `examples/native-tauri`, `examples/native-capacitor` | one page in a Tauri and a Capacitor shell, nothing else | the shell builds; Tauri runs on Linux in `shell-tauri` | M |
| `examples/codemod-place` | `keel codemod place`: move a module from one deployable to another | script runs the codemod over the example and `keel check` passes after | S |

The two native shells are examples and not walkthrough layers: golden-1 already exercises both end to end, and a reader of the walkthrough does not need a native toolchain. Native shells stay in G1 for the full drive (offline outbox after SIGKILL); the examples show only the build and a first page.

### 4. Better closed by extending a golden app

- Postgres with a workflow and a job (c.2): golden-2 moves to Postgres in `lane-w14g2`; its `api` gains the job only if scenario 4 of section 2 needs a second app, otherwise the smoke over golden-1 is enough.
- Sessions from a signed-in user (c.5): golden-2 gains a sessions module.
- Static client hosting: `apps/inspector` already is that; `examples/static-client` shows it small and the smoke serves its `dist` as plain files.
- Compose and Dockerfiles: CI builds only golden-1's images; add golden-2's to the same step.
- Second and third charts, guards that redirect and `std.lists` in a golden app: whichever app already has a list page.

### 5. Can only rest on conformance tests

`k.explain` text, `k.compat` accept rules, `k.mount-scope` edge cases, `k.privacy-reads` on code an app would not write, `k.bundle` worker limits (the limit is a build error an app cannot ship), `k.parity` and `std.contracts` (proposed sections), the Android UI (CI builds the APK; no runner drives it), `keel` MCP and LSP protocol edges, and every E-code whose input is invalid by construction.

## Order of work

### Build in parallel now

Independent agents in separate worktrees; none touches another's files.

| lane | what | files it owns | tier |
|-|-|-|-|
| A | walkthrough layers 5 to 9, sequential in one lane (layer 5 waits on RFC 0175, see below; layers 7 and 9 may start first) | the walkthrough app's folder | sonnet, in order; opus for the layer 6 seam design |
| B | scenario: offline conflict with a live push, and connection loss | `apps/golden-1/test/` new files only | opus designs the fault schedule, sonnet writes |
| C | scenario: racing writes on PGlite (the Postgres 17 run follows RFC 0175) | `packages/std-db/test/` new file | sonnet |
| D | scenario: `pii` canaries over log, recording and evidence | `apps/golden-2/test/` new file, `tooling/smoke/canary.mjs` | sonnet |
| E | scenarios: schedule catch-up, evidence tamper, identity with outbox | `packages/std-schedules/test/`, `packages/cli/test/`, `packages/std-offline/test/` | haiku for the tamper script, sonnet for the rest |
| F | the `examples/` folder: workspace entry, the shared `examples.mjs` script and the CI step, then the first example (`third-party-origin`) | `pnpm-workspace.yaml`, `tooling/ci.source.json`, `tooling/smoke/examples.mjs`, `examples/third-party-origin/` | sonnet; the workspace and CI edit is the operator's to confirm |
| G | examples in order after F merges, one agent per example, in parallel: `host-component`, `openapi-import`, `static-client`, `links-in`, `codemod-place` | one `examples/<name>/` folder each | haiku for `static-client` and `openapi-import` (mechanical), sonnet for the rest; opus for `host-component` if the W15 host element design is not final |
| H | CSP header read smoke | `tooling/smoke/` new file | haiku |

Lane F touches the shared CI source and workspace file once and finishes before lane G starts; nothing else edits those two files. Lanes B, C, D, E and H share no file with each other or with A.

### Waits on RFC 0175 merging (Postgres defaults, migrations found by the framework)

- Walkthrough layer 5 (Postgres app data and restart) and anything that reads its migrations.
- The Postgres 17 runs of scenarios 1 and 4 (racing writes; workflow with jobs on Postgres).
- Golden-2's workflow or job on Postgres, if taken.

### Waits on other work

- Shell scenarios (guard redirect into a shell, `examples/shell-mount`): need the walkthrough's redirecting guard (layer 4, being built) and the `k.mount` shell path.
- Sessions from a signed-in user: needs golden-2's sessions module.
- `examples/compose-peers` and `examples/native-*`: independent of everything above; ready once lane F merges.

### Tiers in short

Haiku: mechanical examples (`static-client`, `openapi-import`), the tamper script, the header smoke. Sonnet: the walkthrough layers, most scenarios, other examples. Opus: the offline-conflict fault schedule, the layer 6 identity seam, `host-component` if its design is open.
