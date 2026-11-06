# RFC process

The only path to: change a spec section's text or status rules, change a conformance test, rename a glossary term, add a kernel package, add an extension point.

**File** `docs/rfc/NNNN-title.md`. **Sections** Problem · Proposal · Alternatives · Spec diff · Conformance diff · Migration · Token impact. **Lifecycle** draft -> review (human approval) -> accepted (ADR written) -> implemented. PRs touching conformance tests carry `rfc:NNNN` in the title; the hook rejects others.

**Pre-implementation exception.** While a section's status is `proposed`, its conformance suite may receive lint-only or shape-only fixes (formatting, removing `!`, API-name alignment with the spec) by the `conformance-writer` under the tag `rfc:0000` in the commit message. Behavior changes still need a numbered RFC. Once the section is `implemented`, `rfc:0000` is not accepted; the hook and CI reject it.
