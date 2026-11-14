# @keel/std-db

**Spec:** std.db · **Status:** proposed · **verified:** (none)

Durable storage drivers for `node` deployables: SQLite on `node:sqlite` and Postgres on `pg`.

## Contract

- **Public API:** none yet. The package has the entries `@keel/std-db/sqlite`, `@keel/std-db/postgres` and `@keel/std-db/tools`, all empty.
- **Invariants:** none yet.
- **Dependencies:** `@keel/check`, `@keel/ctx`, `pg`; `node:sqlite` needs Node 22.13 or later.
- **Rungs:** none yet.

## Extension points

Will use the **storage drivers** (k.persist) and the **check rule registry** (k.check: E2151 from `./tools`).

## Unsafe

count: 0
