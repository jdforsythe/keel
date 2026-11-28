# ADR-0092: accessibility claims come from axe-core and token contrast, per route and WCAG criterion (RFC 0083)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1, 2, 3 and 6.

**Context.** `docs/A11Y-TARGET.md` and k.testing said the harness ran axe; `packages/testing/src/internal/axe.ts` ran four rules of its own. axe-core 4.14.0 was installed as a devDependency of `@keel/ui` and passed on every base element under happy-dom 21.0.4, with `color-contrast` off because happy-dom computes no colors. E1804 checked contrast only on an element that set both `fg` and `bg`, `direction` could reverse focus order silently, `Input` had no `autocomplete`, and the ledger said nothing about WCAG criteria.

**Decision.** A new kernel section, k.a11y, takes k.ui's required-prop sentence and E1802 and E1804. The harness runs axe-core with the `wcag2a` to `wcag22aa` tags at its existing render-check point (page rules on `renderRoute` only, `incomplete` counted as not run) and replaces `color-contrast` with a check that reads each element's atomic classes and the project's tokens. E1804 extends to the nearest ancestor `bg` in a component and to large bold text; E1820 reports a reversed `direction` over focusable elements; E1821 reports a personal control without `autocomplete`. `keel test` writes `reports/a11y.json`, and k.ledger emits `a11y:<routeId>#<criterion>` at `example` or `none` for each criterion a rule maps to. `textSecondary` darkens to `#6B6B74` (D5).

**Alternatives.**
- Extending Keel's own rule set, rejected: a second accessibility engine to maintain beside a measured, installed one.
- Real browsers inside `keel test`, rejected: no sim determinism and a browser per test run; the golden-3 eval runs axe's own `color-contrast` in Chromium and WebKit once per stage.
- One claim per criterion without routes, rejected: it hides which page fails.

**Consequences.**
- A claim states that the mapped checks passed on a route, never that the criterion is met; criteria no rule maps to are listed in the evidence bundle for a person.
- A component that passed four rules can now fail a WCAG-tagged axe rule; those failures are fixed, not suppressed.
- k.ui goes from 1,498 to 1,421 tokens and keeps its two a11y clauses, so none of its clauses renumber.
