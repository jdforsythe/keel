# RFC process

The only path to: change a spec section's text or status rules, change a conformance test, rename a glossary term, add a kernel package, add an extension point.

**File** `docs/rfc/NNNN-title.md` (`/rfc` creates it). **Sections** Problem · Proposal · Alternatives · Spec diff · Conformance diff · Migration · Token impact; an RFC may add Choices, Decisions, Known limits or Build order. The title line reads `# RFC NNNN: <title>`, followed by a `Status:` line. **Lifecycle** draft -> review (human approval, or the orchestrator under the RFC defaults in `docs/WORKFLOW.md`, which the human then confirms or reverses) -> accepted (ADR written) -> implemented. RFC numbers run in sequence. The ADR written on acceptance (`docs/adr/NNNN-title.md`, from `docs/adr/0000-template.md`) has its own number, and the RFC's Status line names it (`accepted (ADR-0151)`); the ADR's title names the RFC. An RFC adds an Amendment section at its end when a later RFC or red-team item changes it.

**Commits.** An RFC lands as three commits, each tagged `rfc:NNNN`: the RFC, its ADR and the spec text; the conformance change (by the `conformance-writer`); the build that makes the suites pass. The RFC commit carries the spec diff; the build commit changes only what the RFC's spec diff assigns to it (the section's status, sentences that describe the code it replaces).

**Guard (S0008).** A commit that modifies, renames or deletes `packages/*/conformance/**` carries a valid `rfc:NNNN` in its own message (several tags are accepted); the commit-msg hook and CI (`tooling/conformance-guard.mjs`) and the edit hook (`tooling/hooks/guard-conformance.mjs`) reject others. Valid means `docs/rfc/NNNN-*.md` exists at that commit. Pure additions are allowed, since suites are written before implementation.

**Pre-implementation exception.** While every spec section of a package is `proposed`, its conformance suites may receive lint-only or shape-only fixes (formatting, removing `!`, API-name alignment with the spec) by the `conformance-writer` under the tag `rfc:0000` in the commit message. Behavior changes still need a numbered RFC. Once any of its sections is past `proposed`, `rfc:0000` is not accepted; the hook and CI reject it.

verified: 0e37f8bfffe18f1f288009bf968ef73336695ae4
