# RFC 0129: a `label` of invisible characters is blank for E1802

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-18). For backlog 0740 (task 0338, lane B). ADR-0151 records it. Extends RFC 0118.

## Problem
k.a11y calls a literal `label` blank when it is `""` or white space, and `packages/check/src/rules/blankLabel.ts` tests `/^\s*$/`. `<Input label={"\u{200B}"} />`, `<Input label="&#x2800;" />` and `<Input label={"\u{3164}"} />` report no E1802 (`it.fails` in `packages/check/test/blankLabel.test.ts`, last `describe`): U+200B ZERO WIDTH SPACE, U+2800 BRAILLE PATTERN BLANK and U+3164 HANGUL FILLER are not white space. Each gives the control an accessible name a reader cannot see, which names nothing; axe-core's render check does not catch these either. The rest of backlog 0740 (parentheses, `as`, `satisfies`, `!`, a wrapped call argument, object spreads) is built.

std.text already defines a visible character for `line` and `para` (RFC 0116 and its amendment): one outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cf` and `M`, and U+2800.

## Proposal
**Rule.** A literal `label` is blank for E1802 when it holds no visible character in std.text's sense: every character is `White_Space`, `Default_Ignorable_Code_Point`, `Cf`, `M` or U+2800. One definition serves both packages, so a title std.text refuses and a label E1802 reports are the same set. The test is on the whole value, so `"a\u{200B}"` and `"\u{2764}\u{FE0F}"` hold a visible character and pass; `"\u{301}"`, a mark with no base, is blank.

**JSX character references.** A JSX attribute string is read with its character references decoded, as the DOM receives it: `label="&#x2800;"` and `label="&#8203;"` are blank.

**Code.** `blank` becomes a test that no character matches `/[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cf}\p{M}\u{2800}]/u`. E1802 stays one code, "missing or blank a11y-required prop"; there is still no fix.

## Alternatives
- `\p{Cf}` plus a list of fillers (U+2800, U+115F, U+1160, U+3164, U+FFA0), as the proposal first drafted: a second definition of "invisible" beside std.text's, and it misses a value of combining marks.
- Leave it: a reader cannot see the label, and no render rule catches it.
- Import std.text's predicate into `@keel/check`: a kernel package would depend on a stdlib one. The regular expression is one line in each.

## Spec diff
k.a11y (before 5,999 characters, 1,500 tokens; after 6,000 characters, 1,500 tokens). Required props, "A blank literal `label` (`""` or white space) is E1802 too;" becomes:
```
A blank literal `label` (no visible character, as std.text `line` defines it) is E1802 too;
```
To pay for it and the new bullet, these prose trims, meaning kept:
- Target: "the ledger and the evidence bundle (k.evidence) say which" becomes "the ledger and k.evidence say which"; "at render (`keel test`), or by a person" loses its comma.
- Required props: "Required a11y props are in the `@keel/ui` types (E1802):" becomes "The `@keel/ui` types require (E1802):"; "(text, or an `Image` whose `alt` names it; no `label`)" becomes "(text or a named `Image`; no `label`)"; "`autocomplete: Autofill`, written as the attribute: an HTML autofill field name from the WCAG 2.2 input purposes (`name`, `email`, `tel`, `street-address`, `bday`, ...) or `off`" becomes "`autocomplete: Autofill` (the attribute): a WCAG 2.2 input-purpose autofill name or `off`".
- Contrast: "atomic classes and their tokens" becomes "atomic classes and tokens"; "with neither, the element is checked at render" becomes "with neither, it is checked at render".
- Claims: "violations, and the test's file" becomes "violations, the test's file"; "Criteria no rule maps to are for a person; the evidence bundle lists them." becomes "The evidence bundle lists the criteria no rule maps to, for a person."
- Rules: E1820 drops "(fix: reverse the children, plain direction)"; Conformance bullet 5 states the fix.

## Conformance diff
k.a11y Conformance, new bullet 11:
```
- Without types, E1802 also fires for `<Input label={"\u{200B}"} />`, `label="&#x2800;"`, `label={"\u{301}"}` and `Input({ label: "\u{3164}\u{200D}" })`, not for `label={"a\u{200B}"}`.
```
One `rfc:0129` commit by the `conformance-writer`: new `packages/check/conformance/E1802-invisible-label.test.ts` citing bullet 11, with a property over generated non-empty strings drawn only from the four classes and U+2800 (each E1802) and the same strings with one ASCII letter inserted (none). The header of `packages/check/conformance/E1802-blank-label.test.ts` (line 1) quotes the old Required props sentence and moves to the new one; its cases stay.

## Migration
No app source changes. An app with a label made only of invisible characters now gets E1802 from `keel check` and gives the control a real name.

## Token impact
k.a11y 1,500 to 1,500 tokens. `@keel/check` grows about 25 bytes gzip against 55,798 of 55,808; the builder shares the `findingAt` closure in `blankLabel.ts` between the JSX and call visitors (about -10). Expected about 55,813 before decoding JSX character references, which costs more if TypeScript's attribute text is raw: over 55,808 either way, so the builder finds the bytes or the operator raises the budget.

## Choices
Each is the drafter's choice; the operator can reverse any of them.
- C1: std.text's visible-character definition, not a list of fillers.
- C2: JSX character references are decoded before the test.

## Amendment (red team 7, M3 and L1)
A JSX attribute string is decoded for numeric references and `&nbsp;` only, and the bundler decodes the JSX named references too: `label="&zwnj;"`, `label="&emsp;"` and `label="&shy;"` ship as U+200C, U+2003 and U+00AD and report no E1802 (red team 7, M3, ran with esbuild). A label of C0 or C1 controls, `"\u0001"`, `"&#0;"` or `"&#x7f;"`, reports none either (L1, ran).

Both fail closed without a table of named references, which `@keel/check` has no bytes for (8 bytes of budget left). A named reference does not count as a visible character: after numeric references are decoded, a literal JSX `label` whose only visible characters sit inside named references is blank, so `label="&copy;"` alone is E1802 and the author writes the character itself, while `label="&copy;2"` passes. A name that is no JSX entity, `&foo;`, which the bundler keeps as text, is read the same way. A control character (general category `Cc`) does not count as visible either, in a JSX string and in a string literal alike.

Choices the operator can reverse:
- A1: a named reference never counts as visible, rather than a table of the references that decode to invisible characters.
- A2: `Cc` joins the invisible classes for E1802 only; std.text `line` keeps its own definition.

Spec diff (k.a11y, 6,007 to 6,000 characters, 1,500 tokens): Required props, "A blank literal `label` (no visible character, as std.text `line` defines it) is E1802 too;" becomes "A blank literal `label` (no visible character, as std.text `line` defines it; a `Cc` control or JSX named reference is not one) is E1802 too;". To pay for it and the new bullet, prose trims with the meaning kept: Contrast "text inside `states.disabled` is exempt, and text without" to "text in `states.disabled` is exempt; text without", "else its nearest ancestor's `bg` in the same component; with neither, it is checked at render" to "else the nearest ancestor's in its component; with neither, render checks it", "come from each element's atomic classes" to "come from atomic classes", "a pair with a non-hex color left out" to "hex colors only"; Order and focus "on an element with two or more focusable base elements under it in its component" to "over two or more focusable base elements in its component", "Harness handles have `focusOrder()`: the ids of focusable elements in sequential order, skipping disabled and hidden ones" to "`focusOrder()` (harness handles): focusable element ids in order, less disabled and hidden ones"; Render checks "with the compiler's `a11y.json` (E1702; passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, E1702 is not checked)" to "with `a11y.json` (E1702; `keel test` passes it from `.keel/` as `render(C, { artifacts })`; absent, unchecked)", "and also runs" to "and runs", "An axe result of `incomplete`" to "An axe `incomplete` result", "are not run" to "are skipped"; Claims "writes every render check" to "writes each render check", "(`A11yRun[]`: route or component, rules run, violations, the test's file, name and outcome)" to "(`A11yRun[]`: target, rules run, violations, test file, name, outcome)", "For each route in `routes.json` and each criterion a rule maps to" to "Per route in `routes.json` and criterion a rule maps to", "every rule mapped to the criterion ran, none was violated and" to "ran every rule mapped to the criterion with no violation, and". Conformance, appended as bullet 12:
```
- Without types, E1802 fires for `label="&zwnj;"`, `label="&copy;"` and `Input({ label: "\u{1}" })`, not for `label="&copy;2"`.
```

Conformance writer: new `packages/check/conformance/E1802-named-reference.test.ts` citing bullet 12, with the four cases, `label="&emsp;&shy;"` and `label="&#0;"` (each E1802), and a property: any generated named reference `&[a-z][a-z0-9]*;`, alone or repeated, is E1802, and with one ASCII letter outside it none. Builder: in `packages/check/src/rules/blankLabel.ts`, `decode` replaces every `&[a-z][\da-z]*;` (any case) with nothing in the same pass as the numeric references, which drops the `&nbsp;` branch (U+00A0 was blank already), and `blank`'s class gains `\p{Cc}`; about 0 bytes net against 8 left. Turn the `it.fails` cases in `packages/check/test/blankLabel.test.ts` that this covers into passing ones.
