# ADR-0002: Signals with four operators

**Status:** accepted
**Context.** Hooks have ordering rules and deps arrays; observables have hundreds of operators. Both are prediction hazards.
**Decision.** `signal`, `computed`, `effect`, `resource`. Dependencies from reads. Effects declare writes. Ownership scopes dispose automatically. Engine borrowed and wrapped.
**Alternatives.** Hooks (invisible invariants); RxJS (surface); Elm-only (boilerplate, no escape hatch).
**Consequences.** Compiler emits the dependency graph; cycles are static errors; no stale closure class of bug.
