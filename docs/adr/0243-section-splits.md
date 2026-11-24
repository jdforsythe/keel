# ADR-0243: k.scaffold, std.sessions and std.postgres split so every section fits 3,100 tokens (RFC 0221)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** Principle 8 caps the spec a task needs at 4k tokens. `spec.section` and `docs.section` stood at 3,400 for k.scaffold (3,387); std.sessions (3,171) and std.postgres (3,104) were also over 3,100. The operator kept the principle and the 3,100 budget (D134).

**Decision.**
- k.scaffold-service takes k.scaffold's service operation: its input, edits, E1358 and eight clauses.
- std.sessions-served takes std.sessions' replay and `to-test` of a page a `node` deployable serves, and three clauses.
- std.postgres-changes takes std.postgres's `changed`, wire form, `follow`, E2460 and six clauses.
- Text moves word for word; each source keeps a pointer. A half carries its clauses' status, `conformance-covered`; the ledger follows once the `// Spec:` headers cite the new ids.
- `spec.section` and `docs.section` return to 3,100. The map drops its sentence restating budgets; `docs.map` is re-based to 1,560.

**Alternatives.** Budgets holding map plus largest section to 4,000 (not the operator's choice); other seams in k.scaffold (none self-contained); re-basing `spec.map` for one row.

**Consequences.** Largest section 3,004 (k.shell); map 1,497. Map plus largest section is 4,501, still over 4,000. Sixteen conformance files re-point their headers; until then the moved clauses read `none` under the new ids.
