# Freeze review (0034, G3)

2026-11-06. Each Conformance block split into atomic clauses, each mapped to a non-todo test body in any `packages/*/conformance/**`. PARTIAL: the test asserts less than the clause. All 15 suites green (33 skipped). `conformance-covered` requires 0 partial, todo, none.

## 1. Per section

| section | clauses | tested | partial | todo | none | verdict | missing tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| k.schema | 8 | 8 | 0 | 0 | 0 | **conformance-covered** | none (clause 8 `json`, rfc:0018, landed 95961ef) |
| k.forms | 7 | 7 | 0 | 0 | 0 | **conformance-covered** | none (clause 7 asserted in `server/conformance/post-invalid-formdata-422.test.ts:33`; the forms copy is `it.skip`) |
| k.reactive | 15 | 14 | 1 | 0 | 0 | no | owner() inside an effect re-run triggered from outside the scope (`owner.test.ts:39` sees only the first run) |
| k.store | 12 | 10 | 2 | 0 | 0 | no | restore from a store with a *different* initial (`snapshot.test.ts:40` uses equal initials); `transaction.schema` over generated *valid* payloads (`schema-exposed.test.ts:21` is `fc.anything()`) |
| k.ctx | 8 | 7 | 1 | 0 | 0 | no | `keel test` itself runs under sim (`default-sim` only sets `KEEL_TEST=1`) |
| k.errors | 14 | 13 | 1 | 0 | 0 | no | E1453, E1454 trigger + clean fixtures; status line still `proposed` |
| k.compiler | 8 | 6 | 1 | 1 | 0 | no | `.keel/` byte change → E1005 (`keel-dir-tamper` skip); `ids.json` keys via harness `find(id)` (test uses `getElementById`) |
| k.component | 5 | 0 | 5 | 0 | 0 | no | purity over equal state; full a11y snapshot (not `[id, role]`); every element via `find`; children thunk in child scope; real base element |
| k.runtime | 11 | 8 | 1 | 2 | 0 | no | `state()` equals snapshot after resume (todo); no islands → no runtime JS (todo); post-resume `fire(id)` vs client-only state and DOM |
| k.ui | 11 | 5 | 6 | 0 | 0 | no | `p={{ base, md }}` object prop; axe on base elements; E1804 reported by check (pass and fail); Button/Checkbox via harness `fire` |
| k.router | 9 | 8 | 1 | 0 | 0 | no | E1502-E1506 fixtures (5 todos; codes already throw at `compileRoutes.ts:22-35`, `Form.ts:31`, `createRouter.ts:148`); E1501 diagnostic, not type only |
| k.server | 7 | 6 | 0 | 1 | 0 | no | dev log stream: one `req` per request, json lines parse (todo) |
| k.services | 9 | 8 | 0 | 1 | 0 | no | OpenAPI fixture client: one method per operation, types match (todo) |
| k.check | 8 | 4 | 3 | 1 | 0 | no | explain + fixture for every Rules code read from spec (hardcoded list misses E1000, E1206, E1757); fix diffs for 30 codes (5 today); golden-1 + 10 injected errors ≤ 600 tokens; W-only tree exits 0 (skip) |
| k.cli | 10 | 6 | 0 | 0 | 4 | no | json/MCP/LSP parity; MCP input schema equality; `/__keel/inspect` dev and prod; `keel inspect` E1056 (all four exist only as unit tests) |
| k.module | 7 | 6 | 1 | 0 | 0 | no | malformed stdlib manifest rejected by `ModuleSchema`; E1153, E1155-E1157 on a stdlib module |
| k.scaffold | 7 | 4 | 3 | 0 | 0 | no | run `keel check` + `keel test` after every generator (proxy: imports resolve; transaction, service skipped); printed dry-run diff equals apply; `turbo.json` vs independently computed graph |
| k.testing | 9 | 6 | 3 | 0 | 0 | no | default-sim render and a seed-dependent state; `fire` awaiting a triggered resource; rung promotion from real test runs |
| **total** | **165** | **126** | **29** | **6** | **4** | 2 of 18 | |

## 2. One-way audit (principle 1)

| # | where | two ways | single way | RFC |
| --- | --- | --- | --- | --- |
| 1 | `router/src/types/RouteDef.ts:23`, `guard.ts:11-17` | `guard('auth', fn)` object, referenced as string `'auth'` | `guard: authGuard` by reference | 0044 |
| 2 | `server/src/types/AppOptions.ts:10-11`, `runGuards.ts:32` | `createApp({ guards })` and global `guard()` table | route-held reference only | 0044 |
| 3 | `router/src/href.ts:11-16`, `manifest.ts:10,16`, `Form.ts:28` | free `href` (latest manifest) vs router table | `routes.href` typed by manifest | 0044 |
| 4 | `schema/src/internal/make.ts:26-27` | `decode` is `parse` | `decode` JSON-codec only, or drop | yes |
| 5 | `ctx/src/Random.ts:8-9` | `random.uuid()` and `random.id(brand)` | `random.id(brand)` | yes |
| 6 | `ui/src/types/StyleProps.ts:11`, `ui/src/styles.ts:9` | style props vs `styles()` + `class` | style props only | yes |
| 7 | `ui/src/elements/Button.ts:12-13,33-36` | text from children or `label` | children = text; `label` = `aria-label` | yes |
| 8 | `forms/src/types/FormState.ts:20`, `router/src/types/FormProps.ts:12`, `RouteState.ts:27` | `form.pending()`, `<Form loading>`, `route().pending` | slot to render, `pending()` to read | yes |
| 9 | `forms/src/types/FormState.ts:22,29,31` | public `setPending/validate/onResult` beside `<Form>` | symbol-keyed handle | no |
| 10 | `store/src/types/Transaction.ts:9,11` | `payload` alias of `schema` (RFC 0007 kept it) | `schema` | no |
| 11 | `scaffold/src/plan.ts:11-16`, `scaffold.ts:13-18` | `plan()` and `scaffold()` identical | `scaffold()`; dry run is a flag | no |
| 12 | `router/src/index.ts:4-18` | `compileRoutes`, writable `guardTable`, `matchUrl`, `runGuard` beside `manifest()` | `@keel/router/internal` for server | no |
| 13 | `server/src/types/Topology.ts:2`, `compiler/src/types/Topology.ts:5`, `server/src/index.ts:7-8` | duplicate `Topology` (and `StyleUsage`); `TopologySchema.parse` accepts what `topology()` rejects | one owner; unexport `TopologySchema` | no |

