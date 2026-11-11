# ADR-0109: an API route is a manifest entry tagged `api: true` with no view (RFC 0086)

**Status:** accepted (2026-11-11), user decisions D1 and D2 of RFC 0086.

**Context.** `RouteDef` requires `component` on every entry, so a route that only answers JSON carries a view nobody sees: five in golden-1, one in std-sessions. The adapter cannot decide which routes need a view, because one `node` deployable serves pages and JSON routes side by side. An optional `component` would let a page lose its view by omission.

**Decision.** `RouteDef` is a union of three arms told apart by required members: a page (`path`, `component`), a layout (`component`, no `path`) and an API route (`api: true`, `path`, a loader or an action, no `component`, `errorElement`, `title` or `layout`). An entry matching no arm does not compile and `manifest()` throws E1510. The server answers an API route as a runtime request whatever `accept` says: JSON, never HTML, never 303, a guard denial as 403. `routes.href` and the client router take page ids only; other modules call an API route through `service({ module })`. An API route in a `client` or `static` deployable is E1511. Actions attach through `routes.actions` as for every route.

**Alternatives.**
- Optional `component`, rejected: a page could drop its view by omission.
- A second declaration (`endpoints({...})`) beside `routes`, rejected: two route tables for every reader.
- In-entry verb keys, rejected: a second way to bind an action, and the circular initializer of ADR-0052 returns.
- Deciding by adapter, rejected: `apps/sessions` serves a page and JSON routes from one `node` deployable.

**Consequences.**
- JSON routes carry no view; the stub components are deleted.
- `routes.json` entries gain `api: true`.
- A route that people open in a browser and services also call stays a page.
