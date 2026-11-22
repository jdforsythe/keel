# RFC 0191: k.a11y, k.testing: focus order checked at render, table state

Status: draft (ADR-0213 accepted). Backlog 0572, 0573, 0580. D1, D3, D4 and D5 are built.

## Decisions
- D1 (0572): E1820 also runs at render. With tokens, an element whose resting atomic classes give `direction` `row-reverse` or `column-reverse`, at the base or any breakpoint, over two or more elements of its sequential focus order (`focusOrder` within it) is E1820 naming its element id. A run records `E1820` among its rules, as it records E1804. The claim map is unchanged (E1820 1.3.2, 2.4.3), so those criteria earn `example` from a passing `renderRoute` run with no static E1820, as every other criterion does, and a `direction` computed at run time is checked.
- D3 (0573): `a11y()` and `find()` state gain `rowindex` and `rowcount`: the integer values of `aria-rowindex` and `aria-rowcount`, present only when the attribute holds an integer.
- D4 (0573, a plain bug): a `th` with `scope="row"` or `"rowgroup"` has role `rowheader` (HTML-AAM), in the compiler's shared table, so `a11y.json` and the harness agree; any other `th` stays `columnheader`.
- D5 (0580): the conformance writer adds a labelled `Box as="nav"` and `as="section"` case to the role agreement clause of k.compiler (no new text).
- D6: no new codes. k.testing goes from `conformance-covered` to `implemented` until its new clause is covered; k.a11y is `implemented`.

## Problem
- k.a11y Claims map 1.3.2 and 2.4.3 to E1820 only, a `keel check` code; a claim needs a render rule mapped to its criterion to have run, so both claims are `none` on every route, however clean, and a `direction` chosen at run time (`direction={wide ? "row" : "row-reverse"}`) is never checked.
- A `th scope="row"` reads as `columnheader`. `aria-rowindex` and `aria-rowcount` have no state key, and E1701 forbids the DOM query a test would use instead, so a virtualised table's position cannot be asserted.

## Proposal
`renderChecks` gains `reversedFocus(root, tokens)` beside the render contrast check: the classes `compileStyles` gives `direction` `row-reverse` and `column-reverse` per breakpoint, each element holding one, and `focusOrder(element)`; two or more is a violation `{ rule: "E1820", element: id }`. A failing run throws E1820 after E1804.

## Alternatives
- **Drop 1.3.2 and 2.4.3 from the claim table** and list them for a person in the evidence bundle. Rejected: the static rule plus the render check is a real check of both criteria for Keel's base elements, whose order is document order by construction.
- **Credit a criterion that only static codes map to** when a passing run rendered the route. Rejected: a render that ran nothing for the criterion is not evidence for it.
- **`focusOrder()` agreement** (equal to document order). Rejected: true by construction for a page with no reversed `direction`, so it adds nothing D1 does not check.

## Spec diff
- **k.a11y** Order and focus gains: "At render, with tokens, an element whose atomic classes give a reversed `direction` at any breakpoint over two or more elements of its focus order is E1820 too, naming its element id." Render checks name E1820 beside E1804. Rules: "E1820 reversed `direction` over focusable elements (static and render)". Conformance gains clause 14.
- **k.testing** a11y: state gains `rowindex?` and `rowcount?`, "the integer `aria-rowindex` and `aria-rowcount`". Conformance gains clause 19.
- **Ledger**: `k.a11y#14` and `k.testing#19` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0191`, from the spec text alone:
- k.a11y 14 (`packages/testing/conformance/`): a `renderRoute` page with tokens whose `Box` takes a computed `direction` `row-reverse` over two `Button`s fails with E1820 naming the `Box`'s id; over one `Button`, or `direction` `row`, it passes; after `keel test` with that passing run and no E1820 from `keel check`, `keel ledger` gives the route's `#2.4.3` and `#1.3.2` rung `example`.
- k.testing 19: a row with `aria-rowindex="2"` in a grid with `aria-rowcount="10"` has `rowindex: 2` and the grid `rowcount: 10` in `find`, a non-integer value no key; a `th scope="row"` is `rowheader` in `a11y()`.
- k.compiler, clause "`<img alt="">`, an unnamed `<section>`, `<td>` and `<li>` with text render with no E1702." (`a11y-json-agreement.test.ts`, `compiler-a11y-no-e1702.test.ts`): a `Box as="nav" label="Main"` and a `Box as="section" label="Recent"` render with no E1702 (0580).
Spec topics: `pnpm spec k.a11y`, `pnpm spec k.testing`, `pnpm spec k.compiler`.

## Build
- `@keel/testing`: `reversedFocus` in `renderChecks`, `E1820` in `a11yRules`; `stateOf` and `A11yState` gain `rowindex` and `rowcount`.
- `@keel/compiler`: `roleFor` maps `th` by `scope`.
- `@keel/cli`: `a11yRuleMap` counts E1820 as a render rule too.
- Skills: keel-testing (the two state keys, E1820 at render).

## Known limits
The render check reads resting classes only: a `direction` set under a state (`states.hover`) is not read. A positive `tabindex` from a host element is not checked here.

## Migration
None: unreleased.

## Token impact
k.a11y about 7,400 to 7,750 characters; k.testing about +300.
