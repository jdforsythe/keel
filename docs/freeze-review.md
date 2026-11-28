# Freeze review (G3)

Each section's clauses are the bullets under its **Conformance** paragraph. Every section has at least one `packages/*/conformance` file whose `// Spec:` header quotes it; the rows of k.persist, k.prove, k.topology, k.hosting, k.shell, std.db, std.shells and std.workflows were audited clause by clause; the others were not. `conformance-covered` requires 0 partial, todo, none, and `keel ledger --diff` raises E1707 for a section at that status with a clause at `none`. Three conformance tests are skipped: `std-i18n/conformance/e2301.test.ts` and the two failing-case tests of `testing/conformance/a11y-e1826-status-inserted.test.ts`; seven more skip unless a Postgres 17 service is reachable (`skipIf(!hasPg17)`: one in `std-db/conformance/postgres-watch.test.ts`, six in `std-postgres/conformance`).

## 1. Per section

| section | clauses | status | missing tests |
| --- | --- | --- | --- |
| k.schema | 22 | implemented | not yet covered by conformance |
| k.formats | 10 | **conformance-covered** | none |
| k.reactive | 27 | implemented | not yet covered by conformance |
| k.store | 26 | implemented | not yet covered by conformance |
| k.ctx | 25 | **conformance-covered** | none |
| k.errors | 19 | implemented | not yet covered by conformance |
| k.compiler | 22 | **conformance-covered** | none |
| k.component | 17 | **conformance-covered** | none |
| k.runtime | 13 | **conformance-covered** | none |
| k.ui | 28 | **conformance-covered** | none |
| k.router | 20 | **conformance-covered** | none |
| k.prefix | 8 | **conformance-covered** | none |
| k.head | 11 | **conformance-covered** | none |
| k.forms | 19 | **conformance-covered** | none |
| k.server | 19 | **conformance-covered** | none |
| k.topology | 18 | **conformance-covered** | none |
| k.compat | 15 | **conformance-covered** | none |
| k.api | 14 | **conformance-covered** | none |
| k.services | 17 | **conformance-covered** | none |
| k.check | 23 | implemented | not yet covered by conformance |
| k.check-cache | 13 | **conformance-covered** | none |
| k.cli | 20 | **conformance-covered** | none |
| k.module | 23 | implemented | not yet covered by conformance |
| k.scaffold | 20 | **conformance-covered** | none |
| k.scaffold-service | 8 | **conformance-covered** | none |
| k.scaffold-shell | 9 | **conformance-covered** | none |
| k.testing | 28 | **conformance-covered** | none |
| k.test-run | 11 | implemented | not yet covered by conformance |
| k.requests | 4 | **conformance-covered** | none |
| k.model | 7 | **conformance-covered** | none |
| k.sim | 14 | **conformance-covered** | none |
| k.drive | 23 | **conformance-covered** | none |
| k.drive-law | 11 | **conformance-covered** | none |
| k.ledger | 19 | implemented | not yet covered by conformance |
| k.sync | 14 | **conformance-covered** | none |
| k.deploy | 15 | **conformance-covered** | none |
| k.review | 8 | **conformance-covered** | none |
| k.escapes | 14 | implemented | not yet covered by conformance |
| k.bundle | 13 | **conformance-covered** | none |
| k.explain | 6 | **conformance-covered** | none |
| k.return | 6 | **conformance-covered** | none |
| k.opening | 16 | **conformance-covered** | none |
| k.hosting | 9 | **conformance-covered** | none |
| k.openapi | 3 | **conformance-covered** | none |
| k.a11y | 23 | **conformance-covered** | none |
| k.security | 13 | **conformance-covered** | none |
| k.privacy | 15 | **conformance-covered** | none |
| k.privacy-reads | 6 | **conformance-covered** | none |
| k.evidence | 10 | **conformance-covered** | none |
| k.aria | 13 | implemented | not yet covered by conformance |
| k.guards | 11 | **conformance-covered** | none |
| k.persist | 16 | **conformance-covered** | none |
| k.data | 10 | **conformance-covered** | none |
| k.prove | 10 | **conformance-covered** | none |
| k.reveal | 9 | **conformance-covered** | none |
| k.shell | 18 | **conformance-covered** | none |
| k.claim | 9 | **conformance-covered** | none |
| k.defaults | 6 | **conformance-covered** | none |
| k.host | 5 | **conformance-covered** | none |
| k.leave | 19 | implemented | not yet covered by conformance |
| k.mount | 13 | **conformance-covered** | none |
| k.owner | 5 | **conformance-covered** | none |
| k.place | 5 | **conformance-covered** | none |
| k.resume | 13 | **conformance-covered** | none |
| k.serverlog | 19 | implemented | not yet covered by conformance |
| k.user | 16 | **conformance-covered** | none |
| k.boundary | 12 | **conformance-covered** | none |
| std.brands | 7 | **conformance-covered** | none |
| std.channels | 26 | **conformance-covered** | none |
| std.conflicts | 11 | **conformance-covered** | none |
| std.copy | 3 | **conformance-covered** | none |
| std.db | 14 | **conformance-covered** | none; clause 1 meets Postgres 17 in CI's `postgres` job |
| std.postgres | 22 | implemented | not yet covered by conformance; clauses 5 and 7 meet Postgres 17 in CI's `postgres` job only |
| std.postgres-changes | 7 | implemented | not yet covered by conformance |
| std.outbox | 14 | **conformance-covered** | none |
| std.outbox-owner | 6 | **conformance-covered** | not audited clause by clause |
| std.geo | 5 | **conformance-covered** | none |
| std.headless | 7 | **conformance-covered** | none |
| std.health | 7 | **conformance-covered** | none |
| std.i18n | 9 | **conformance-covered** | none |
| std.jobs | 12 | **conformance-covered** | none |
| std.live | 15 | **conformance-covered** | none |
| std.messages | 12 | **conformance-covered** | none |
| std.money | 10 | **conformance-covered** | none |
| std.monitor | 7 | **conformance-covered** | none |
| std.multi | 8 | **conformance-covered** | none |
| std.offline | 16 | **conformance-covered** | none |
| std.options | 7 | **conformance-covered** | none |
| std.report | 19 | **conformance-covered** | none |
| std.schedules | 9 | **conformance-covered** | none |
| std.sessions | 23 | **conformance-covered** | none |
| std.sessions-served | 3 | **conformance-covered** | none |
| std.shells | 13 | **conformance-covered** | none |
| std.statecharts | 10 | **conformance-covered** | none |
| std.tables | 11 | **conformance-covered** | none |
| std.temporal | 12 | **conformance-covered** | none |
| std.text | 11 | **conformance-covered** | none |
| std.timings | 7 | **conformance-covered** | none |
| std.tokens | 16 | **conformance-covered** | none |
| std.workflows | 9 | implemented | not yet covered by conformance |
| k.contract | 11 | **conformance-covered** | none |
| k.docs | 19 | implemented | not yet covered by conformance |
| k.host-code | 6 | **conformance-covered** | the Chromium clause: no browser test |
| k.host-element | 11 | **conformance-covered** | none |
| k.links | 12 | **conformance-covered** | none |
| k.mount-scope | 1 | **conformance-covered** | none |
| k.origins | 12 | **conformance-covered** | none |
| k.parity | 6 | proposed | clauses 5 and 6: no test; S0013, the kind gates, is not built |
| k.roles | 15 | implemented | not yet covered by conformance |
| k.looks | 14 | proposed | none |
| k.schemes | 13 | proposed | none; the first paint and the system preference are owed to an end-to-end runner |
| k.values | 9 | proposed | none; the Chromium clause runs in tooling/smoke/brand.mjs |
| k.routes | 10 | **conformance-covered** | none |
| std.capacitor | 11 | **conformance-covered** | `UNTESTABLE` toolchain lookups and capability file shape |
| std.contracts | 7 | **conformance-covered** | none |
| std.lists | 6 | **conformance-covered** | none |
| std.tauri | 10 | **conformance-covered** | `UNTESTABLE` toolchain lookups and capability file shape |
| k.unsafe | 14 | implemented | not yet covered by conformance |
| k.a11y-static | 11 | implemented | not yet covered by conformance |
| std.channels-limits | 4 | **conformance-covered** | none |
| std.sessions-redact | 1 | **conformance-covered** | none |
| k.ledger-items | 14 | implemented | not yet covered by conformance |
| k.library | 18 | proposed | not yet covered by conformance |
| k.library-pack | 5 | implemented | not yet covered by conformance |
| k.server-deps | 11 | implemented | not yet covered by conformance |
| k.attempt | 15 | implemented | not yet covered by conformance |
| k.defects | 9 | implemented | not yet covered by conformance |
| k.entries | 3 | proposed | not yet covered by conformance |
| k.expect | 10 | **conformance-covered** | none |
| k.fixes | 12 | implemented | not yet covered by conformance |
| k.identity | 11 | implemented | not yet covered by conformance |
| k.realm | 11 | implemented | not yet covered by conformance |
| k.shared | 9 | implemented | not yet covered by conformance |
| k.supervise | 12 | **conformance-covered** | none |
| std.postgres-errors | 7 | implemented | not yet covered by conformance |
| **total** | **1681** | 100 of 135 covered | |

## 2. One-way audit (principle 1)

Every audited surface has one way.

| # | where | single way |
| --- | --- | --- |
| 1 | `router/src/types/Binding.ts`, `guard.ts` | `guard: authGuard` by reference; no name, no registry |
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

No section is `frozen`. The kernel is provisionally frozen: a kernel change goes through an RFC with an ADR, a conformance update and a migration note, and the `frozen` flip waits until the stdlib stages have exercised the kernel (`tasks/0034-freeze/PLAN.md`). 35 of 135 sections are not `conformance-covered`: k.entries, k.library, k.looks, k.parity (clauses 5 and 6 at `none`), k.schemes and k.values are `proposed`; k.a11y-static, k.aria, k.attempt, k.check, k.defects, k.docs, k.errors, k.escapes, k.fixes, k.identity, k.leave, k.ledger, k.ledger-items, k.library-pack, k.module, k.reactive, k.realm, k.roles, k.schema, k.server-deps, k.serverlog, k.shared, k.store, k.test-run, k.unsafe, std.postgres, std.postgres-changes, std.postgres-errors and std.workflows are `implemented`.

subject: spec/ packages/*/conformance/
verified: 674109d1c0ddd8e715641413452a7f949f1a852c
