# ADR-0052: actions attach with `routes.actions` after the manifest (RFC 0063)

**Status:** superseded by ADR-0179

**Context.** An action in a route entry made the type of `routes` depend on the action. An action returning `ok(routes.href(...))` then formed a circular initializer (TS7022), and authors bound `const to: Href` first (ADR-0030, ADR-0034). The user chose a two-phase manifest on 2026-11-07 (backlog 0114).

**Decision.**
- `manifest({...})` holds no actions. `routes.actions({ [id]: { POST, PUT, PATCH, DELETE } })` is a `void` statement after it. No initializer depends on an action, so `return ok(routes.href(...))` type-checks.
- Typed by `ActionsFit`: ids with a `path`, `Verb` keys, action `params` that accept the route's. Validated whole before attaching: E1505 for an unknown or layout id, a non-verb key, or a second attach; E1507 for another `params` schema. An entry with `actions` fails to compile and throws E1505 with the move.
- Attached actions live in a `WeakMap` keyed by the entry object (`routeActions`, `@keel/router/internal`). Union manifests built by spreading `routes` keep them; the router, server dispatch, E1553 and `routesArtifact` read it. `routes.json` is unchanged.
- `routeLiterals` reads verbs from `routes.actions({...})` calls anywhere in the manifest file, through `const` aliases; what it cannot see (another file, a computed key) is unread, not none (backlog 0183).
- `compileTable` seals entries, so `routes.actions` after `createRouter` or `createApp` is E1505 and E1553 cannot be bypassed (backlog 0183).

**Alternatives.** Keep the binding (two ways). Chain `.actions()` on the initializer or pass a callback (the cycle stays). Export a separate `actions` value wired into `createApp` and `createRouter` (more wiring everywhere).

**Consequences.**
- One way to redirect from an action. Skills, evals and both golden apps drop `const to: Href`.
- Attachment is a statement in `routes.ts`, the file that owns the manifest. A module that imports an action file before `routes.ts` hits a TDZ error, as it did with in-entry actions.
- A route's actions attach once; a second `routes.actions` for the same id throws.
- Budgets: `@keel/compiler` re-based 24 -> 25 kB for the alias and other-file reads in `routeLiterals` (24,873 B, D7); router and server within budget.
