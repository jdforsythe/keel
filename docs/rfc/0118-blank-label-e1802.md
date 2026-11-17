# RFC 0118: a blank literal `label` is E1802

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0474. ADR-0140 records it.

## Problem
`Box({ as: 'nav', label: '' })`, `<Box as="nav" label="  ">` and `<Input label="" />` type-check: the `@keel/ui` types require a `label` on `Input`, `TextArea`, `Select`, `Checkbox` and on `Box as` `nav` or `aside`, and a blank string is a string. `Box` then writes `aria-label=""` (`packages/ui/src/elements/Box.ts:34`), which names nothing, so the page has an unnamed `nav`; the controls get an empty `<label for>`, so the control has no accessible name. E1802 is the type rule for a missing a11y-required prop: `mapTsDiagnostic` maps TypeScript's "property is missing" errors to it (`packages/check/src/internal/mapTsDiagnostic.ts:137-142`), and nothing reads the value. axe at render does not flag an unnamed `nav` either. The ledger then counts 1.3.1, 2.4.4 and 4.1.2 as met for a route whose landmark or control has no name.

## Proposal
**Rule.** `keel check` reports E1802 for a `label` prop of a `@keel/ui` base element (`Box`, `Input`, `TextArea`, `Select`, `Checkbox`, as imported from `@keel/ui`, aliases followed) whose value is a blank literal: a string literal, a JSX attribute string, a JSX expression container holding one, or a template literal without substitutions, whose text matches `/^\s*$/`. Both forms are read: the JSX attribute and the `label` property of the object literal passed as the first argument of a call (`Box({ as: "nav", label: "" })`). The message is `<Box> label is blank; it must name the landmark` (controls: `<Input> label is blank; it must name the control`), under 90 characters, `see` k.a11y, no `fix`: the name is the author's choice, as for a missing prop (`packages/check/conformance/fix-diffs.test.ts:340`).

It is a per-file kernel rule (`packages/check/src/rules/blankLabel.ts`, registered in `KERNEL_RULES`), so it runs without the type pass, and `keel ledger`'s static a11y pass (`packages/cli/src/internal/a11yFindings.ts`, which keeps E1802 from the rules run without types) counts it: a route with a blank literal `label` gets rung `none` for E1802's criteria. E1802 stays one code: "missing or blank a11y-required prop".

**Runtime.** Unchanged. A `label` computed by an expression or getter is not checked statically, and the elements write what it yields: an empty `aria-label` and no `aria-label` are the same to assistive technology, so a second runtime path (dropping the attribute) would change nothing a person meets.

## Alternatives
- A `NonBlank` string type on the props (`label: S extends "" ? never : S`): needs a generic on every element, misses white space without a recursive template type, and the error text would be a TypeScript one mapped by message shape.
- A runtime throw on a blank `label`: a throw in render is a Boundary fallback in production for an authoring slip `keel check` can see first (default 6: refuse statically where possible).
- `Box` writes no `aria-label` for a blank value: no change for assistive technology, and a second behavior to specify.
- Box only (the backlog item's wording): a blank `Input` label is the same defect, an unnamed control.

## Spec diff
k.a11y (before 5,722 characters, 1,431 tokens; after 5,999 characters, 1,500 tokens). Whole new text of each changed paragraph:

Required props:
```
**Required props.** Required a11y props are in the `@keel/ui` types (E1802): `Heading level`; `Image alt` or `decorative`; `label` on `Input`, `TextArea`, `Select`, `Checkbox`, and on `Box as` `nav` or `aside` (`aria-label`; optional on other landmarks); `Link to: Href` with text; `Button` children (text, or an `Image` whose `alt` names it; no `label`). A blank literal `label` (`""` or white space) is E1802 too; a computed one is unchecked. `Input`, `TextArea` and `Select` take `autocomplete: Autofill`, written as the attribute: an HTML autofill field name from the WCAG 2.2 input purposes (`name`, `email`, `tel`, `street-address`, `bday`, ...) or `off`.
```

Rules:
```
**Rules.** E1802 missing or blank a11y-required prop · E1804 text below its contrast threshold (static and render) · E1820 reversed `direction` over focusable elements (fix: reverse the children, plain direction) · E1821 a control bound to a `.pii()` field without `autocomplete` (render).
```

Conformance, one bullet appended at the end (bullet 10):
```
- `keel check` without types reports E1802 for `<Box as="nav" label="">` and `Input({ label: " " })`; `label="Main"`, `label={name}` and a `store` option `label: ""` report none.
```

No other k.a11y text changes. k.ui's Rules line already points E1802 to k.a11y and is unchanged.

## Conformance diff
One `rfc:0118` commit by the `conformance-writer`:
- New `packages/check/conformance/E1802-blank-label.test.ts`, citing k.a11y Conformance bullet 10 and the Required props sentence: `check()` with `types: false` over a `.tsx` component and a `.ts` call reports E1802 for `<Box as="nav" label="">`, `<Box as="aside" label={"  "}>`, `Box({ as: "nav", label: "" })`, `Input({ label: " " })`, `<Select label={``} …>` and `<Checkbox label="\t" …>`, each with `see` k.a11y and no `fix`; reports none for `label="Main"`, `label={name}`, `label={`${x}`}`, a `Select` option's `label: ""`, a `store(..., { label: "" })` option and a non-`@keel/ui` component's `label=""`. A property test over generated white-space strings (seed 1337) reports E1802 for each.
- No existing conformance file changes. `packages/check/conformance/fixtures-by-code.ts:823` keeps its E1802 fixture (a missing `Button` child); `packages/check/conformance/E1303-secret-in-state.test.ts:102` uses `store({}, { label: '' })`, which is not a base element and stays clean under the new rule; `packages/ui/conformance/rules-e1801-e1802-types.test.ts` and `box-label-0091.test.ts` assert the types, which do not change.

## Migration
None for correct apps. An app with a blank literal `label` gets E1802 from `keel check` and names the landmark or control. In this repo the lane greps `apps/`, `modules/` and `packages/*/src` for blank `label` literals on base elements; none were found when this RFC was written.

## Build order
1. Orchestrator: `spec/kernel/k.a11y.md` (applied with this RFC). The `conformance-writer`: the conformance diff.
2. One check lane owns `packages/check/src/rules/blankLabel.ts` (new), `packages/check/src/internal/KERNEL_RULES.ts` (register; the doc comment's list of where E1802 comes from), `packages/check/src/internal/EXPLANATIONS.ts` (the E1802 entry names the blank case, within 120 tokens), `packages/check/test/**` (rule unit tests and mutants), `packages/check/README.md` (the Invariants line names E1802's two sources), and a changeset (`@keel/check` minor: a new finding). It runs `check`, the check suite once, the cli a11y ledger suite once, and `pnpm budgets` (`@keel/check` 53.5kb).
3. Orchestrator: ledger, backlog 0474 closed, HANDOFF.

## Token impact
k.a11y 1,431 to 1,500 tokens (5,722 to 5,999 characters). No other section changes.

## Choices
- C1: every base element `label` (the four controls and `Box`), not `Box` only: a blank control label is the same unnamed element, and one rule is simpler to state.
- C2: blank is `/^\s*$/` on the literal's text (JS white space, so U+00A0 counts).
- C3: static only. A computed `label` is not checked, and the runtime writes what it yields: no runtime throw (a production fallback for an authoring slip) and no second attribute behavior (no change for assistive technology).
- C4: the code stays E1802 ("missing or blank"), so the ledger's criteria map and the cli's static code list need no change.
- C5: no `fix`: the name is the author's.
