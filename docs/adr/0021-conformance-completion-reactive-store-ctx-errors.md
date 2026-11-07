# ADR-0021: Conformance completion for k.reactive, k.store, k.ctx, k.errors (RFC 0032)

**Status:** accepted
**Context.** The freeze review left one partial clause in each of k.reactive and k.ctx, two in k.store, and the E1453/E1454 fixtures plus a `proposed` status in k.errors (backlog 0057). D1 of task 0034 forbids flipping a section with a partial clause.
**Decision.** Strengthen the partial tests (owner on effect re-run, restore with a different initial, generated valid transaction payloads, the full `KEEL_TEST=1` sim contract) with new test files and flip each section whose clauses are all asserted. A clause split across packages counts only when both halves are asserted: the ctx half of "`keel test` runs under sim by default" is asserted in ctx; the cli half belongs to the k.cli/k.testing completion.
**Alternatives.** Spawning the cli from ctx conformance: a build cycle. Counting the env contract alone as the clause: a proxy for a CLI run (D1).
**Consequences.** Status flips cite tests in docs/rfc/0032. k.ctx stays `implemented` until a `keel test` run asserts the sim default.
