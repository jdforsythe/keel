# Freeze review: the kernel at the start of P1

Backlog 0034. This file lists what stands between the kernel spec and the `frozen` status flip, and prepares the flip. It changes no spec, code or conformance file. Commands below run from the repo root; counts are from the tree at `28cc3229`.

## Summary

- 54 kernel sections. 51 are `conformance-covered`; k.return and k.hosting are `implemented`; k.shell is `proposed`.
- 590 Conformance bullets. 587 have a conformance test whose `// Spec:` header quotes the bullet's first eight words; the 3 that do not are k.return's, whose conformance is in flight.
- A strict read finds two `conformance-covered` sections with a bullet only partly asserted (k.schema, k.privacy: the JSON Schema halves).
- Six of six extension points have stdlib users. The RFC ledger is append-only, but 18 built RFCs and 15 ADRs carry a draft or proposed status line, and RFC 0147 is a draft touching k.return.
- 12 items block the flip (section 5): 5 small, 7 medium, none large; a thirteenth, a guard for frozen spec text, is recommended.

## 1. Kernel sections and status

`grep -h '^status:' spec/kernel/k.*.md | sort | uniq -c`: 51 `conformance-covered`, 2 `implemented`, 1 `proposed`.

| section | status | missing |
| --- | --- | --- |
| k.return | implemented | In flight: RFC 0147's conformance is being written in another lane (`packages/testing/conformance/return-*`), then the build. Bullets 4, 5 and 6 (the opening rules) have no test yet. |
| k.hosting | implemented | Bullet 2: the client entry's `service({ module })` fetch URL, `credentials: 'include'` and the unset case are not observed; `packages/server/conformance/hosting-0087.test.ts:12` says so in a `GAP:` line. Backlog 0693 (0423 is the same item). |
| k.shell | proposed | Bullet 6: `packages/compiler/conformance/shell-entry.test.ts` matches the word `drivers`, which any bundle holds (backlog 0692). The CI paragraph names no macOS Tauri job (backlog 0948). The status moves to `implemented`, then `conformance-covered`. |

## 2. Mechanical check of the covered sections

A throwaway script reads each section's `**Conformance.**` bullets and every `// Spec: <id>` header in `packages/*/conformance` (continuation comment lines joined), and counts a bullet cited when a header for that section holds the bullet's first eight words, normalized. Bullets cited by number (`bullet 13 "..."`) count too.

