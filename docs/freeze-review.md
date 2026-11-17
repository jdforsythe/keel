# Freeze review (G3)

Each section's clauses are the bullets under its **Conformance** paragraph. Every section has at least one `packages/*/conformance` file whose `// Spec:` header quotes it; the table is not a clause-by-clause audit. `conformance-covered` requires 0 partial, todo, none. One conformance test is skipped: `std-i18n/conformance/e2301.test.ts`.

## 1. Per section

| section | clauses | status | missing tests |
| --- | --- | --- | --- |
| k.schema | 12 | **conformance-covered** | none |
| k.reactive | 19 | **conformance-covered** | none |
| k.store | 23 | **conformance-covered** | none |
| k.ctx | 17 | **conformance-covered** | none |
| k.errors | 13 | **conformance-covered** | none |
| k.compiler | 20 | **conformance-covered** | none |
| k.component | 16 | **conformance-covered** | none |
| k.runtime | 13 | **conformance-covered** | none |
| k.ui | 15 | **conformance-covered** | none |
| k.router | 15 | **conformance-covered** | none |
| k.prefix | 7 | **conformance-covered** | none |
| k.head | 7 | **conformance-covered** | none |
| k.forms | 16 | **conformance-covered** | none |
| k.server | 16 | **conformance-covered** | none |
| k.topology | 9 | implemented | not audited clause by clause |
| k.compat | 13 | **conformance-covered** | none |
| k.api | 14 | **conformance-covered** | none |
| k.services | 12 | **conformance-covered** | none |
| k.check | 13 | **conformance-covered** | none |
| k.cli | 19 | **conformance-covered** | none |
| k.module | 14 | **conformance-covered** | none |
| k.scaffold | 10 | **conformance-covered** | none |
| k.testing | 13 | **conformance-covered** | none |
| k.model | 7 | **conformance-covered** | none |
| k.sim | 10 | **conformance-covered** | none |
| k.ledger | 11 | **conformance-covered** | none |
| k.sync | 10 | **conformance-covered** | none |
| k.deploy | 9 | **conformance-covered** | none |
| k.hosting | 6 | implemented | not audited clause by clause |
| k.openapi | 1 | **conformance-covered** | none |
| k.a11y | 9 | **conformance-covered** | none |
| k.security | 13 | **conformance-covered** | none |
| k.privacy | 12 | **conformance-covered** | none |
| k.evidence | 10 | **conformance-covered** | none |
| k.aria | 10 | **conformance-covered** | none |
| k.guards | 3 | **conformance-covered** | none |
| k.persist | 12 | proposed | not audited clause by clause |
| k.prove | 9 | proposed | not audited clause by clause |
| k.reveal | 8 | **conformance-covered** | none |
| k.shell | 6 | proposed | not audited clause by clause |
| std.brands | 6 | **conformance-covered** | none |
| std.channels | 10 | **conformance-covered** | none |
| std.conflicts | 8 | **conformance-covered** | none |
| std.credentials | 15 | **conformance-covered** | none |
| std.db | 8 | proposed | not audited clause by clause |
| std.geo | 5 | **conformance-covered** | none |
| std.headless | 7 | **conformance-covered** | none |
| std.health | 7 | **conformance-covered** | none |
| std.i18n | 8 | **conformance-covered** | none |
| std.jobs | 11 | **conformance-covered** | none |
| std.live | 8 | **conformance-covered** | none |
| std.messages | 9 | **conformance-covered** | none |
| std.money | 7 | **conformance-covered** | none |
| std.monitor | 7 | **conformance-covered** | none |
| std.multi | 7 | **conformance-covered** | none |
| std.offline | 10 | **conformance-covered** | none |
| std.options | 7 | **conformance-covered** | none |
| std.report | 6 | **conformance-covered** | none |
| std.schedules | 8 | **conformance-covered** | none |
| std.sessions | 13 | **conformance-covered** | none |
| std.shells | 6 | proposed | not audited clause by clause |
| std.statecharts | 10 | **conformance-covered** | none |
| std.tables | 9 | **conformance-covered** | none |
| std.temporal | 10 | **conformance-covered** | none |
| std.text | 9 | **conformance-covered** | none |
| std.timings | 7 | **conformance-covered** | none |
| std.tokens | 10 | **conformance-covered** | none |
| std.workflows | 8 | proposed | not audited clause by clause |
| **total** | **708** | 60 of 68 covered | |

## 2. One-way audit (principle 1)

Every audited surface has one way.

| # | where | single way |
| --- | --- | --- |
| 1 | `router/src/types/RouteDef.ts`, `guard.ts` | `guard: authGuard` by reference; no name, no registry |
| 2 | `server/src/types/AppOptions.ts`, `server/src/internal/runGuards.ts` | the route holds the guard; `createApp` has no guard table |
| 3 | `router/src/manifest.ts`, `Form.ts` | `routes.href` typed by the manifest; `<Form action>` takes an `Href` |
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

Golden apps: `apps/golden-1` and `apps/golden-2` have converged evals (`evals/results/2026-11-16-golden-1-api-none.json`, `2026-11-14-golden-2-none.json`); `apps/inspector` and `apps/sessions` are not eval-built. Converged runs are recorded on 2026-11-06, 2026-11-07, 2026-11-10, 2026-11-11, 2026-11-12, 2026-11-13, 2026-11-14 and 2026-11-16; the golden-2-catalog task has not converged.

## Status

No section is `frozen`. k.topology and k.hosting are `implemented`; k.persist, k.prove, k.shell, std.db, std.shells and std.workflows are `proposed`; the other 60 are `conformance-covered`.

verified: a920a063ddb8a4b0b966f28da26ddaf4d1b0d2b1
