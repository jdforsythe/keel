# std.db: SQLite and Postgres storage
status: implemented

**Extension points.** Storage drivers (k.persist Drivers): `@keel/std-db/sqlite` and `@keel/std-db/postgres` export the drivers a `node` deployable's generated entry opens when `topology.ts` sets `storage` (k.deploy). Check rule registry: `@keel/std-db/tools` registers E2151. App code never imports the package (E2151): its state reaches the database only through stores and `ctx.storage`.

**API** (Node only; called by generated entries).
```ts
const storage = await sqlite(new URL('file:/data/keel.sqlite'))   // KeyValueStorage (k.persist)
const storage = await postgres(new URL(env.KEEL_DATABASE_URL))
```
Each resolves k.persist's storage plus `close()` (k.persist Drivers). In `postgres(url, { clientFactory? })`, `clientFactory` returns a `pg` Pool-shaped object used in place of the pool; `close()` ends it.
- `sqlite(url)` uses `node:sqlite` (Node 22.13 or later): WAL journal, `synchronous=FULL`, `secure_delete=ON`, `busy_timeout` 5,000 ms; `read` runs in one read transaction, `commit` in `BEGIN IMMEDIATE`.
- `postgres(url)` uses `pg`, a pool of at most 10 connections, TLS as the URL's `sslmode` says; `read` is one `SELECT`; `commit` and `set` are one read committed transaction that takes `pg_advisory_xact_lock` for each key in sorted key order, then compares, then writes in one upsert.
- `postgres(url)`'s storage has `watch` (k.persist Watch); `sqlite(url)`'s has none. Opening takes a token, the `pg_current_xact_id()` of its opening transaction; a transaction id that is not a number fails the open (E2153). Each `commit` resolving `true` that stores a `keel.store.` key runs `pg_notify('keel_storage', $1)` in its transaction, `$1` the JSON text `{"o":<token>,"k":[<keys>]}`, the keys sorted and split across as few notifications as keep each at most 7,900 bytes; a key whose own entry would leave a notification over 7,900 bytes is announced in none, and its `commit` still resolves `true`; Postgres delivers them after the commit, in commit order. A driver listens on one connection outside the pool (a process opens one driver, so holds one; with no `watch` it holds none, and after a `watch` at least one), `application_name` `keel-storage-<pid>`, opened at the first `watch` and closed when the last stops. A notification holding the process's own token is not reported. A lost connection is `lost` to each watch on it, and the next `watch` opens it again.
- Both keep k.persist's contract and expose nothing else: no SQL, query builder or table. A key or value holding U+0000 or a lone surrogate rejects, naming neither.

**Layout.** Two tables: `keel_kv (key text primary key, value text not null)` and `keel_meta (name text primary key, value text not null)`, whose `layout` row is std.db's table version (1). Opening creates or upgrades them in one transaction; a newer `layout` is E2152 and the process exits 1. Other tables are left alone. App schemas never become columns: a store persists as its snapshot (k.persist), and k.compat checks schema changes against stored data (E1563, W1564).

**On disk.** Exactly what `ctx.storage` receives: each server store's `snapshot({ meta: true })` (state, `initial`, `head`, and the kept log with payloads, write keys and `caller` hashes), std.jobs queues, std.schedules marks and std.workflows stores. No `Secret` arrives: `store()` refuses `s.secret` in state (E1303), a snapshot folds a secret payload, job inputs refuse it (E2503), and a secret serializes only as its marker (k.privacy). A value `reveal`ed into a plain field is plain data, stored as written (k.privacy, E1112). Personal data (`.pii`, k.privacy) is stored as the store holds it: the database is the app's own data, not a sink. std.db puts no value in a log line, a diagnostic or an error message; they name keys. A notification holds the token and store keys, never a value. A value removed from state leaves the database once its last log entry folds past `logLimit`; SQLite then overwrites the freed pages, and Postgres keeps dead row versions until vacuum. Encryption at rest is the volume's or the host's.

**Rules.** E2151 an app file imports `@keel/std-db` (no fix) · E2152 the database's `layout` is newer than the package's (at startup) · E2153 the database cannot be opened or refuses the connection, naming `KEEL_DATABASE_URL` and no part of its value (at startup), also when its `layout` is not a version. The driver says so by its failure: an `Error`, or an object with a string `code` or a number `errcode`; any other thrown value passes on as thrown (k.deploy Refusals at start: E1577). A failed storage call is a defect whose `cause` is `db.failed`, its data closed (k.expect Carries): `driver`, `op`, `class` and `errcode`, `class` the SQLSTATE class of a Postgres code (`57` for `57P01`), `sqlite` with SQLite's numeric `errcode`, `system` for a code like `ECONNREFUSED`, else `unknown`, and `errcode` `0` but for SQLite; no code's text.

**Conformance.**
- Each driver, on a temporary SQLite file and on Postgres (PGlite, and a Postgres 17 service in CI), passes k.persist's storage clauses.
- A SQLite storage whose `get` meets a driver error with `errcode` 1 rejects with a defect whose `cause.data` is `{ driver: 'sqlite', op: 'get', class: 'sqlite', errcode: 1 }`; a Postgres `set` meeting `code` `57P01` with `{ driver: 'postgres', op: 'set', class: '57', errcode: 0 }`, and one meeting `code` `dup key jane@x.com` with `class` `unknown`.
- Two processes on one SQLite file, each serving `createApp` on its driver, with overlapping actions on one store: one saves, the other is 409, and the file holds the first's snapshot.
- A process killed with SIGKILL after an action's response restarts on the same database and serves the same stored snapshot byte for byte; its next commit's head is one higher.
- For generated sequences of commits from two connections, the stored values equal a serial order of the commits that resolved `true`.
- An empty database opens at layout 1; a database at layout 2 is E2152 and exit 1.
- A refused connection prints one E2153 naming `KEEL_DATABASE_URL` and no part of its value.
- An app file importing `@keel/std-db/sqlite` is E2151; the generated entry is not.
- After a value is overwritten, its entry folded and the driver closed, the SQLite file's bytes do not hold it.
- On Postgres 17, with drivers A and B open on one database and a `watch` on B resolved, a `commit` through A storing `keel.store.s` gives B's `on` `{ kind: 'committed', keys: ['keel.store.s'] }`; a `commit` through B storing `keel.store.s` gives it nothing.
- On Postgres 17, a `commit` through A storing 400 keys `keel.store.<id>`, each `<id>` 40 characters, gives B's `on` reports whose `keys` together are those 400 keys, each once, in sorted order, and each `keel_storage` notification payload is at most 7,900 bytes.
- On Postgres 17, terminating the backend whose `application_name` is `keel-storage-<pid>` reports `lost` once to each of B's open watches; B's next `watch` opens a new connection and gets the next commit's report.
- On Postgres 17, no `keel_storage` notification payload holds a stored value, and before any `watch` a driver holds no connection outside its pool.
- `sqlite(url)`'s storage has no `watch`.