| section | status | bullets | bullets cited | `ASSUMED:` | all assumption lines |
| --- | --- | --- | --- | --- | --- |
| k.a11y | conformance-covered | 12 | 12 | 0 | 7 |
| k.api | conformance-covered | 14 | 14 | 0 | 1 |
| k.aria | conformance-covered | 10 | 10 | 0 | 1 |
| k.boundary | conformance-covered | 8 | 8 | 0 | 0 |
| k.bundle | conformance-covered | 6 | 6 | 0 | 0 |
| k.check | conformance-covered | 13 | 13 | 0 | 0 |
| k.claim | conformance-covered | 9 | 9 | 0 | 0 |
| k.cli | conformance-covered | 19 | 19 | 0 | 1 |
| k.compat | conformance-covered | 13 | 13 | 2 | 3 |
| k.compiler | conformance-covered | 20 | 20 | 0 | 0 |
| k.component | conformance-covered | 16 | 16 | 0 | 5 |
| k.ctx | conformance-covered | 18 | 18 | 0 | 0 |
| k.defaults | conformance-covered | 6 | 6 | 0 | 0 |
| k.deploy | conformance-covered | 11 | 11 | 2 | 6 |
| k.errors | conformance-covered | 13 | 13 | 0 | 0 |
| k.evidence | conformance-covered | 10 | 10 | 5 | 5 |
| k.explain | conformance-covered | 4 | 4 | 0 | 0 |
| k.forms | conformance-covered | 16 | 16 | 1 | 4 |
| k.guards | conformance-covered | 3 | 3 | 0 | 2 |
| k.head | conformance-covered | 8 | 8 | 0 | 3 |
| k.host | conformance-covered | 5 | 5 | 0 | 0 |
| k.hosting | implemented | 6 | 6 | 0 | 1 |
| k.leave | conformance-covered | 10 | 10 | 0 | 0 |
| k.ledger | conformance-covered | 11 | 11 | 0 | 2 |
| k.model | conformance-covered | 7 | 7 | 0 | 0 |
| k.module | conformance-covered | 14 | 14 | 0 | 2 |
| k.mount | conformance-covered | 7 | 7 | 0 | 0 |
| k.openapi | conformance-covered | 1 | 1 | 0 | 0 |
| k.owner | conformance-covered | 5 | 5 | 0 | 0 |
| k.persist | conformance-covered | 12 | 12 | 2 | 2 |
| k.place | conformance-covered | 5 | 5 | 0 | 0 |
| k.prefix | conformance-covered | 7 | 7 | 0 | 3 |
| k.privacy | conformance-covered | 10 | 10 | 1 | 1 |
| k.prove | conformance-covered | 10 | 10 | 0 | 0 |
| k.reactive | conformance-covered | 20 | 20 | 0 | 0 |
| k.resume | conformance-covered | 13 | 13 | 0 | 0 |
| k.return | implemented | 8 | 5 | 0 | 2 |
| k.reveal | conformance-covered | 9 | 9 | 0 | 0 |
| k.router | conformance-covered | 15 | 15 | 0 | 4 |
| k.runtime | conformance-covered | 13 | 13 | 0 | 4 |
| k.scaffold | conformance-covered | 10 | 10 | 5 | 6 |
| k.schema | conformance-covered | 15 | 15 | 0 | 1 |
| k.security | conformance-covered | 13 | 13 | 0 | 3 |
| k.server | conformance-covered | 16 | 16 | 0 | 3 |
| k.serverlog | conformance-covered | 6 | 6 | 0 | 0 |
| k.services | conformance-covered | 12 | 12 | 0 | 10 |
| k.shell | proposed | 7 | 7 | 0 | 3 |
| k.sim | conformance-covered | 10 | 10 | 0 | 0 |
| k.store | conformance-covered | 23 | 23 | 0 | 0 |
| k.sync | conformance-covered | 14 | 14 | 0 | 2 |
| k.testing | conformance-covered | 14 | 14 | 0 | 4 |
| k.topology | conformance-covered | 9 | 9 | 0 | 4 |
| k.ui | conformance-covered | 15 | 15 | 0 | 4 |
| k.user | conformance-covered | 9 | 9 | 0 | 1 |

**Result.** Every bullet of the 51 covered sections is cited. Sampled against test bodies: k.sync 13 and 14 (`store/conformance/sync-key-limit.test.ts`, each half its own `it`), k.forms 10 (`forms/conformance/form-has-no-loading.test.ts`, `pending()` true then false), k.errors 13 and k.ctx 7 (`cli/conformance/test-sim-ctx.test.ts` runs the real `keel test`). Each holds.

**A header is not an assertion.** Lines marked `GAP:` or untestable inside covered sections (`grep -rnE "GAP:|untestable|UNTESTABLE" packages/*/conformance`, 13 outside the k.return files) leave two bullets partly asserted:

- k.schema, bullet 16: "For a fixture format type, every generated value parses and round-trips; ... JSON Schema adds `format`; ...". `schema/conformance/format-type-base-derivations.test.ts:2`: the JSON Schema half is untestable from `@keel/schema`, which exports no derivation (`cli/src/internal/toJsonSchema.ts` holds it). The API sentence "JSON Schema adds `pattern: "\\S"`" has the same gap (`blank-required-0091.test.ts:5`).
- k.privacy, bullet 1: "`s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: "contact"`." No conformance file asserts `x-keel-pii` (`grep -rn "x-keel-pii" packages/*/conformance`: one hit, the comment saying so).

