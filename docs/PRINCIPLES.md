# Principles

Each principle names its consequence. Reviews cite these by number.

1. **One way.** Every alternative is a hallucination target. No dual APIs. Deprecation is removal at a major.
2. **No action at a distance.** Nothing outside a file changes what that file does. No global cascade, no context providers, no ordering invariants, no auto-imports.
3. **Locality and addressability.** One export per file; filename equals export. Every component, element, state path, and route has a stable string ID.
4. **Everything is a schema.** Declared once with types; validation, codecs, generators, docs, mocks, and tests derive from it. Closed vocabularies wherever a string would do.
5. **The checker says how to fix it.** Every diagnostic has a stable code, a location, one line of message, and a fix diff when one exists.
6. **The runtime is queryable.** State, dependency graph, render tree, a11y tree, and transaction log are tool endpoints.
7. **Structure is an operation.** Scaffold and codemod are first-class; multi-file consistency is never a hand edit.
8. **Small, frozen, spec'd surface.** The kernel spec never changes semantics once frozen. No task needs more than 4k tokens of spec in context.
9. **In-distribution where free.** TypeScript, JSX, familiar names. Novelty is spent only where it buys predictability and is taught through the checker.
10. **Pure core, effects at the edges, serializable state.** Every effect comes through `ctx`. Every test is "given state, do events, expect".
11. **Claims lag machinery.** The ledger reports only rungs that exist. Marketing follows the ledger.
12. **Tokens are a budget.** Docs, spec, and every tool output are measured in tokens and gated in CI.

verified: b45fa7011d9bd6b8526982e4389f2304ffd775c3
