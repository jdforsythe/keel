# ADR-0256: k.a11y-static: `keel check` judges contrast from the project's `tokens.ts` (RFC 0234)

**Status:** accepted (orchestrator, 2026-11-25), to be confirmed by the operator.

**Context.** No `keel` command gave `check()` the project's tokens, so static E1804 never fired, and the ledger counted static contrast codes that could not appear. The rule judged only an element's own `fg`, so a `fg` on a container passed check and failed at render.

**Decision.**
- Every command that runs the k.check pipeline gives each project the `tokens` export of its `tokens.ts`, bundled and evaluated fresh on every run; a broken one is E1807 at `tokens.ts` 1:1.
- `fg`, `bg`, `fontSize` and `weight` resolve as at render (own literal, literal look, role set, parent through base elements, `Part` and markup-free intrinsics); an element holding text with an unread or unfound `fg` or `bg` is judged at render only, which every 1.4.3 item already needs.
- The message names both tokens, the ratio and the threshold, at most 89 units.
- E1802, E1804, E1807 and E1820 are errors and stop `keel build`.

**Alternatives.** A static parse of `tokens.ts` (a second evaluator); Node's cached `import()` (stale in `keel lsp` and `keel mcp`); an error for every unread value (the render already decides the claim); judging through app components (their markup is elsewhere).

**Consequences.** Static E1804, E1809 and token-set E1801 now run in every app. `keel check` costs about 25 ms more per project with `tokens.ts`. A literal style token absent from `tokens.ts` is still reported by no `keel check`.
