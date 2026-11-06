# ADR-0003: Mutation only through named transactions

**Status:** accepted
**Context.** Free mutation defeats replay, audit, undo, and ownership checks.
**Decision.** A store is mutated only by named, typed, pure transactions recorded in a log. Components declare which transactions they may call.
**Alternatives.** Context/provide-inject (action at a distance); proxy stores (implicit); Redux (boilerplate without typing).
**Consequences.** Undo, replay, sessions, analytics, and audit share one mechanism; the verification track targets this surface.
