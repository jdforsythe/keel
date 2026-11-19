# ADR-0104: std.db stores snapshots in SQLite through `node:sqlite` and in Postgres through `pg` (RFC 0085)

**Status:** accepted (2026-11-11), user decisions D1, D5 and D7, under the WORKFLOW RFC defaults 2, 4 and 5.

**Context.** A deployable that must survive restarts, or run as replicas, needs a database behind `ctx.storage`. The generated `server.mjs` bundles every dependency into one file, and the image is `node:22-slim` with nothing else installed. `node:sqlite` is in Node 22.13 and later; better-sqlite3 is a native addon. Keel's state is a store snapshot, not a set of tables.

**Decision.** `@keel/std-db/sqlite` (`node:sqlite`, WAL, `synchronous=FULL`, `secure_delete=ON`, `BEGIN IMMEDIATE` commits) and `@keel/std-db/postgres` (`pg`, a pool of 10, advisory locks per key in key order) implement k.persist's storage contract over two tables, `keel_kv` and `keel_meta`, with std.db's own `layout` version upgraded at open. `storage: 'file' | 'sqlite' | 'postgres'` on a `node` deployable in `topology.ts` picks the driver (k.deploy); `KEEL_DATABASE_URL` locates it and is never printed or written to a generated file. App code never imports std.db (E2151). Keel hosts no Postgres (D5); `.pii` values are stored as the store holds them, and encryption at rest is the host's (D7).

**Alternatives.**
- better-sqlite3, rejected: its `.node` binary cannot be bundled into `server.mjs`.
- postgres.js, rejected for now: its current major was days old; `pg` 8 has kept its API for years.
- Tables with a column per schema field, rejected: a second representation of the snapshot beside the log and heads.
- An append-only table of every log entry, rejected: unbounded retention of personal data with no erasure path.

**Consequences.**
- golden-1's `api` runs on SQLite; CI runs the same smoke on a Postgres service container.
- History in the database is the store's kept log (`logLimit`).
- SQLite on a network file system is unsupported; replicas use Postgres.
- E2152 and E2153 stop a process at startup on a newer layout or an unreachable database.
