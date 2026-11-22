# Freeze review (G3)

Each section's clauses are the bullets under its **Conformance** paragraph. Every section has at least one `packages/*/conformance` file whose `// Spec:` header quotes it; the rows of k.persist, k.prove, k.topology, k.hosting, k.shell, std.db, std.shells and std.workflows were audited clause by clause; the others were not. `conformance-covered` requires 0 partial, todo, none. One conformance test is skipped: `std-i18n/conformance/e2301.test.ts`.

## 1. Per section

| section | clauses | status | missing tests |
| --- | --- | --- | --- |
| k.schema | 15 | **conformance-covered** | none |
| k.formats | 1 | **conformance-covered** | none |
| k.reactive | 20 | **conformance-covered** | none |
| k.store | 25 | implemented | clause 25 (a view store seeded from loader data, through `renderRoute` and `resumeDocument`): its tests quote the RFC's wording, not the clause |
| k.ctx | 18 | **conformance-covered** | none |
| k.errors | 13 | **conformance-covered** | none |
| k.compiler | 22 | **conformance-covered** | none |
| k.component | 17 | **conformance-covered** | none |
| k.runtime | 13 | **conformance-covered** | none |
| k.ui | 15 | **conformance-covered** | none |
| k.router | 16 | **conformance-covered** | none |
| k.prefix | 7 | **conformance-covered** | none |
| k.head | 8 | **conformance-covered** | none |
| k.forms | 16 | **conformance-covered** | none |
| k.server | 16 | **conformance-covered** | none |
| k.topology | 9 | **conformance-covered** | none |
| k.compat | 11 | **conformance-covered** | none |
| k.api | 14 | **conformance-covered** | none |
| k.services | 12 | **conformance-covered** | none |
| k.check | 13 | **conformance-covered** | none |
| k.cli | 19 | **conformance-covered** | none |
| k.module | 14 | **conformance-covered** | none |
| k.scaffold | 14 | implemented | clause 11 (`scaffold route` with `method` and no `api` is E1052) and clause 14 (the W1356 managed-block check): no cited test |
| k.testing | 18 | **conformance-covered** | none |
| k.model | 7 | **conformance-covered** | none |
| k.sim | 11 | **conformance-covered** | none |
| k.ledger | 11 | **conformance-covered** | none |
| k.sync | 14 | **conformance-covered** | none |
| k.deploy | 11 | **conformance-covered** | none |
| k.review | 8 | **conformance-covered** | none |
| k.escapes | 9 | **conformance-covered** | none |
| k.bundle | 7 | **conformance-covered** | none |
| k.explain | 4 | **conformance-covered** | none |
| k.return | 5 | **conformance-covered** | none |
| k.opening | 14 | **conformance-covered** | none |
| k.hosting | 7 | **conformance-covered** | none |
| k.openapi | 1 | **conformance-covered** | none |
| k.a11y | 12 | **conformance-covered** | none |
| k.security | 13 | **conformance-covered** | none |
| k.privacy | 10 | **conformance-covered** | none |
| k.privacy-reads | 4 | **conformance-covered** | none |
| k.evidence | 10 | **conformance-covered** | none |
| k.aria | 10 | **conformance-covered** | none |
| k.guards | 3 | **conformance-covered** | none |
| k.persist | 12 | **conformance-covered** | none |
| k.data | 6 | **conformance-covered** | none |
| k.prove | 10 | **conformance-covered** | none |
| k.reveal | 9 | **conformance-covered** | none |
| k.shell | 8 | **conformance-covered** | none |
| k.claim | 9 | **conformance-covered** | none |
| k.defaults | 6 | **conformance-covered** | none |
| k.host | 5 | **conformance-covered** | none |
| k.leave | 10 | **conformance-covered** | none |
| k.mount | 8 | **conformance-covered** | none |
| k.owner | 5 | **conformance-covered** | none |
| k.place | 5 | **conformance-covered** | none |
| k.resume | 13 | **conformance-covered** | none |
| k.serverlog | 7 | **conformance-covered** | none |
| k.user | 10 | **conformance-covered** | none |
| k.boundary | 8 | **conformance-covered** | not audited clause by clause; the environment and limits suites run `keel build` on fixtures whose `env.d.ts` the type pass does not read |
| std.brands | 7 | **conformance-covered** | none |
| std.channels | 12 | **conformance-covered** | none |
| std.conflicts | 10 | **conformance-covered** | none |
| std.copy | 2 | **conformance-covered** | none |
| std.db | 8 | proposed | clause 1: the Postgres path runs on PGlite only; no job sets `KEEL_TEST_POSTGRES_URL` |
| std.postgres | 8 | **conformance-covered** | none; clauses 5 and 7 meet Postgres 17 in CI's `postgres` job only |
| std.outbox | 14 | **conformance-covered** | none |
| std.outbox-owner | 6 | **conformance-covered** | not audited clause by clause |
| std.geo | 5 | **conformance-covered** | none |
| std.headless | 7 | **conformance-covered** | none |
| std.health | 7 | **conformance-covered** | none |
| std.i18n | 8 | **conformance-covered** | none |
| std.jobs | 11 | **conformance-covered** | none |
| std.live | 10 | **conformance-covered** | none |
| std.messages | 9 | **conformance-covered** | none |
| std.money | 7 | **conformance-covered** | none |
| std.monitor | 7 | **conformance-covered** | none |
| std.multi | 7 | **conformance-covered** | none |
| std.offline | 16 | **conformance-covered** | none |
| std.options | 7 | **conformance-covered** | none |
| std.report | 19 | **conformance-covered** | none |
| std.schedules | 9 | **conformance-covered** | none |
| std.sessions | 13 | **conformance-covered** | none |
| std.shells | 9 | **conformance-covered** | none |
| std.statecharts | 10 | **conformance-covered** | none |
| std.tables | 9 | **conformance-covered** | none |
| std.temporal | 12 | **conformance-covered** | none |
| std.text | 11 | **conformance-covered** | none |
| std.timings | 7 | **conformance-covered** | none |
| std.tokens | 15 | **conformance-covered** | none |
| std.workflows | 8 | **conformance-covered** | none |
| k.contract | 11 | **conformance-covered** | none |
| k.docs | 13 | implemented | clause 5 (a `docs/` link outside its package is E1066) and clause 8 (a skill's `title` from a `description` with codes): no cited test |
| k.host-code | 6 | implemented | the Chromium clause: no browser test |
| k.host-element | 11 | **conformance-covered** | none |
| k.links | 11 | **conformance-covered** | none |
| k.mount-scope | 1 | implemented | clause 1: asserted, not cited under its full text |
| k.origins | 11 | **conformance-covered** | none |
| k.parity | 6 | proposed | clauses 5 and 6: no test; S0013, the kind gates, is not built |
| k.roles | 8 | implemented | clause 6: asserted in `ui/conformance/roles-grid.test.ts`, not cited under its full text |
| k.routes | 9 | **conformance-covered** | none |
| std.capacitor | 6 | implemented | `UNTESTABLE` toolchain lookups and capability file shape |
| std.contracts | 7 | **conformance-covered** | none |
| std.lists | 6 | **conformance-covered** | none |
| std.tauri | 6 | implemented | `UNTESTABLE` toolchain lookups and capability file shape |
| **total** | **1024** | 94 of 103 covered | |

## 2. One-way audit (principle 1)

Every audited surface has one way.

| # | where | single way |
| --- | --- | --- |
| 1 | `router/src/types/RouteDef.ts`, `guard.ts` | `guard: authGuard` by reference; no name, no registry |
| 2 | `server/src/types/AppOptions.ts`, `server/src/internal/runGuards.ts` | the route holds the guard; `createApp` has no guard table |
| 3 | `router/src/manifest.ts`, `Form.ts` | `<contract>.href` typed by the contract; `<Form action>` takes an `Href` |
| 4 | `schema/src/internal/make.ts` | `parse`; there is no `decode` |
| 5 | `ctx/src/Random.ts` | `random.id(brand)` |
| 6 | `ui/src/index.ts` | style props; there is no `styles()` |
| 7 | `ui/src/elements/Button.ts` | children name the button; there is no `label` |
| 8 | `forms/src/types/FormState.ts`, `router/src/types/FormProps.ts` | `form.pending()`; `<Form>` has no `loading` |
| 9 | `forms/src/types/FormState.ts` | `setPending/validate/onResult` behind a symbol-keyed handle |
| 10 | `store/src/types/Transaction.ts` | `schema` only |
| 11 | `scaffold/src/scaffold.ts` | `scaffold()`; there is no `plan()` |
| 12 | `router/src/index.ts`, `store/src/index.ts` | public exports only; the server reads `@keel/router/internal` and `@keel/store/internal` |
| 13 | `server/src/index.ts`, `compiler/src/types/Topology.ts` | one `Topology`, owned by the compiler; `TopologySchema` is internal |

The `session` command without the sessions module reports I1055 (exit 0); `cli/conformance/rules-e1051.test.ts` asserts it.

## 3. Extension points

| point | registers via public API in a test | used by a stdlib module |
| --- | --- | --- |
| schema type registry | yes: `schema/conformance/registry.test.ts` (`s.register`) | yes (`@keel/std-money`: `money.Money`, `money.Currency`) |
| check rule registry | yes: `check/conformance/define-rule.test.ts` (E1753, E1756); `fix` exercised by `std-brands/conformance/brands.test.ts` (`git apply`) | yes (`@keel/std-brands`: E2101) |
| capability registry | yes: `ctx/conformance/three-implementations.conformance.test.ts` (all modes) | yes (`@keel/std-geo`: `geo`) |
| module manifest | yes: `check/conformance/module-stdlib-same-rules.test.ts` (fixture `@keel/std-x`); apps golden-1, inspector; `std` key E1158 | yes (`@keel/std-health`: `health.status`) |
| inspector hooks | yes: `server/conformance/inspect-sections.test.ts`, `cli/conformance/inspect-sections.test.ts` | yes (`@keel/std-timings`: `timings.recent`) |
| output formatter registry | yes: `cli/conformance/rules-e1053-e1054.test.ts` through `@keel/cli/testing` `respond` | yes (`@keel/std-report`: `report.tally`) |

Each point has a stdlib user, so the G3 criterion is 6 of 6.

## 4. Unstated behavior

**Tested, not stated (spec-addition candidates):** schema `min > max` throws at construction; store created outside a scope throws, default id `store.<n>`; router guards run outermost first, revalidation keeps scroll and focus; server trailing-slash 308; services default timeout 10,000 ms; forms other `err` clears field errors; runtime no handler after dispose; check `as const`/`satisfies` are not casts, module diagnostics order-independent, `--code` keeps the exit status of all errors; scaffold refuses edits into `.keel/` (E1005); testing failure output under 10 lines.

## Other G3 criteria

Golden apps: `apps/golden-1` and `apps/golden-2` have converged evals (`evals/results/2026-11-18-golden-1-api-none.json`, `2026-11-18-golden-2-none.json`); `apps/inspector` and `apps/sessions` are not eval-built. Converged runs are recorded on 2026-11-06, 2026-11-07, 2026-11-10, 2026-11-11, 2026-11-12, 2026-11-13, 2026-11-14, 2026-11-16, 2026-11-17 and 2026-11-18; `golden-2-catalog` converged on 2026-11-17 and 2026-11-18. `golden-1` and `golden-3` did not converge on 2026-11-17.

## Status

No section is `frozen`. The kernel is provisionally frozen: a kernel change goes through an RFC with an ADR, a conformance update and a migration note, and the `frozen` flip waits until the stdlib stages have exercised the kernel (`tasks/0034-freeze/PLAN.md`). k.parity and std.db are `proposed`; k.docs, k.host-code, k.mount-scope, k.roles, k.scaffold, k.store, std.capacitor and std.tauri are `implemented`; the other 92 of 102 are `conformance-covered`.

verified: 68d910b9bf61e79f5f3a523d5bc0c8f4b4419ccc
