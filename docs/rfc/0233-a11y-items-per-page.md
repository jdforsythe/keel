# RFC 0233: k.a11y: a11y items per page route of a project, with the project's artifacts by default

Status: accepted (ADR-0255), accepted by the orchestrator on 2026-11-25, to be confirmed by the operator. Amends k.a11y (Render checks, a new Artifacts paragraph, Claims, Conformance), k.ledger (Ledger, File, Rules, Conformance), k.evidence (one table row), the map. From the task 0963 lane that wrote a11y tests for every page route.

## Decisions
- D1: the item is `a11y:<project>:<routeId>#<criterion>`, `<project>` the project's directory relative to the one `keel ledger` runs in (`apps/golden-1`, `examples/static-client`), `.` for that directory itself.
- D2: an item exists per page route: an entry of `routes.json` with a non-null `path` and no `api: true`. Layouts and API entries have none.
- D3: a layout is covered through the pages it wraps: a page's item counts only from `renderRoute` runs, which render the whole chain, and the static codes counted against a page are those in the modules of its chain. A layout no page route's chain holds is W1731 from `keel ledger`.
- D4: under `keel test`, a harness render given no `artifacts` takes the project's `.keel/a11y.json` and the `tokens` export of `tokens.ts`, each if present; a `tokens.ts` that throws, exports no `tokens` or fails `TokenSchema` makes the render throw E1807. Explicit `artifacts` replace the defaults whole; `artifacts: {}` is the opt-out. Outside `keel test` a render takes only what it is given.
- D5: the counting rule is stated exactly: over the passing tests' `renderRoute` runs of the route, every render rule mapped to the criterion (at least one) is in some run's `rules`, none is in any run's `violations`, and no static code of the criterion in the chain's modules.

## Problem
Three defects, each checked in the tree:
1. **No project in the key.** `a11yClaims` (`packages/cli/src/internal/a11yClaims.ts`) builds `a11y:${route}#${criterion}`. Four route ids exist in more than one project (`sessions.ingest`, `sessions.list`, `sessions.tally` in `apps/sessions` and `apps/household`; `app.home` in eight examples). The committed ledger holds 1,120 a11y entries over 940 distinct keys: 80 keys twice. `committed.get(item)` (the kept rung of a project with no report) reads whichever project's entry the map kept last, so a claim can be credited to the wrong app.
2. **`keel test` passes no artifacts.** k.a11y says `keel test` passes `a11y.json` "from `.keel/` as `render(C, { artifacts })`" and `HarnessArtifacts.ts` says "(passed by `keel test`)". `testCommand.ts` starts vitest with `KEEL_TEST=1` and passes nothing; `renderChecks.ts` runs E1702 only with `a11y`, E1804 and E1820 only with `tokens`. So criteria 1.3.2 and 2.4.3 (E1820), 1.4.3 (E1804) and 4.1.2 (E1702) get evidence only when a test hands `artifacts` in by hand. Fifteen projects carry a copied `test/artifacts.ts` (eighteen test files import one); the household carries none, so its runs never ran those rules.
3. **Items no test can cover.** Claims says "Per route in `routes.json`": API entries (`api: true`) and layouts (`path: null`) get items, and `renderRoute` refuses both ids (E1501). In the household 18 of its 25 entries are of this kind.

