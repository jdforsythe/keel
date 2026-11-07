# RFC 0033: Conformance completion: k.compiler, k.component, k.runtime, k.ui

Status: accepted (ADR-0022)

## Problem
The freeze review (docs/freeze-review.md §1, backlog 0058) and a strict re-audit of the current spec text (k.compiler now has 14 clauses) found clauses in these sections asserted only in part. Under task 0034 D1 that blocks `conformance-covered`, and D5 requires a numbered RFC to edit conformance on `implemented` sections. k.component and k.ui were reported covered, but their status lines still read `implemented`, and the re-audit found partial clauses there too.

## Proposal
The conformance-writer adds tests, or adds assertions to partial ones, for each clause below. Whatever they expose is fixed. A section flips only when every clause is fully asserted.

| section | clause (audit) | test that covers it |
| --- | --- | --- |
| k.compiler | `.keel/` byte change → E1005 (skip) | `testing/conformance/compiler-keel-dir-tamper.test.ts`: real artifacts from the Vite plugin build; property over file, byte and replacement (seed 1337, 100 runs) → E1005 on exactly that file; clean counterpart. Compiler's `keel-dir-tamper` skip removed |
| k.compiler | `ids.json` keys via harness `find(id)` (getElementById; flat trees) | `testing/conformance/compiler-ids-find.test.ts`: generated nested trees with explicit and derived ids, one entry per source element, tag per entry, `find(id)` for every key, E1705 for others; `If` case |
| k.compiler | static component: one template, no bindings (`on` unchecked) | `compiler/conformance/static-single-template.test.ts`: `on(` counted; property over static trees, mounted structure |
| k.compiler | `srcdoc` and `vbscript:` (bound only on href, src) | `compiler/conformance/url-srcdoc-vbscript.test.ts`: all seven URL attributes bound, case and whitespace/control variants → `about:blank`; literals E1003 |
| k.compiler | syntax error only E1000 in `routes.ts` (presence only) | `compiler/conformance/build-eval-routes.test.ts`: every build warning is E1000 at `routes.ts:<line>:<col>` |
| k.compiler | no E1702 for `alt=""`, `section`, `td`, `li` (vacuous) | `testing/conformance/compiler-a11y-no-e1702.test.ts`: entries pinned; a changed role or name source throws E1702 naming the id |
| k.component | children as `props.children` in the child's scope; base element JSX text (no test does both with real parts) | `testing/conformance/component-children-jsx.test.ts`: compiled JSX, real `@keel/ui`, `find(id)`; thunk owner is the child's scope, not the parent's |
| k.runtime | `mount`/`dispose` zero subscriptions (no count) | `runtime-dom/conformance/mount-dispose.test.ts`: `inspect()` edges back to the pre-mount set |
| k.runtime | resume: `state()` equals snapshot (todo); fire by id same state and DOM (textContent only) | `testing/conformance/runtime-resume-state-fire.test.ts`: compiled island with a store and a client-only signal; identity, store states equal the snapshot, K clicks by id equal harness `render`/`fire`/`state()` and a client-only `mount` in state, `find` text and markup. `runtime-dom/conformance/resume-identity.test.ts`: todo replaced by a store snapshot property; store-writing fire test added |
| k.runtime | page with no islands loads no runtime JS (todo) | none; see Verdict |
| k.ui | identical style props → identical class lists (CSS usages only) | `ui/conformance/identical-style-props.test.ts`: rendered `classList` of two Box/Text, one rule per class |
| k.ui | no axe violations (harness 4-rule subset) | `ui/conformance/base-elements-axe-core.test.ts`: axe-core 4.14 on every base element; image-alt and button-name counterparts |
| k.ui | `fire(id,'change')` passes the new checked state (state never changed) | `testing/conformance/ui-events-fire.test.ts`: `true` after a click checks it, `false` after it unchecks; exact Select value |

## Alternatives
Spawning `keel check` from testing: today it fails (below), and the cli is not in this group. Counting the harness rule subset as axe: a stand-in (D1).

## Spec diff
Status lines only (spec/kernel/k.component.md, k.ui.md; spec/00-map.md rows). No clause text changes.

## Conformance diff
Added: the `testing/conformance/compiler-*`, `component-children-jsx`, `runtime-resume-state-fire` files and `ui/conformance/base-elements-axe-core.test.ts`. Assertions added to `static-single-template`, `url-srcdoc-vbscript`, `build-eval-routes`, `mount-dispose`, `resume-identity`, `identical-style-props`, `ui-events-fire`; none removed. Removed: `compiler/conformance/keel-dir-tamper.test.ts` (a skip, now in testing).

## Implementation
- Every compiled component instance runs in its own `scope`, a child of its caller's and disposed with it (the `uses` scope generalized). Before, all components of a mount shared one scope, so a `props.children` thunk ran in the parent's scope.
- `evaluate(code, modules?)` (`@keel/compiler/testing`) takes extra modules, so testing suites can run compiled JSX importing `@keel/ui`.
- Dev dependencies: `axe-core` (ui), `@keel/store` (runtime-dom).

## Verdict
- k.component (5/5), k.ui (7/7): `conformance-covered`.
- k.compiler (13/14) stays `implemented`. The E1005 clause holds for the k.check pipeline, but `keel check` never reads `.keel/*.json`: cli `checkCommand` passes only `codeFiles` (`CODE_FILE`, code extensions) to `check()`. A tampered `.keel/ids.json` gives `ok check 0 files, 0 errors`. This needs a fix in `packages/cli` (k.cli group), then a test that spawns `keel check`.
- k.runtime (9/10) stays `implemented`. No islands → no runtime JS has no test. The island pipeline is not wired end to end. The compiler marks no islands. `@keel/server` documents carry no `data-k`, no region markers and no module script, so no page loads runtime JS and `resume` runs only on hand-built markup. The test belongs in k.server conformance once a page with islands loads the entry.
- Untriggered Rules codes (D3, not blocking): E1251, E1252, E1254, E1803, E1805, E1806 (backlog 0062).

## Migration
Compiled components gain one scope each. Primitives a component creates are now disposed with that instance, not only with the whole mount.

## Token impact
Status words only.
