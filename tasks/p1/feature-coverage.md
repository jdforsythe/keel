# Feature coverage by apps

Which Keel features a real app exercises, which only package tests cover, and the walkthrough app's layers that close the holes. Read from `apps/*` (imports, topology, routes, tests), `tooling/smoke/*.mjs` and `.github/workflows/ci.yml`.

Marks: `x` used by the app's code; `t` used only by the app's tests; `p` pending in `lane-w14g2` (golden-2's data on `@keel/std-postgres`); `-` not used. "Smoke" is a script that drives a built or `keel dev` app end to end: `ci` runs in CI, `man` is a manual script. "Pkg" is covered by package tests and conformance only.

Apps: G1 golden-1 (todo board: `web` client + `api` node on SQLite), G2 golden-2 (recipes: `web` client + `api` node), Ins inspector (`web` client only), Ses sessions (one `node` deployable).

## Smokes

| script | app | drives |
|-|-|-|
| `restart.mjs` (ci) | G1 built `api`, SQLite | writes, SIGKILL, restart, board row byte-equal |
| `workflow.mjs` (ci) | G1 built `api` | removal workflow resumes after a kill inside a step |
| `resume.mjs` (ci) | G2 built `web` and `api`, peers | five pages resume in Chromium; forms; identity mount sign-up and sign-in |
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
| k.guards | x | x | - | x | | | `apps/golden-1/modules/todos/editable.guard.ts`, `apps/golden-2/modules/recipes/cook.guard.ts` |
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
| k.cli: `keel codemod` | - | - | - | - | | x | |
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
| k.return (shell mount) | - | - | - | - | | x | no app mounts into a shell |
| k.opening | t | - | - | - | | | `apps/golden-1/test/editor.test.ts` |
| k.links (links in) | - | - | - | - | | x | |
| k.serverlog | t | - | - | - | | | `apps/golden-1/test/realtime.test.ts` |
| k.sync (concurrent writes) | x | - | - | - | ci | | `apps/golden-1/modules/api/postEdit.server.ts` (409 `keel.conflict`) |
| k.persist: SQLite | x | - | - | - | ci | | `apps/golden-1/topology.ts`, `restart.mjs` |
| k.persist: Postgres | - | p | - | - | | x | `evals/tasks/golden-1-api/restartProof.ts` runs G1 on Postgres in CI (an eval task, not an app) |
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
| k.security (headers, CSP) | x | x | x | x | | | default policy on every built server; no app test reads it |
| k.origins (third-party origins) | - | - | - | - | | x | |
| k.privacy (`pii`, `secret`) | - | x | - | - | | | `apps/golden-2/modules/accounts/Credentials.schema.ts` |
| k.reveal | - | x | - | - | | | `apps/golden-2/modules/accounts/postToken.server.ts` |
| k.privacy-reads | - | - | - | - | | x | |
| k.evidence | - | - | - | - | | x | |
| k.parity | - | - | - | - | | x | proposed section |
| **Stdlib** | | | | | | | |
| std.sessions: record, replay, to-test | x | - | - | x | ci | | `apps/sessions/test`, `shellSession.ts`, `shell.mjs` |
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
| std.monitor | x | - | - | - | man | | `monitor.mjs` |
| std.headless: Dialog, Disclosure, Toaster | - | x | - | - | ci | | `apps/golden-2/modules/recipes/toasts.ts` |
| std.options: Listbox, Combobox, Menu, Tabs | - | x | - | - | | | `apps/golden-2/modules/recipes/CatalogPage.tsx` |
| std.lists | - | - | - | - | | x | |
| std.tables | - | x | - | - | | | `apps/golden-2/test/catalogColumns.test.ts` |
| std.db (SQLite) | x | - | - | - | ci | | `restart.mjs` |
| std.db (Postgres) | - | p | - | - | | x | CI Postgres jobs run package tests |
| std.postgres | - | p | - | - | | x | `lane-w14g2` |
| std.workflows | x | - | - | - | ci | | `workflow.mjs` |
| std.shells | x | - | - | - | ci | | Tauri and iOS smokes |
| std.capacitor | x | - | - | - | ci | | iOS drive, Android build |
| std.tauri | x | - | - | - | ci | | Tauri drive |
| std.tokens | - | x | - | - | | | `apps/golden-2/test/tokens.test.ts` (bearer tokens) |
| **Deploy shapes** | | | | | | | |
| static client hosting (CDN, no server) | - | - | x | - | | | `apps/inspector` is `adapter: "client"` with no host; nothing serves it in a smoke except `vite preview` |
| node deployable | x | x | - | x | ci | | `restart.mjs`, `resume.mjs` |
| compose | x | x | - | - | | | `apps/*/deploy/compose.yaml`; CI builds only G1's Dockerfiles |
| Tauri shell | x | - | - | - | ci | | |
| Capacitor iOS shell | x | - | - | - | ci | | |
| Capacitor Android shell | x | - | - | - | ci (build) | | |
| two nodes as peers (`KEEL_PEER_<NAME>`) | - | x | - | - | ci | | `resume.mjs` |

## Counts

120 rows. 87 are used by an app's code, 6 only by an app's tests, 4 are pending in `lane-w14g2`, 23 are used by no app. Built-app smokes drive about 40 of the 87; the rest are covered by app tests, which run under simulation and not in a built server.

## Findings

### a. Features no app uses, by how much an app author leans on them

1. Postgres app data (`std.postgres`, `k.data`, `std.db` on Postgres): pending in `lane-w14g2`; until it merges, no app stores data in Postgres.
2. Third-party origins (`k.origins`) and the CSP they widen: every real app calls a payment, map or analytics origin.
3. Custom components (`k.host-element`, `k.host-code`): charts and editors are the usual reason to leave the building blocks.
4. OpenAPI import (`k.openapi`): the way an app reaches an existing service; `k.services` is used only against the app's own routes.
5. A guard redirect into a shell and shell mounts (`k.return`, `k.mount-scope`): sign-in in a native shell.
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
- `k.security`: the default CSP applies to every built server and no app test reads a header.
- `std.i18n` and `std.messages`: G2's locale switch is client-side; no built smoke switches locale.

### c. Combinations nothing exercises together

1. Offline writes, conflicts and live updates: G1 queues writes (`outbox.sim.test.ts`) and answers 409 `keel.conflict`, and the board channel pushes, but no test or smoke queues a write that conflicts while a push arrives for the same row.
2. Workflows with jobs on Postgres: `workflow.mjs` runs on SQLite only; Postgres has the restart proof for the board and no workflow.
3. `pii` with tokens and the privacy rules: the `reveal` of a minted token in G2 is checked in tests; no built smoke asserts that a `pii` field never reaches a log, the session recording or the evidence bundle.
4. A guard redirect into a shell: no guarded route is reachable in a Tauri or Capacitor build.
5. Sessions recorded from a user who signs in: G1's recordings are anonymous; G2 has identity and no sessions module.
6. Identity with the outbox: a queued write whose owner differs from the caller (`std.outbox-owner`) is checked in package tests, never after a sign-out in a shell.
7. Resume (G2) with live updates and forms (G1): `resume.mjs` covers a server-rendered G2; G1 is a client build, so no island resumes into a channel.
8. Schedules with workflows with Postgres, `servedBy` with peers and a shell, i18n with money in a form: each pair has no test.

## Proposed layers for the walkthrough app

W7's ten chapters (scaffold to native shell) cover basics. The layers below add the holes. One app, one lane, built in order; each layer is a tagged commit range with its own tests. The subject is a shared shopping and receipts ledger for a household: small enough to read, and it needs money, users, offline use and personal data.

| layer | adds | proof | size |
|-|-|-|-|
| 1 Scaffold and a page | `keel new`, `keel dev`, `keel docs`, `title`, `k.head` | app test; `keel check` | S |
| 2 Schema, store, component | schema, store, component, widgets from `std.headless` | app tests; a11y report | S |
| 3 Forms and validation | `k.forms`, `std.text`, `std.money` in a form, `std.messages` | app tests; resume smoke step that submits | M |
| 4 Routes, guards, server API | loaders, actions, API routes, a guard that redirects, `k.services` against its own API | app tests; built-app smoke step for the redirect | M |
| 5 Storage that survives a kill | SQLite then Postgres through `std.postgres`; migrations | built-app smoke: SIGKILL and restart on both | M |
| 6 Sign-in and personal data | `k.mount` identity seam (an example, not a library), `std.tokens` with expiry, `pii`, `secret`, `reveal`, privacy reads, session redaction | app tests; a canary smoke that greps log, recording and evidence for the `pii` values | L |
| 7 Live updates and two users | `std.channels`, `std.live`, `std.multi` with two signed-in users | app tests under simulation; smoke with two browser contexts | M |
| 8 Offline writes and conflicts | `std.offline`, 409 `keel.conflict`, `std.conflicts`, a write queued while a push arrives for the same row | simulation with faults; smoke that cuts the server and restarts | L |
| 9 Jobs, schedules, workflows | receipt parsing as a job, a nightly digest schedule, a workflow on Postgres killed inside a step | built-app smoke with a kill on Postgres; schedule fire and catch-up | M |
| 10 Third parties and custom components | `k.origins` for a rate or receipt service, a `Host` chart, OpenAPI import of that service, CSP report | app tests; smoke reads the CSP header and a report | M |
| 11 Evidence | sessions, replay, `std.monitor`, `keel evidence`, `--verify` | `keel evidence` over the app in CI | S |
| 12 Static client and native shells | static client hosting, Tauri, Capacitor iOS and Android; sign-in redirect into a shell; compose with peers | shell run: the guard redirect, an offline write that drains, a conflict after relaunch | L |

Layers 6, 8 and 12 close combinations c.3, c.1, c.4 and c.6. Layer 5 and 9 close c.2.

### Better closed in a golden app

- Postgres: `lane-w14g2` already moves G2; add a workflow and a job to G2 only if the walkthrough does not take layer 9 (c.2).
- Resume with live updates (c.7): G1 needs a `node` web deployable first, which is a topology change to a golden app, not a walkthrough concern.
- Sessions from a signed-in user (c.5): G2 gains a sessions module.
- Static client hosting with no server: `apps/inspector` already is that; add a smoke that serves its `dist` as plain files.
- Compose and Dockerfiles for G2: CI builds G1's images only; add G2's to the same step.

### Cannot be exercised by an app

These rest on conformance tests: `k.explain` text, `k.compat` accept rules, `k.mount-scope` edge cases, `k.privacy-reads` on code an app would not write, `k.bundle` worker limits (an app may use a worker, but the limit is a build error an app cannot ship), `k.parity` and `std.contracts` (proposed sections), the Android UI (CI builds the APK; no runner drives it), and every E-code whose input is invalid by construction.
