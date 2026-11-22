# ADR-0203: k.store: a `tx` in a component body is E1304; a view store seeded from loader data is created with it (RFC 0181)

**Status:** accepted (orchestrator, under the RFC defaults; for the operator to confirm).

**Context.** An author seeded a client store from loader data with a `tx` in a component body. The write throws E1201 at render, which `renderRoute` once swallowed into an empty page. `keel check` says nothing, and no section tells an author how a store gets its first value from a loader. A store created in a component scope with `initial`, resumed from its snapshot, already does that.

**Decision.** `keel check` reports E1304 for a `tx` that runs while a component builds: in its body outside nested functions, or in a `For`, `If`, `Match`, `Case` or `Boundary` child function. k.store gains a View stores paragraph: create the store in the body with the data as `initial` and an explicit `id`, with transactions from a factory. The skills say the same.

**Alternatives.** A seeding API (a write at build, against E1201 and E1256); `tx` in a body as unlogged initial state (one call, two meanings); a warning (the call always throws); a better run-time message alone (found only when a test renders).

**Consequences.** The mistake is a check-time error with a fix that names the existing way. k.store reads `implemented` until two new clauses are covered. One new code, E1304.
