# std.db: SQLite and Postgres storage
status: proposed

**Extension points.** Storage drivers (k.persist Drivers): `@keel/std-db/sqlite` and `@keel/std-db/postgres` export the drivers a `node` deployable's generated entry opens when `topology.ts` sets `storage` (k.deploy). Check rule registry: `@keel/std-db/tools` registers E2151. App code never imports the package (E2151): its state reaches the database only through stores and `ctx.storage`.

**API** (Node only; called by generated entries).
```ts
const storage = await sqlite(new URL('file:/data/keel.sqlite'))   // KeyValueStorage (k.persist)
const storage = await postgres(new URL(env.KEEL_DATABASE_URL))
```
Each resolves k.persist's storage plus `close()` (k.persist Drivers). In `postgres(url, { clientFactory? })`, `clientFactory` returns a `pg` Pool-shaped object used in place of the pool; `close()` ends it.
- `sqlite(url)` uses `node:sqlite` (Node 22.13 or later): WAL journal, `synchronous=FULL`, `secure_delete=ON`, `busy_timeout` 5,000 ms; `read` runs in one read transaction, `commit` in `BEGIN IMMEDIATE`.
- `postgres(url)` uses `pg`, a pool of at most 10 connections, TLS as the URL's `sslmode` says; `read` is one `SELECT`; `commit` and `set` are one read committed transaction that takes `pg_advisory_xact_lock` for each key in sorted key order, then compares, then writes in one upsert.
- Both keep k.persist's contract and expose nothing else: no SQL, query builder or table. A key or value holding U+0000 or a lone surrogate rejects, naming neither.

**Layout.** Two tables: `keel_kv (key text primary key, value text not null)` and `keel_meta (name text primary key, value text not null)`, whose `layout` row is std.db's table version (1). Opening creates or upgrades them in one transaction; a newer `layout` is E2152 and the process exits 1. Other tables are left alone. App schemas never become columns: a store persists as its snapshot (k.persist), and k.compat checks schema changes against stored data (E1563, W1564).

**On disk.** Exactly what `ctx.storage` receives: each server store's `snapshot({ meta: true })` (state, `initial`, `head`, and the kept log with payloads, write keys and `caller` hashes), std.jobs queues, std.schedules marks and std.workflows stores. No `Secret` arrives: `store()` refuses `s.secret` in state (E1303), a snapshot folds a secret payload, job inputs refuse it (E2503), and a secret serializes only as its marker (k.privacy). A value `reveal`ed into a plain field is plain data, stored as written (k.privacy, E1112). Personal data (`.pii`, k.privacy) is stored as the store holds it: the database is the app's own data, not a sink. std.db puts no value in a log line, a diagnostic or an error message; they name keys. A value removed from state leaves the database once its last log entry folds past `logLimit`; SQLite then overwrites the freed pages, and Postgres keeps dead row versions until vacuum. Encryption at rest is the volume's or the host's.

**Rules.** E2151 an app file imports `@keel/std-db` (no fix) · E2152 the database's `layout` is newer than the package's (at startup) · E2153 the database cannot be opened or refuses the connection, naming `KEEL_DATABASE_URL` and no part of its value (at startup), also when its `layout` is not a version.

**Conformance.**
- Each driver, on a temporary SQLite file and on Postgres (PGlite, and a Postgres 17 service in CI), passes k.persist's storage clauses.
- Two processes on one SQLite file, each serving `createApp` on its driver, with overlapping actions on one store: one saves, the other is 409, and the file holds the first's snapshot.
- A process killed with SIGKILL after an action's response restarts on the same database and serves the same stored snapshot byte for byte; its next commit's head is one higher.
- For generated sequences of commits from two connections, the stored values equal a serial order of the commits that resolved `true`.
- An empty database opens at layout 1; a database at layout 2 is E2152 and exit 1.
- A refused connection prints one E2153 naming `KEEL_DATABASE_URL` and no part of its value.
- An app file importing `@keel/std-db/sqlite` is E2151; the generated entry is not.
- After a value is overwritten, its entry folded and the driver closed, the SQLite file's bytes do not hold it.