The counting rule the code applies (`a11yRuns` keeps runs of passing tests; `a11yClaims` takes the union of `rules` and of violated rules over the route's runs) is not what the spec sentence says ("a passing `renderRoute` test ... ran every rule ... with no violation" reads as one test).

## Proposal
### The key
`a11y:<project>:<routeId>#<criterion>`. Export items name an app `<app>:` by its folder under `apps/`, but a11y projects also live under `examples/` (no export items there) and an app's own `keel ledger` (`keel evidence`) runs in the project, where a folder name would depend on the checkout. The directory relative to the run is unique, deterministic, and the same path the evidence line already names (`example apps/golden-1/reports/a11y.json`). A route id holds no `:`, so the route is the text after the last `:` before `#`. `--scope a11y:apps/golden-1:` selects one project's items.

### Page routes, layouts, redirects
A page route has a `path` and no `api: true` (k.router Artifacts, k.api). A page route is defined by `path` and `api` alone: an entry's `actions` and `guard` do not change it. Every page binds a `component` (k.contract Binding), and its item comes from the render of its GET; its action's answer is k.server's.

A layout has no item. `renderRoute` renders the route's chain, so each page run checks its layouts' markup; and `keel check`'s static codes in a layout's module (its `modules/<module>/` folder, the `module` its `routes.json` entry names) now count against each page it wraps (the code reads only the page's module). A layout whose pages exist but have no passing render shows as those pages' items at `none`. A layout no page route's chain holds renders nowhere: `keel ledger` reports W1731 at the project's `.keel/routes.json`, naming it. A warning, not an error: a layout with no page yet harms no person and the item count does not move.

### Default artifacts
Under `keel test` (`KEEL_TEST=1`), `render`, `renderRoute` and `resumeDocument` given no `artifacts` take the project's in the working directory. Absent files mean the rules do not run: no `tokens.ts` gives no E1804 or E1820 at render, so 1.4.3, 1.3.2 and 2.4.3 stay `none`; no `.keel/a11y.json` gives no E1702, so 4.1.2 stays `none`. The ledger shows it; nothing is claimed. A broken `tokens.ts` is E1807, the code `keel check` and the build already give it. Explicit `artifacts` replace the defaults whole: one source per render, and `{}` is the one way to opt out; the run's `rules` then lack those rules, so that run is evidence for none of their criteria. Outside `keel test` nothing is defaulted, and no run outside it reaches `reports/a11y.json`, so nothing is claimed from it.

### Old keys
No migration: nothing is released. `keel ledger --write` drops every committed item that is not a page route's item of the current form, as it drops an item whose route is gone; the kept rung applies only to an item of the current form, so a project with no report on disk writes its new items at `none` until `keel test` runs in it. `--diff` does not report removed items (k.ledger, unchanged), so it is silent on the change; `node tooling/ledger-fresh.mjs --a11y` reports each old key as "in the ledger file and not in the tree" and each new one as "in the tree and not in the ledger file" until the orchestrator regenerates the ledger on the main line after `keel test` in every app and example (D100).

### Expected items after the build
Page routes times 20 criteria: golden-1 3 (60), golden-2 4 (80), household 7 (140), inspector 1 (20), sessions 1 (20), client-only-api 2 (40), codemod-place 1, compose-peers 1, host-component 1, links-in 2 (40), native-capacitor 1, native-tauri 1, openapi-import 1, shell-mount 3 (60), static-client 1, third-party-origin 1 (20 each for the ones). Total 31 page routes, 620 items, all keys distinct; today 1,120 entries. No W1731: every layout in the tree wraps a page.

## Alternatives
- **The folder name as project (`golden-1`, like export items).** Not unique across `apps/` and `examples/`, and in an app's own run it depends on the checkout's folder name.
- **Items per layout too**, derived from the pages under it. Counts each layout's markup twice in the public number and adds 80 items that say nothing a page item does not.
- **Merge explicit `artifacts` over the defaults.** Two sources per render, and no way to say "none" for one key without `undefined` values the strict profile refuses.
- **Default the artifacts in every vitest run.** A package's own tests have no project; and only `keel test` writes the report the ledger reads.
- **A `keel check` error for a pageless layout.** A std module may ship a layout an app does not use yet; the concern is evidence, so it belongs with the ledger.

## Spec diff
Applied in this commit.
- k.a11y (to `implemented`): Render checks say E1702 runs given `a11y.json` and E1804 given tokens; a new **Artifacts** paragraph (D4); Claims defines a page route, the key, the counting rule over runs, the chain's modules and W1731; one Conformance clause is reworded for the key (#8) and seven are added at the end (#17 to #23), so no clause is renumbered.
- k.ledger (to `implemented`): the item form; File drops committed items that are not a current page route's item; Rules gain W1731; three Conformance clauses reworded for the key and page route.
- k.evidence: the `a11y.json` row says per page route.
- Map: k.a11y and k.ledger read `implemented`. W1731 is in the E17xx block k.ledger owns.
- Sizes: k.a11y about 2,980 tokens, k.ledger about 2,450, both under 3,100. The map does not grow.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/a11y-ledger-claims.test.ts`: rewritten for the reworded clause (keys `a11y:.:m.r#1.4.3`); it gains the two-projects clause.
- `packages/cli/conformance/a11y-ledger-page-routes.test.ts` (new): page, layout, pageless layout (W1731), API entry; E1802 in a layout's module.
- `packages/cli/conformance/a11y-default-artifacts.test.ts` (new): the defaults under `keel test`, `artifacts: {}`, no `tokens.ts`, E1807, plain vitest, and the two-runs union. Through the real `keel` binary, as `a11y-ledger-claims.test.ts` does.
- `packages/cli/conformance/ledger-kept-claims.test.ts`: its three clauses reworded (key `a11y:.:r#1.4.3`, `routes.json` entry `r` given `path: '/r'`; today it is `{}`, which is no page route).
- `packages/cli/conformance/a11y-ledger-e1820-0191.test.ts`: its clause is unchanged, but it asserts `a11y:m.r#…`; the key becomes `a11y:.:m.r#…`.
- No other conformance file names an a11y item. The `a11y: {}` hits in `inspect*`, `keel-report-*` and `capture-nothing-to-save` are the inspect document's field, unaffected.

## Migration
None. Unreleased. The ledger is regenerated on the main line.

## Token impact
Spec: k.a11y +826 tokens, k.ledger +66, k.evidence +4. Runtime: `@keel/testing` reads two files once per test process under `keel test`; size to measure against its budget in the build.

## Build plan
- `packages/cli/src/internal/a11yClaims.ts`: page routes only, `<project>` from the routes file's directory (`.` for the root), static codes over the chain's modules, W1731; `A11yClaim` gains `project`; `ledgerCommand.ts` drops committed items of no current page route.
- `packages/testing`: the default artifacts under `KEEL_TEST=1` (a setup `keel test` adds, loading `.keel/a11y.json` and `tokens.ts` once per process); `HarnessArtifacts.ts` doc says what it is. `tooling/vitest-config.ts` gives `vitest run` in an app the same, so `pnpm test` and `keel test` agree.
- Delete every `test/artifacts.ts` in `apps/*` and `examples/*` (fifteen files) and the `artifacts` arguments that pass it (eighteen test files). Household's runs then run E1702, E1804 and E1820 for the first time: expect findings to fix.
- `packages/cli/test/*` a11y tests, `tooling/test/ledger-fresh.test.ts` and `tooling/evidence.mjs` readers for the new key; a changeset; `tasks/BACKLOG.md`.

## For the operator
1. **`<project>` is the relative directory** (`apps/golden-1`), not the export items' folder name. Recommended: unique and deterministic.
2. **Explicit `artifacts` replace the defaults whole**; `{}` opts out. Recommended: one source per render.
3. **A pageless layout is a warning (W1731)** from `keel ledger`, not a check error.
4. **Static codes in a layout's module count against every page it wraps.** Recommended: the layout is part of what a person on that page meets.
