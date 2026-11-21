# Freeze review: the kernel at the start of P1

Backlog 0034. This file lists what stands between the kernel spec and the `frozen` status flip, and prepares the flip. It changes no spec, code or conformance file. Commands below run from the repo root; counts are from the tree at `6b3cc2c6` with the status changes of the same day; the header-drift paragraph and the criteria in section 3 keep their measurement commit named.

## Summary

- 68 kernel sections. 62 are `conformance-covered`; the five `implemented` are k.docs, k.host-code, k.mount-scope, k.roles and k.scaffold; k.parity is `proposed`.
- 709 Conformance bullets. 701 are cited by a conformance test in the ledger (`tooling/ledger/ledger.json`, no clause at rung `none`); the 8 that are not: k.docs 5 and 8, k.mount-scope 1, k.parity 5 and 6, k.roles 6, k.scaffold 11 and 14.
- Tests exist for k.mount-scope 1 and k.roles 6 (`router/conformance`, `server/conformance`, `ui/conformance/roles-grid.test.ts`), but their `// Spec:` headers do not quote the whole clause, so the ledger lists them at `none`.
- k.host-code is `implemented`: its Chromium clause needs a real browser's computed style and `server/conformance/host-code-styles-policy.test.ts` asserts the policy header only.
- k.parity is `proposed`: S0012 (its first part) is built; S0013, the kind gates, is not (RFC 0169).
- std.capacitor and std.tauri are `implemented`, not covered: `UNTESTABLE` lines in `std-capacitor/conformance` and `std-tauri/conformance` (the toolchain lookups, the capability file's shape). std.lists, std.shells and std.headless are `conformance-covered`.
- Six of six extension points have stdlib users. RFCs: 146 read `implemented`, 18 `accepted` (builds merged for most), 2 `draft` (0147, 0150, both on sections now covered), 2 `proposed` (0163, 0169: not built or half built). ADRs: 0172, 0185 and 0191 read `proposed`.
- 12 items block the flip (section 5); a thirteenth, a guard for frozen spec text, is recommended.

## 1. Kernel sections and status

`grep -h '^status:' spec/kernel/k.*.md | sort | uniq -c`: 62 `conformance-covered`, 5 `implemented`, 1 `proposed`. `spec/00-map.md` carries the same status per row.

| section | status | missing |
| --- | --- | --- |
| k.docs | implemented | Clause 5 (a `docs/` link outside its package is E1066, a package folder linked into a store reads) and clause 8 (a skill's `title` from a `description` with codes) have no cited test. |
| k.host-code | implemented | The Chromium clause (a production policy: outside `<style>` and `style` change no computed style, `node.style.color` does) has no browser test. |
| k.mount-scope | implemented | Clause 1 is asserted but not cited under its full text (ledger `none`). |
| k.roles | implemented | Clause 6 (the grid, tree and cell attributes) is asserted in `ui/conformance/roles-grid.test.ts` but not cited under its full text (ledger `none`). |
| k.scaffold | implemented | Clause 11 (`scaffold route` with `method` and no `api` is E1052) and clause 14 (the W1356 managed-block check) have no cited test. |
| k.parity | proposed | Clauses 5 (S0012 over `deps.json`) and 6 (S0013, `@keel/std-*` in a kernel `src/` file) have no test; S0013 is not built. |

## 2. Per section counts

Bullets are the lines under each section's `**Conformance.**` paragraph; "no evidence" counts the section's ledger clauses at rung `none`; "gap lines" counts `GAP:`, `UNTESTABLE` and `untestable` lines in the conformance files that cite the section (a line may name text that is not a Conformance bullet); "assumed" counts `ASSUMED` lines there.

| section | status | bullets | no evidence | gap lines | assumed |
| --- | --- | --- | --- | --- | --- |
| k.a11y | conformance-covered | 12 | 0 | 0 | 0 |
| k.api | conformance-covered | 14 | 0 | 2 | 0 |
| k.aria | conformance-covered | 10 | 0 | 0 | 0 |
| k.boundary | conformance-covered | 8 | 0 | 0 | 0 |
| k.bundle | conformance-covered | 7 | 0 | 0 | 0 |
| k.check | conformance-covered | 13 | 0 | 0 | 0 |
| k.claim | conformance-covered | 9 | 0 | 0 | 0 |
| k.cli | conformance-covered | 19 | 0 | 1 | 0 |
| k.compat | conformance-covered | 11 | 0 | 0 | 1 |
| k.compiler | conformance-covered | 20 | 0 | 0 | 0 |
| k.component | conformance-covered | 17 | 0 | 0 | 0 |
| k.contract | conformance-covered | 11 | 0 | 0 | 0 |
| k.ctx | conformance-covered | 18 | 0 | 0 | 0 |
| k.defaults | conformance-covered | 6 | 0 | 0 | 0 |
| k.deploy | conformance-covered | 11 | 0 | 0 | 2 |
| k.docs | implemented | 13 | 2 | 0 | 0 |
| k.errors | conformance-covered | 13 | 0 | 0 | 0 |
| k.evidence | conformance-covered | 10 | 0 | 0 | 4 |
| k.explain | conformance-covered | 4 | 0 | 0 | 1 |
| k.formats | conformance-covered | 1 | 0 | 1 | 2 |
| k.forms | conformance-covered | 16 | 0 | 0 | 0 |
| k.guards | conformance-covered | 3 | 0 | 0 | 0 |
| k.head | conformance-covered | 8 | 0 | 0 | 0 |
| k.host-code | implemented | 6 | 0 | 2 | 0 |
| k.host-element | conformance-covered | 11 | 0 | 1 | 0 |
| k.host | conformance-covered | 5 | 0 | 0 | 0 |
| k.hosting | conformance-covered | 7 | 0 | 0 | 3 |
| k.leave | conformance-covered | 10 | 0 | 0 | 0 |
| k.ledger | conformance-covered | 11 | 0 | 0 | 0 |
| k.links | conformance-covered | 11 | 0 | 0 | 13 |
| k.model | conformance-covered | 7 | 0 | 0 | 0 |
| k.module | conformance-covered | 14 | 0 | 0 | 0 |
| k.mount-scope | implemented | 1 | 1 | 0 | 0 |
| k.mount | conformance-covered | 8 | 0 | 0 | 0 |
| k.openapi | conformance-covered | 1 | 0 | 0 | 0 |
| k.opening | conformance-covered | 14 | 0 | 0 | 11 |
| k.origins | conformance-covered | 11 | 0 | 0 | 0 |
| k.owner | conformance-covered | 5 | 0 | 0 | 0 |
| k.parity | proposed | 6 | 2 | 0 | 0 |
| k.persist | conformance-covered | 12 | 0 | 0 | 2 |
| k.data | conformance-covered | 6 | 0 | 0 | 0 |
| k.place | conformance-covered | 5 | 0 | 0 | 0 |
| k.prefix | conformance-covered | 7 | 0 | 0 | 0 |
| k.privacy | conformance-covered | 10 | 0 | 0 | 2 |
| k.privacy-reads | conformance-covered | 4 | 0 | 0 | 0 |
| k.prove | conformance-covered | 10 | 0 | 0 | 0 |
| k.reactive | conformance-covered | 20 | 0 | 0 | 0 |
| k.resume | conformance-covered | 13 | 0 | 0 | 0 |
| k.return | conformance-covered | 5 | 0 | 0 | 9 |
| k.reveal | conformance-covered | 9 | 0 | 0 | 0 |
| k.roles | implemented | 8 | 1 | 0 | 0 |
| k.router | conformance-covered | 16 | 0 | 1 | 0 |
| k.routes | conformance-covered | 9 | 0 | 0 | 0 |
| k.runtime | conformance-covered | 13 | 0 | 0 | 0 |
| k.scaffold | implemented | 14 | 2 | 0 | 4 |
| k.schema | conformance-covered | 15 | 0 | 1 | 1 |
| k.security | conformance-covered | 13 | 0 | 0 | 0 |
| k.server | conformance-covered | 16 | 0 | 2 | 0 |
| k.serverlog | conformance-covered | 7 | 0 | 0 | 0 |
| k.services | conformance-covered | 12 | 0 | 0 | 0 |
| k.shell | conformance-covered | 8 | 0 | 1 | 1 |
| k.sim | conformance-covered | 10 | 0 | 0 | 0 |
| k.store | conformance-covered | 23 | 0 | 2 | 0 |
| k.sync | conformance-covered | 14 | 0 | 0 | 0 |
| k.testing | conformance-covered | 14 | 0 | 0 | 0 |
| k.topology | conformance-covered | 9 | 0 | 0 | 0 |
| k.ui | conformance-covered | 15 | 0 | 0 | 0 |
| k.user | conformance-covered | 10 | 0 | 0 | 0 |

**A header is not an assertion.** Lines marked `GAP:` or untestable inside covered sections (`grep -rnE "GAP:|untestable|UNTESTABLE" packages/*/conformance`) leave one bullet partly asserted:

- k.schema, bullet 16: "For a fixture format type, every generated value parses and round-trips; ... JSON Schema adds `format`; ...". `schema/conformance/format-type-base-derivations.test.ts:2`: the JSON Schema half is untestable from `@keel/schema`, which exports no derivation (`cli/src/internal/toJsonSchema.ts` holds it). The API sentence "JSON Schema adds `pattern: "\\S"`" has the same gap (`blank-required-0091.test.ts:5`).

k.privacy bullet 1 (`x-keel-pii`) is asserted in `cli/conformance/privacy-pii-json-schema.test.ts`. The other gap and untestable lines name text that is not a Conformance bullet (Rules notes, harness halves covered elsewhere).

**Header drift** (measured at `28cc3229`, not repeated). 12 of 936 one-line quoted kernel headers quote text no longer in their section (first eight words, normalized), for example `check/conformance/fix-diffs.test.ts:3` "No fix edits a file under `node_modules/`." against the Rules text "No fix edits `node_modules/`.". Three of them elide with `...` (`ui/.../box-label-0091.test.ts:2`, `server/.../deploy-env-keys-0092.test.ts:1`, `scaffold/.../project-deploy-files.test.ts:1`) and may still read true. All 12 quote Rules, table rows or prose paragraphs, not Conformance bullets, so no coverage claim rests on them. They are edits under `conformance/`, so they need an `rfc:` tag. The others, under `packages/`: `cli/conformance/ledger-mutation-claims.test.ts:2`, `cli/conformance/test-sim-ctx.test.ts:3`, `cli/conformance/dev-port-0091.test.ts:2`, `ctx/conformance/keel-test-env-sim.test.ts:1`, `scaffold/conformance/project-structure.test.ts:1`, `check/conformance/module-stdlib-schema-and-rules.test.ts:4`, `check/conformance/ambient-aliases-e1601-e1603.test.ts:5`, `router/conformance/matching-static-first.test.ts:2`.

## 3. Criteria for a freeze

| criterion | where stated | met | evidence |
| --- | --- | --- | --- |
| Every kernel section `conformance-covered` | ROADMAP G3, PRD 01 | no | `grep -L '^status: conformance-covered' spec/kernel/k.*.md`: 6 files (k.docs, k.host-code, k.mount-scope, k.parity, k.roles, k.scaffold) |
| Each extension point used by at least one stdlib module | ROADMAP G3, GLOSSARY | yes | schema type registry: `grep -rlE '\bs\.register\(' packages/std-*/src`, 8 packages; check rule registry (`defineRule`): 13; capability registry (`register` from `@keel/ctx`): 3 (std-geo, std-sessions, std-tokens); module manifest: every app module, and a `std` key in 2 (`apps/golden-1/modules/api`, `apps/sessions/modules/ops`); inspector hooks (`@keel/compiler/inspect/inspector`): 4; output formatter registry (`formatter(`): 3 |
| One way per thing (principle 1) | backlog 0034 | yes | no `decode` export in `schema/src/index.ts`, no `uuid` method in `ctx/src/Random.ts` (comment only), no `styles` in `ui/src/index.ts`, no `plan` in `scaffold/src/index.ts`, no `loading` in `router/src/types/FormProps.ts`, no router internals in `router/src/index.ts`, no `TopologySchema` in `server/src/index.ts`: 0 hits each |
| RFC ledger one way (append-only; changes as an Amendment) | RFC.md, WORKFLOW.md | yes | `git log -M --diff-filter=D --name-only -- docs/rfc docs/adr`: 5 paths, each a file rewritten under its own number while a draft (RFC 0072, 0079, 0139; ADR-0061, 0161); no accepted RFC removed |
| No open draft RFC touching a kernel section | RFC.md lifecycle | no | `grep -m1 '^Status:' docs/rfc/*.md`: 0147 (k.return, k.server) and 0150 (k.links) read `draft` though their sections are covered; 0163 (not built) and 0169 (S0012 built, S0013 not) read `proposed`. ADRs: 0172, 0185 and 0191 read `proposed` |
| Implemented RFCs marked `implemented` | RFC.md lifecycle, 0034 plan step 2 | no | 146 RFCs read `implemented`; 18 read `accepted` (0024, 0032, 0060, 0085, 0094, 0104, 0105, 0109, 0124, 0125, 0132, 0142, 0148, 0149, 0152 to 0155), whose builds are merged unless noted in their text |
| Assumptions in conformance resolved or accepted | not stated in any doc (see Reading) | no | `grep -rn "ASSUMED" packages/*/conformance`: 18 lines in 18 files (k.evidence 5, k.scaffold 5, k.compat 2, k.deploy 2, k.persist 2, k.forms 1, k.privacy 1). Counting `ASSUMPTION(S)` and `Assumed` too: 105 lines across 31 sections (table, section 2) |
| Two golden apps; evals converge | ROADMAP G3 | yes | `evals/results/2026-11-19-golden-2-none.json` and `2026-11-19-golden-1-api-none.json` converged; earlier dates hold the same; one model run on record (`2026-11-18-golden-2-catalog-claude-sonnet-5-5.json`) |

**Reading.** No doc defines the assumption criterion. This review reads it so: an assumption that names test plumbing (a fixture layout, a temp directory, a harness seam) is accepted as it stands; one that names a public shape the spec does not state is resolved by spec text through an RFC before the flip, since freezing the section otherwise freezes a contract nobody wrote. Examples of each kind:

- Now stated, comment stale: `router/conformance/fixtures.ts:2` says the spec names no router-instance API, and k.router states `createRouter(routes, { ctx, history, mode? })`.
- Unstated public shape: the sim net route `ctx.net.route(url, handler)` (k.sim says a fetch "runs the route" and names no API; 7 `services/conformance` files assume it); k.evidence `runs` and `security.json` field names (`cli/conformance/evidence-failing-run.test.ts:3`, `evidence-security.test.ts:2`); the json-mode `frames` shape (`server/conformance/diag-frames-0095.test.ts:4`).
- Plumbing, accepted: `scaffold/conformance/place-support.ts:2` (place through the real binary), `cli/conformance/compat-support.ts:3` (fixture layout).

"Evals improving" is read as converging on two or more recorded dates: a `none` run replays the committed app and converges in one iteration, so it shows no trend.

## 4. The flip, prepared

In order. Steps 1 to 3 each land as their own RFC unit (RFC, conformance, build) and change one status; step 4 is one commit tagged with the freeze RFC.

1. **k.docs, k.host-code, k.mount-scope, k.roles, k.scaffold** `implemented` to `conformance-covered`, each after the test or citation its row in section 1 names, then **k.parity** `proposed` to `implemented` and `conformance-covered` after S0013 is built. Files per section: `spec/kernel/k.<id>.md` line 2; `spec/00-map.md` row `k.<id>`.
2. **All 68 kernel sections** `conformance-covered` to `frozen`, under a freeze RFC with its ADR (RFC.md: a status rule change goes through an RFC). Files:
   - `docs/rfc/NNNN-kernel-freeze.md`, `docs/adr/NNNN-kernel-freeze.md`.
   - `spec/kernel/k.*.md` line 2, 68 files: `sed -i '' '2s/^status: conformance-covered$/status: frozen/' spec/kernel/k.*.md`, then `grep -c '^status: frozen' spec/kernel/k.*.md | grep -c ':1$'` gives 68.
   - `spec/00-map.md`, the 66 rows of the Kernel table only: `sed -E -i '' '/^## Kernel/,/^## Stdlib/ s/\| conformance-covered \|/| frozen |/' spec/00-map.md`.
   - The `**Status:**` line of the 15 kernel package READMEs (`packages/{schema,reactive,store,runtime-dom,compiler,router,forms,ui,check,scaffold,testing,server,services,cli,ctx}/README.md`); today they read `implemented` (6), `proposed` (2: ui, cli) and `conformance-covered` (7).
   - `docs/freeze-review.md` (the table and Status paragraph), `docs/ROADMAP.md` (the G3 and P1 rows), `docs/GLOSSARY.md` (the kernel's "provisionally frozen core": a term definition, the operator's call), `docs/HANDOFF.md`.
   - `tooling/ledger/evidence.json` and `tasks/COVERAGE.md`, regenerated by `node tooling/evidence-report.mjs --markdown` from a clean tree after both apps' `keel test`; they carry each section's status.
   - `tasks/BACKLOG.md` line 0034 and `tasks/0034-freeze/PLAN.md`, closed.
   - Checks: `pnpm ledger --diff` (E1707 treats `frozen` as `conformance-covered`, `cli/src/internal/coverageGaps.ts:9`), `node tooling/budgets.mjs` (the status word gets shorter), `pnpm check`.

## 5. Blocking items

Each line is written to become a backlog line.

1. (medium) conformance: k.docs 5 and 8, k.scaffold 11 and 14, k.parity 5 and 6 have no cited test; k.mount-scope 1 and k.roles 6 have tests whose `// Spec:` headers quote less than the clause; k.host-code's Chromium clause needs a browser test; then those sections to `conformance-covered` · cli, scaffold, router, ui, server, check · k.docs k.scaffold k.parity k.mount-scope k.roles k.host-code
2. (medium) build: S0013, the kind gates of k.parity (RFC 0169's second part) · check, tooling · k.parity
3. (small) conformance: std.capacitor and std.tauri `UNTESTABLE` toolchain lookups and capability shape, then both to `conformance-covered` · std-capacitor, std-tauri
4. (medium) conformance: the JSON Schema halves of k.schema bullet 16 (`format`) and the k.schema API sentence on `pattern: "\\S"` have no assertion; assert them through a public path (an MCP tool's input schema, or a public derivation by RFC) · schema, cli · k.schema
5. (small) docs: mark the 18 built `accepted` RFCs `implemented` (section 3 lists them), decide RFC 0147 and 0150 (drafts on covered sections) and ADR-0172 · docs · all
6. (medium) conformance: triage the 105 assumption lines in kernel conformance (`ASSUMED`, `ASSUMPTION`, `Assumed`): drop the stale ones the spec now states (`router/conformance/fixtures.ts:2`), accept the plumbing ones in a list, and state the unstated public shapes by RFC (sim `ctx.net.route`, k.evidence `runs` and `security.json` fields, json-mode `frames`) · all · all
7. (medium) spec: land or defer by decision the open spec-text items on kernel sections: 0346 (k.topology dev start), 0655 (k.server `bearer`), 0656 (k.privacy `[pii]` of an action output), 0904 (k.bundle), 0909 (identity mount in dev), 0954 (k.cli Inspect) · spec · k.topology k.server k.privacy k.bundle k.cli
8. (medium) backlog: sort the 159 open lines naming a kernel section into "before the flip" (changes semantics) and "after" (additive, through an RFC on a frozen section); 16 of them are high or medium · all · all
9. (small) conformance: rewrite the 12 `// Spec:` quotes whose text left their section (the header-drift paragraph names them) under one `rfc:` tag · all · all
10. (small) docs: the 15 kernel package READMEs carry a stale `**Status:**` (ui and cli `proposed`); `docs/freeze-review.md` lists k.boundary as `proposed` and misses k.bundle, k.explain and k.return; `docs/ROADMAP.md` counts "38 of 40" kernel sections · docs · all
11. (small) check: the rule consolidation owed before the freeze (backlog 0845, `@keel/check` at its budget) · check · k.check
12. (medium) docs: check the "Tested, not stated" list against the suites and turn each into spec text or a dropped line (backlog 0413) · docs, spec · all
13. (medium, recommended; no doc requires it) tooling: a guard that refuses a commit changing a `frozen` section's text without an `rfc:NNNN` tag, as S0008 does for `conformance/`; today principle 8 has no tool behind it · tooling · all
