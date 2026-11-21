# ADR-0198: k.ui and k.a11y: `Text role` for live regions, and E1826 for a status region inserted with its text (RFC 0176)

**Status:** proposed (for the orchestrator to accept).

**Context.** `Text` takes no `role`, so app copy that a screen reader should hear goes through `Part`, the widget surface. A result line that appears after an action is usually a conditional child; inserted with its text, a `status` region is not announced, and nothing in Keel says so or reports it.

**Decision.** `Text` takes `role?: 'status' | 'alert'`, written as the attribute and read at build. A render check, E1826 in `@keel/testing`: after a `fire` or `settle()` that kept the route, an element with `role="status"` the root did not hold, under a parent it did, holding text. `alert` is exempt (an inserted alert is announced). E1826 maps to no WCAG criterion. k.ui and k.a11y read `implemented` until their new clauses are covered.

**Alternatives.** A kernel announcer and document-level region (new surface under the freeze); `Text` filling a status region a task late (`settle()` runs no timers); `live` writing `aria-live` (no role for E1702 or k.head); more roles (no finding); a static check (cannot follow reactive children); mapping E1826 to 4.1.3 (overclaims).

**Consequences.** App copy gets live regions without `Part`. A test of a page that inserts a filled status line fails its render. 4.1.3 stays a person's check in the evidence bundle.
