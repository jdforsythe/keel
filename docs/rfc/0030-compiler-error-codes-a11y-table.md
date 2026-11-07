# RFC 0030: Compiler error codes, E1501 scope, one a11y table

Status: accepted (ADR-0019)

## Problem
Backlog 0041, 0046, and the k.compiler part of 0100.
- **E1000.** `compile()` reported E1000 (`syntax error: ` plus the parser message cut at 70 chars), but still ran the other rules on oxc's recovered AST and emitted the unparsed source as output. At build-time evaluation (`evaluateProject`, d29117a) a syntax error never reached E1000: esbuild re-parsed the passed-through source and the build rejected with `Build failed with 1 error: r/syntax.ts:1:55: ERROR: Expected "}" but found ";"`, with no code (same for `tokens.ts`).
- **E1501.** Every non-absolute literal in any URL attribute was E1501: `<img src="logo.png">`, `poster="p.jpg"`, `xlink:href="sprite.svg#i"`, and `<a href="docs/guide.pdf">` all read as route references.
- **Evaluation failures.** A `routes.ts` that threw rejected with the bare message (`routes boom`, no code). One without a `routes` export rejected with esbuild's `No matching export ... for import "routes"`. Internal failures were a plain `Error` (`keel: internal compiler failure during build-time evaluation: ...`). E1807's wider scope (a `tokens.ts` that throws or exports no tokens) was in code only.
- **a11y.json vs harness (testing PLAN D22).** The compiler and `@keel/testing` kept separate role tables, so E1702 raised false alarms. The compiler gave `img` for `alt=""` (harness: `presentation`) and `region` for every `<section>` (harness: `generic` unless labelled). Its name-from-content list included `listitem` and lacked `gridcell`, `menuitemcheckbox`, `menuitemradio`, and `sectionhead`. A dynamic `role` or input `type` fell back to the implicit role.

## Proposal
- E1000 sits at the parser's location, with message `syntax error: <parser message>` on one line under 90 chars. The file gets no other rule, no elements, no deps, and no output. During build-time evaluation, the esbuild plugin turns E1000 into `E1000 <path>:<line>:<col> <message>` problems, so no build failure is thrown.
- E1501 covers only navigation attributes (`href`, `action`, `formaction`, `Link to`) holding a literal path that starts with `/` or matches a `routes.json` path pattern (`compile(..., { routes })`; `:name` matches one non-empty segment). An empty path such as `""` or `?q` is the current page. `src`, `poster`, `ping`, and `xlink:href` are assets.
- Build-time evaluation: a thrown error carrying an E code keeps it. Otherwise, a `tokens.ts` that throws or exports no tokens is E1807 (k.ui). A `routes.ts` that throws or exports no `routes` is **E1006**, and that manifest contributes no routes while the others still load. Each `routes.ts` is imported dynamically so its throw can be caught.
- **E1049**, internal compiler failure: an `Error` with `code: "E1049"` and message `internal compiler failure: <message verbatim>`. It has no app location and is never reported under an app code. `compile()` rethrows anything thrown inside it as E1049, and so does `evaluateProject` for a codeless throw from the kernel side or a missing result.
- One table, owned by the lowest package: `@keel/compiler/a11y` (`roleFor`, `IMPLICIT_ROLES`, `INPUT_ROLES`, `NAME_FROM_CONTENT`, `LABELABLE`). `roleFor(tag, attr)` takes an attribute lookup that returns a value, `null` when the attribute is absent, or `undefined` when its value is not known statically. The compiler records `undefined` as role `null` (not compared). The harness reads the DOM and maps a tag missing from the table to `generic`. `@keel/testing` imports the table, which `tooling/deps.json` allows (compiler sits before testing). The name source follows the harness order: `presentation` and `none` take no name, then `aria`, then `label` (form controls), then a non-empty `alt` on `img`, `area`, or `input type=image`, then `text` for non-control roles whose WAI-ARIA 1.2 Name From includes contents.

Code choice. The next free E10xx after E1005 is **E1006**: a `routes.ts` failure belongs to k.compiler's evaluation, not to k.router's manifest rules (E150x), which keep their own codes when thrown coded. For the internal failure, backlog 0100 proposed E1099, but the map gives k.compiler the block E1000-E1049 and puts E1099 in k.cli's block (E105x = E1050-E1099). **E1049**, the last code of k.compiler's block, keeps the block rule without a map change.

## Alternatives
- E1099: crosses into k.cli's block. A new map row for it costs map tokens and breaks "blocks of 50".
- E1501 for every relative literal: false alarms on assets, and an `<a href>` to a static file.
- Skipping the name check when `alt` is dynamic: `A11yEntry.name` has no "unknown" value, and widening it changes a public type that the inspector app parses. Instead, a dynamic `alt` counts as non-empty; the spec says "literal `alt=\"\"`".
- Copying the table into testing with an agreement test: two copies drift, as the URL lists did before (ADR-0014).

## Spec diff
k.compiler:
- URL policy: the navigation/asset split and the E1501 scope.
- Artifacts `a11y.json`: the one table and its role and name rules.
- New paragraph, Build-time evaluation.
- Rules: E1000 restated; E1006 and E1049 added.
- Conformance: four bullets appended.

Map unchanged (E1006 and E1049 fall in E100x). k.ui E1807 is unchanged; k.compiler states when it applies.

## Conformance diff
Added only:
- compiler: `E1000-syntax-error`, `E1501-asset-urls`, `build-eval-routes` (E1006, kept E1502, and E1000 through the Vite plugin's `buildStart` warnings).
- testing: `a11y-json-agreement` (no E1702 for `<img alt="">`, an unnamed `<section>`, `<td>`, and `<li>`; a11y.json entries pinned).

## Migration
- Vite build-time problems print as `keel: <code> ...` instead of `keel: keel.css: <code> ...`.
- `compile()` emits no output for a file that does not parse.
- Apps that relied on E1501 for `src` paths get none.
- `Image src` is still typed `Href` in `@keel/ui`, so `keel check` still reports E1501 there through type mapping. Relaxing it is a k.ui follow-up.
- Committed `.keel/a11y.json` of golden-1 and inspector regenerate byte-identical.

## Token impact
k.compiler 1098 -> 1483 (<= 1,500). Map unchanged.
