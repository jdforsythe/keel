# @keel/std-db

**Spec:** std.db · **Status:** proposed · **verified:** (none)

Durable storage drivers for `node` deployables: SQLite on `node:sqlite` and Postgres on `pg`. The generated entry opens the one `topology.ts` names; app code never imports the package (E2151).

## Contract

- **Public API** (Node 22.13 or later; called by generated entries only):
  - `@keel/std-db/sqlite`: `sqlite(url: URL): Promise<DbStorage>` on a `file:` URL. WAL journal, `synchronous=FULL`, `secure_delete=ON`, `busy_timeout` 5,000 ms. `read` is one statement; `commit` and `set` run in `BEGIN IMMEDIATE`. Processes on one host may share the file; the folder must exist.
  - `@keel/std-db/postgres`: `postgres(url: URL, options?: PostgresOptions): Promise<DbStorage>` on a `postgres:` or `postgresql:` URL, over a `pg` pool of at most 10 connections (connect timeout 10 s), TLS as `pg` reads the URL's `sslmode`; `require` and `prefer` verify the certificate as `verify-full` does, and print no warning. `read` is one `SELECT`; `commit` and `set` are one read committed transaction that takes `pg_advisory_xact_lock(hashtextextended(key, 0))` for each key in key order, compares, then writes. `options.clientFactory` returns a `PgPool` (`query`, `connect`, `end`) used in place of the `pg` pool; the driver ends it on `close()`. Replicas may share the database.
  - `DbStorage` is k.persist's storage (`get`, `set`, `read`, `commit`) plus `close(): Promise<void>`, which closes the database or ends the pool; every call after it rejects. Types `PgPool`, `PgClient`, `PostgresOptions`.
  - `@keel/std-db/tools` (node): rule E2151, an app file that imports or re-exports `@keel/std-db` or one of its entries; no fix.
- **Invariants:**
  - Two tables: `keel_kv (key text primary key, value text not null)` and `keel_meta (name text primary key, value text not null)`, whose `layout` row is 1. Opening creates them in one transaction; other tables are left alone.
  - Opening rejects E2152 when `layout` is newer than 1, and E2153 when the database cannot be opened or reached, or its `layout` is not a version. The generated entry prints the diagnostic and exits 1. Each error carries `code` and a message that starts with it.
  - `commit` stores every `value` only when each key holds its `expect`, as one transaction, and rejects E1606 when one key appears twice. `read` returns the values in the order asked, as one cut.
  - A key or value holding U+0000 or a lone surrogate rejects and stores nothing; JSON text holds neither.
  - No error, diagnostic or log line holds a value, a key, the URL or any part of it. A failed call names the driver, the operation and the database's own error code.
  - Values are stored as `ctx.storage` receives them, `.pii` included. SQLite overwrites freed pages; Postgres keeps dead row versions until vacuum. Encryption at rest is the volume's or the host's.
- **Dependencies:** `@keel/ctx` (types), `@keel/check` (tools only), `pg`; `node:sqlite` from Node.
- **Rungs:** conformance (examples and properties, seed 1337) for k.persist's storage clauses on both drivers, serial commits from two connections, two processes on one SQLite file (409 for the stale save), SIGKILL and restart, layouts and E2152, E2153 naming only `KEEL_DATABASE_URL`, E2151 and secure delete; a property that generated `set`, `commit` and `read` sequences agree with a model map on both drivers. Postgres runs on PGlite in-process, or on the server `KEEL_TEST_POSTGRES_URL` names, where `test/postgres-server.test.ts` also covers lock waits across connections, lock order, read committed visibility, the pool cap of 10, TLS modes, the connect timeout and a connection lost mid-commit; files then run one after another.

## Extension points

Uses the **storage drivers** (k.persist: `createCtx({ mode: 'real', drivers: { storage } })`) and the **check rule registry** (k.check: E2151 from `./tools`).

## Unsafe

count: 0