The other `GAP:` and untestable lines name text that is not a Conformance bullet (Rules notes, harness halves covered elsewhere) or the k.hosting gap above.

**Header drift.** 12 of 936 one-line quoted kernel headers quote text no longer in their section (first eight words, normalized), for example `check/conformance/fix-diffs.test.ts:3` "No fix edits a file under `node_modules/`." against the Rules text "No fix edits `node_modules/`.". Three of them elide with `...` (`ui/.../box-label-0091.test.ts:2`, `server/.../deploy-env-keys-0092.test.ts:1`, `scaffold/.../project-deploy-files.test.ts:1`) and may still read true. All 12 quote Rules, table rows or prose paragraphs, not Conformance bullets, so no coverage claim rests on them. They are edits under `conformance/`, so they need an `rfc:` tag. The others, under `packages/`: `cli/conformance/ledger-mutation-claims.test.ts:2`, `cli/conformance/test-sim-ctx.test.ts:3`, `cli/conformance/dev-port-0091.test.ts:2`, `ctx/conformance/keel-test-env-sim.test.ts:1`, `scaffold/conformance/project-structure.test.ts:1`, `check/conformance/module-stdlib-schema-and-rules.test.ts:4`, `check/conformance/ambient-aliases-e1601-e1603.test.ts:5`, `router/conformance/matching-static-first.test.ts:2`.

## 3. Criteria for a freeze

| criterion | where stated | met | evidence |
| --- | --- | --- | --- |
| Every kernel section `conformance-covered` | ROADMAP G3, PRD 01 | no | `grep -L '^status: conformance-covered' spec/kernel/k.*.md`: 3 files |
| Each extension point used by at least one stdlib module | ROADMAP G3, GLOSSARY | yes | schema type registry: `grep -rlE '\bs\.register\(' packages/std-*/src`, 8 packages; check rule registry (`defineRule`): 13; capability registry (`register` from `@keel/ctx`): 3 (std-geo, std-sessions, std-tokens); module manifest: every app module, and a `std` key in 2 (`apps/golden-1/modules/api`, `apps/sessions/modules/ops`); inspector hooks (`@keel/compiler/inspect/inspector`): 4; output formatter registry (`formatter(`): 3 |
| One way per thing (principle 1) | backlog 0034 | yes | no `decode` export in `schema/src/index.ts`, no `uuid` method in `ctx/src/Random.ts` (comment only), no `styles` in `ui/src/index.ts`, no `plan` in `scaffold/src/index.ts`, no `loading` in `router/src/types/FormProps.ts`, no router internals in `router/src/index.ts`, no `TopologySchema` in `server/src/index.ts`: 0 hits each |
| RFC ledger one way (append-only; changes as an Amendment) | RFC.md, WORKFLOW.md | yes | `git log -M --diff-filter=D --name-only -- docs/rfc docs/adr`: 5 paths, each a file rewritten under its own number while a draft (RFC 0072, 0079, 0139; ADR-0061, 0161); no accepted RFC removed |
| No open draft RFC touching a kernel section | RFC.md lifecycle | no | `grep -m1 '^Status:' docs/rfc/*.md`: 0020, 0021 and 0133 to 0147 read `draft`, 0100 and 0101 `proposed`. `git log --grep=rfc:<n>` finds build commits for each but 0147, so 18 are status lines that lag the build, and RFC 0147 (k.return, k.server) is an open draft. ADRs: 15 read `proposed` (0116 to 0124, 0164 to 0169) |
| Implemented RFCs marked `implemented` | RFC.md lifecycle, 0034 plan step 2 | no | 20 RFCs read `implemented`; 108 read `accepted` with their builds merged |
| Assumptions in conformance resolved or accepted | not stated in any doc (see Reading) | no | `grep -rn "ASSUMED" packages/*/conformance`: 18 lines in 18 files (k.evidence 5, k.scaffold 5, k.compat 2, k.deploy 2, k.persist 2, k.forms 1, k.privacy 1). Counting `ASSUMPTION(S)` and `Assumed` too: 105 lines across 31 sections (table, section 2) |
| Two golden apps; evals converge | ROADMAP G3 | yes | `evals/results/2026-11-19-golden-2-none.json` and `2026-11-19-golden-1-api-none.json` converged; earlier dates hold the same; one model run on record (`2026-11-18-golden-2-catalog-claude-sonnet-5-5.json`) |

