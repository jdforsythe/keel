# ADR-0022: Conformance completion for k.compiler, k.component, k.runtime, k.ui (RFC 0033)

**Status:** accepted
**Context.** Backlog 0058 and a strict re-audit found partial or missing assertions in all four sections: E1005 skipped, `ids.json` resolved by `getElementById`, resume state as a todo, children tested with stand-ins, axe as a 4-rule subset, a Checkbox `change` that never changed state. D1 of task 0034 forbids flipping a section with a partial clause.
**Decision.**
- Assert each clause with real parts: compiled JSX, `@keel/ui`, the harness, the Vite-written `.keel/` files, and axe-core in ui conformance. Tests that need packages later in the dependency order than the section's own package live in `testing/conformance` (S0003).
- Each compiled component instance runs in its own reactive scope, so the `props.children` thunk renders in the child's scope.
- `evaluate` accepts extra modules for such suites.
- Flip k.component and k.ui.
**Alternatives.** Re-ordering `deps.json`: creates cycles. Counting `check()` as `keel check`: a proxy for a CLI run (D1).
**Consequences.** k.compiler waits on the cli reading `.keel/*.json` in `keel check`. k.runtime waits on an island pipeline in which a server page with islands loads the entry and one without loads none. One scope per component instance costs one node per instance. Instance-level disposal now frees what a component created.
