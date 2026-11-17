# ADR-0140: a blank literal `label` is E1802 (RFC 0118)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** The `@keel/ui` types require a `label` on `Input`, `TextArea`, `Select`, `Checkbox` and on `Box as` `nav` or `aside`, and E1802 is the mapped TypeScript error for a missing one. A blank string satisfies the type: `Box({ as: 'nav', label: '' })` writes `aria-label=""`, an unnamed landmark, and a blank control label leaves the control unnamed. Neither `keel check` nor axe at render reports it, so the ledger counts the criteria as met.

**Decision.**
- D1: `keel check` reports E1802 for a `label` prop of a `@keel/ui` base element whose value is a blank literal (`/^\s*$/`: string, JSX attribute string, or template literal without substitutions), in JSX and in a call's object literal. A per-file rule, so it runs without the type pass and the ledger's static a11y pass counts it.
- D2: all five elements that take `label`, not `Box` only.
- D3: static only. A computed `label` is not checked, and the runtime writes what it yields.
- D4: one code, E1802, "missing or blank a11y-required prop"; no fix.

**Alternatives.**
- A non-blank string type on the props: a generic per element, and white space needs a recursive type.
- A runtime throw or a dropped attribute: a production fallback for an authoring slip, or a second behavior with no effect on assistive technology.

**Consequences.**
- A landmark or control named by a blank literal fails `keel check` and keeps its route's a11y criteria at rung `none`.
- A blank value computed at run time still renders unnamed; render checks and review are the guard there.