**Reading.** No doc defines the assumption criterion. This review reads it so: an assumption that names test plumbing (a fixture layout, a temp directory, a harness seam) is accepted as it stands; one that names a public shape the spec does not state is resolved by spec text through an RFC before the flip, since freezing the section otherwise freezes a contract nobody wrote. Examples of each kind:

- Now stated, comment stale: `router/conformance/fixtures.ts:2` says the spec names no router-instance API, and k.router states `createRouter(routes, { ctx, history, mode? })`.
- Unstated public shape: the sim net route `ctx.net.route(url, handler)` (k.sim says a fetch "runs the route" and names no API; 7 `services/conformance` files assume it); k.evidence `runs` and `security.json` field names (`cli/conformance/evidence-failing-run.test.ts:3`, `evidence-security.test.ts:2`); the json-mode `frames` shape (`server/conformance/diag-frames-0095.test.ts:4`).
- Plumbing, accepted: `scaffold/conformance/place-support.ts:2` (place through the real binary), `cli/conformance/compat-support.ts:3` (fixture layout).

"Evals improving" is read as converging on two or more recorded dates: a `none` run replays the committed app and converges in one iteration, so it shows no trend.

## 4. The flip, prepared

In order. Steps 1 to 3 each land as their own RFC unit (RFC, conformance, build) and change one status; step 4 is one commit tagged with the freeze RFC.

1. **k.return** `implemented` to `conformance-covered`, in RFC 0147's build commit. Files: `spec/kernel/k.return.md` line 2; `spec/00-map.md` row `k.return`.
2. **k.hosting** `implemented` to `conformance-covered`, after backlog 0693. Files: `spec/kernel/k.hosting.md` line 2; `spec/00-map.md` row `k.hosting`.
3. **k.shell** `proposed` to `implemented` to `conformance-covered`, after backlog 0692 and 0948. Files: `spec/kernel/k.shell.md` line 2; `spec/00-map.md` row `k.shell`.
4. **All 54 kernel sections** `conformance-covered` to `frozen`, under a freeze RFC with its ADR (RFC.md: a status rule change goes through an RFC). Files:
   - `docs/rfc/NNNN-kernel-freeze.md`, `docs/adr/NNNN-kernel-freeze.md`.
   - `spec/kernel/k.*.md` line 2, 54 files: `sed -i '' '2s/^status: conformance-covered$/status: frozen/' spec/kernel/k.*.md`, then `grep -c '^status: frozen' spec/kernel/k.*.md | grep -c ':1$'` gives 54.
   - `spec/00-map.md`, the 54 rows of the Kernel table only: `sed -E -i '' '/^## Kernel/,/^## Stdlib/ s/\| conformance-covered \|/| frozen |/' spec/00-map.md`.
   - The `**Status:**` line of the 15 kernel package READMEs (`packages/{schema,reactive,store,runtime-dom,compiler,router,forms,ui,check,scaffold,testing,server,services,cli,ctx}/README.md`); today they read `implemented` (6), `proposed` (2: ui, cli) and `conformance-covered` (7).
   - `docs/freeze-review.md` (the table and Status paragraph), `docs/ROADMAP.md` (the G3 and P1 rows), `docs/GLOSSARY.md` (the kernel's "provisionally frozen core": a term definition, the operator's call), `docs/HANDOFF.md`.
   - `tooling/ledger/evidence.json` and `tasks/COVERAGE.md`, regenerated by `node tooling/evidence-report.mjs --markdown` from a clean tree after both apps' `keel test`; they carry each section's status.
   - `tasks/BACKLOG.md` line 0034 and `tasks/0034-freeze/PLAN.md`, closed.
   - Checks: `pnpm ledger --diff` (E1707 treats `frozen` as `conformance-covered`, `cli/src/internal/coverageGaps.ts:9`), `node tooling/budgets.mjs` (the status word gets shorter), `pnpm check`.

