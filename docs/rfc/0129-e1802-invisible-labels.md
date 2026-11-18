# RFC 0129: a `label` of invisible characters is blank for E1802

Status: accepted (orchestrator under the owner's standing leave, 2026-11-18). For backlog 0740 (task 0338, lane B). ADR-0151 records it. Extends RFC 0118.

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
