# ADR-0004: Typed route manifest over filesystem routing

**Status:** accepted
**Context.** Filesystem conventions differ per framework and require directory listing to discover.
**Decision.** One `routes.ts` manifest with typed params, search params, loaders, actions keyed by HTTP method, layouts, guards. `href()` is typed.
**Alternatives.** Filesystem routing (undiscoverable, convention churn).
**Consequences.** Route table is a compiler artifact; bad links are compile errors.
