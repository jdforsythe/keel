# ADR-0213: k.a11y, k.testing: E1820 at render, table state keys, `th` by scope (RFC 0191)

**Status:** proposed (lane decision; for the orchestrator and the operator to confirm). RFC 0191 D2 (a harness click moves focus) is not decided here.

**Context.** Claims for WCAG 1.3.2 and 2.4.3 map only to E1820, a `keel check` code, so no render run earns them and a `direction` computed at run time is never checked. A harness `th scope="row"` reads as `columnheader`, and `aria-rowindex` and `aria-rowcount` have no state key while E1701 forbids the DOM query a test would use.

**Decision.** E1820 also runs at render with tokens: an element whose resting atomic classes give a reversed `direction` at any breakpoint over two or more elements of its focus order fails, naming its id, and the run records E1820, so 1.3.2 and 2.4.3 earn `example` as other criteria do. `find` and `a11y()` state gain `rowindex` and `rowcount` (integer aria values). `th` with `scope` `row` or `rowgroup` is `rowheader` in the shared role table.

**Alternatives.** Drop 1.3.2 and 2.4.3 from the claim table (loses a real check); credit criteria with static codes only (a render that ran nothing for them is not evidence); `focusOrder()` agreement (true by construction).

**Consequences.** k.a11y gains Conformance clause 14 and k.testing clause 19, at rung `none`; k.testing goes to `implemented` until covered.
