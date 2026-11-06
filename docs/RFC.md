# RFC process

The only path to: change a spec section's text or status rules, change a conformance test, rename a glossary term, add a kernel package, add an extension point.

**File** `docs/rfc/NNNN-title.md`. **Sections** Problem · Proposal · Alternatives · Spec diff · Conformance diff · Migration · Token impact. **Lifecycle** draft -> review (human approval) -> accepted (ADR written) -> implemented. PRs touching conformance tests carry `rfc:NNNN` in the title; the hook rejects others.