## 5. Blocking items

Each line is written to become a backlog line.

1. (medium) shells: k.return conformance and build for RFC 0147, then the status to `conformance-covered`; accept RFC 0147 and ADR-0169 first (backlog 0956, in flight) · testing, cli, scaffold · k.return
2. (medium) conformance: k.hosting bullet 2: observe the client entry's `service({ module })` fetch URL, `credentials: 'include'` and the unset case; the entry's `keel-peer` binding has no public seam, so this may need an RFC for one (backlog 0693; close 0423 as its duplicate) · server, compiler · k.hosting
3. (small) conformance: k.shell bullet 6 asserts the `createCtx` call's `drivers` argument names the package's export (backlog 0692); k.shell's CI paragraph names the macOS Tauri job (backlog 0948); then the status to `implemented` and `conformance-covered` · compiler, spec · k.shell
4. (medium) conformance: the JSON Schema halves of k.schema bullet 16 (`format`), the k.schema API sentence on `pattern: "\\S"` and k.privacy bullet 1 (`x-keel-pii`) have no assertion; assert them through a public path (an MCP tool's input schema, or a public derivation by RFC) · schema, cli · k.schema k.privacy
5. (small) docs: advance the status lines of 18 built RFCs (0020, 0021, 0100, 0101, 0133 to 0146) and 15 ADRs (0116 to 0124, 0164 to 0168) to what they are, and mark the 108 built `accepted` RFCs `implemented` · docs · all
6. (medium) conformance: triage the 105 assumption lines in kernel conformance (`ASSUMED`, `ASSUMPTION`, `Assumed`): drop the stale ones the spec now states (`router/conformance/fixtures.ts:2`), accept the plumbing ones in a list, and state the unstated public shapes by RFC (sim `ctx.net.route`, k.evidence `runs` and `security.json` fields, json-mode `frames`) · all · all
7. (medium) spec: land or defer by decision the open spec-text items on kernel sections: 0346 (k.topology dev start), 0655 (k.server `bearer`), 0656 (k.privacy `[pii]` of an action output), 0904 (k.bundle), 0909 (identity mount in dev), 0954 (k.cli Inspect) · spec · k.topology k.server k.privacy k.bundle k.cli
8. (medium) backlog: sort the 159 open lines naming a kernel section into "before the flip" (changes semantics) and "after" (additive, through an RFC on a frozen section); 16 of them are high or medium · all · all
9. (small) conformance: rewrite the 12 `// Spec:` quotes whose text left their section (section 2 lists them) under one `rfc:` tag · all · all
10. (small) docs: the 15 kernel package READMEs carry a stale `**Status:**` (ui and cli `proposed`); `docs/freeze-review.md` lists k.boundary as `proposed` and misses k.bundle, k.explain and k.return; `docs/ROADMAP.md` counts "38 of 40" kernel sections · docs · all
11. (small) check: the rule consolidation owed before the freeze (backlog 0845, `@keel/check` at its budget) · check · k.check
12. (medium) docs: check the "Tested, not stated" list against the suites and turn each into spec text or a dropped line (backlog 0413) · docs, spec · all
13. (medium, recommended; no doc requires it) tooling: a guard that refuses a commit changing a `frozen` section's text without an `rfc:NNNN` tag, as S0008 does for `conformance/`; today principle 8 has no tool behind it · tooling · all
