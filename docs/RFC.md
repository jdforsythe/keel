# RFC process

The only path to: change a spec section's text or status rules, change a conformance test, rename a glossary term, add a kernel package, add an extension point.

**File** `docs/rfc/NNNN-title.md`. **Sections** Problem · Proposal · Alternatives · Spec diff · Conformance diff · Migration · Token impact. **Lifecycle** draft -> review (human approval) -> accepted (ADR written) -> implemented. Numbers run in sequence; the ADR written on acceptance has its own number and the RFC's Status line names it (`accepted (ADR-0051)`). An RFC may add an Amendment section when a later RFC or red-team item changes it.

**Guard (S0008).** A commit that modifies, renames or deletes `packages/*/conformance/**` carries a valid `rfc:NNNN` in its own message (several tags are accepted); the commit-msg hook and CI reject others. Valid means `docs/rfc/NNNN-*.md` exists at that commit. Pure additions are allowed, since suites are written before implementation.

**Pre-implementation exception.** While a section's status is `proposed`, its conformance suite may receive lint-only or shape-only fixes (formatting, removing `!`, API-name alignment with the spec) by the `conformance-writer` under the tag `rfc:0000` in the commit message. Behavior changes still need a numbered RFC. Once the section is `implemented`, `rfc:0000` is not accepted; the hook and CI reject it.

verified: 71fc99eec8865b29183ec9c7e273a5cfb54de6bf