Contradiction: k.cli Rules make `session` I1055 (exit 0); `cli/conformance/rules-e1051.test.ts:41` asserts E1051.

## 3. Extension points

| point | registers via public API in a test | used by a stdlib module |
| --- | --- | --- |
| schema type registry | yes: `schema/conformance/registry.test.ts:11-27` (`s.register`); registers names only, no new kinds/codecs | no |
| check rule registry | yes: `check/conformance/define-rule.test.ts:7,15` (E2901 seen in `check()` and `explain`); `fix` never exercised | no |
| capability registry | yes: `ctx/conformance/three-implementations.conformance.test.ts:14` (`probe3`, all modes) | no |
| module manifest | yes: `check/conformance/module-stdlib-same-rules.test.ts:19-40` (fixture `@keel/std-x`); apps golden-1, inspector | no |
| inspector hooks | **none**: no spec text, no API; the inspect document (k.cli Inspect) is a closed shape | no |
| output formatter registry | unit only: `cli/test/commands.test.ts:109` through `src/internal` render; conformance tests only E1053 | no |

No stdlib module exists, so the G3 criterion is 0 of 6.

## 4. Implemented but untested; tested but unstated

**Implemented, no conformance test:** E1502-E1506 (runtime throws); E1054, E1056, I1055, surface parity, `/__keel/inspect` (unit only); `defineRule` `fix`; schema "parse never throws", re-register throws; Boundary for computed/effect throws and root default; E1301 static form; E1004 per-deployable exceptions; E1752 re-export clause.

**Spec'd, not implemented or not triggered anywhere:** E1000, E1101-E1104, E1204, E1205, E1251, E1252, E1254, E1302, E1453, E1454, E1551, E1651-E1653, E1702, E1754, E1755, E1803, E1806, E1901, E1903, E1904.

**Tested, not stated (spec-addition candidates):** schema `min > max` throws at construction; store created outside a scope throws, default id `store.<n>`; router guards run outermost first, revalidation keeps scroll and focus; server trailing-slash 308; services default timeout 10,000 ms; forms other `err` clears field errors; runtime no handler after dispose; check `as const`/`satisfies` are not casts, module diagnostics order-independent, `--code` keeps the exit status of all errors; scaffold refuses edits into `.keel/` (E1005); testing failure output under 10 lines.

**Defects found:** `schema/conformance/result.test.ts:87` `fc.assert(await fc.asyncProperty(...))` never awaits the assertion; `check/conformance/zz.test.ts.bak` is a tracked debug probe; RFCs 0001-0013, 0015-0017 still say `Status: draft` though implemented.

## 5. RFCs needed before freeze

1. **0044** router: guards by reference, `routes.href`, one guard registry (findings 1-3).
2. Conformance completion: one RFC per section group adding the section 1 missing tests (conformance edits on `implemented` sections need a number; `rfc:0000` is refused).
3. Inspector hooks: specify the extension point (register a named, schema-typed section of the inspect document) or remove it from GLOSSARY and ARCHITECTURE.
4. Rules triage: each code in section 4's "not implemented" list is implemented with conformance, or deleted from spec.
5. schema `decode` vs `parse` (finding 4).
6. ctx `uuid`/`id` (finding 5).
7. ui one styling path and Button `label` (findings 6, 7).
8. forms/router pending surface (finding 8).
9. k.cli `session`: I1055 or E1051.
10. Open semantic items: 0038 typed `tx`, 0039 closed objects, 0041 E1000/E1501, 0054 per-request stores.
11. k.errors: move status to `implemented` with E1453/E1454 covered.

## Other G3 criteria

Two golden apps: one (`apps/inspector` is not eval-built). Evals improving: no trend (one day of results; `skill-keel`, `skill-keel-api` fail).

## Status flips (evidence)

- **k.schema**: `round-trip.test.ts:9,19` (12 types); `generator-valid.test.ts:9`; `parse-rejects.test.ts:51`; `brands.test.ts:10,13` (type-level; tsconfig includes conformance); `decode-strings.test.ts:23`; `number-bounds.test.ts:17,36-46`; `json.test.ts:15,30`.
- **k.forms**: `submit-invalid-{sends-no-request,sets-every-error,focuses-first-invalid}.test.ts:7`; `formdata-roundtrip.test.ts:18`; `keel-fields-sets-exactly-listed.test.ts:10`; `other-err-renders-in-error-slot.test.ts:8`; `invalid-input-has-aria-wiring.test.ts:7`; `pending-true-from-submit-until-response.test.ts:6`; `server/conformance/post-invalid-formdata-422.test.ts:33`.
