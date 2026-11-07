# @keel/std-sessions

**Spec:** std.sessions · **Status:** proposed · **verified:** (none)

## Contract

- **Public API (placeholders until backlog 0092):** `record(ctx, { limit?, upload? })`, `replay(session, { routes })`, `session(ctx)` (the `session` capability), `Session` (schema `sessions.Session`), `SessionsConfig` (rfc:0066). Each call throws `not implemented (backlog 0092)`.
- **Conformance:** one file per clause and per rule code (E2001-E2005) under `conformance/`, written from the spec before the implementation. Each suite is skipped until 0092.
- **Dependencies:** `@keel/ctx`, `@keel/router`, `@keel/schema`, `@keel/testing`.

## Unsafe

count: 0
