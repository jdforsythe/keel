# std.postgres-changes: Postgres changes
status: implemented
`changed` records a committed change of a database (std.postgres) on a channel; `follow` delivers it, in any process using the same URL. They are the std.channels follow seam.

**API.**
- `changed(channel, params)` on `tx` and on the database object: `Promise<Result<null, E>>`. `channel` is any value with `name` and a `params` schema (a std.channels `channel`; std-postgres imports no type from std-channels). `params` is parsed by `channel.params` (a failure throws E2460) and keyed as its canonical JSON (keys sorted). On `tx` it records the change in the transaction: delivered once the transaction commits, once per channel and key however many times `fn` called it, never when the transaction rolls back or `fn` runs again after a serialization failure. On the database object it is its own transaction, delivered when it commits. A failure is the statement's (`keel.unreachable`). Its plan step (k.sim) is a statement's: none on `tx`, one alone.
- Wire form, Postgres and PGlite: `select pg_notify('keel_changes', $1)` with `$1` the JSON text `{"d":<capability>,"c":<channel name>,"k":<key>}`. A payload over 7,900 bytes throws E2460 before any statement runs. Postgres delivers a notification only after its transaction commits, in commit order, and drops duplicates within one transaction.
- `follow(channel, key, on)` on the database object: calls `on({ kind: 'changed' })` for each committed change of that capability, channel name and key, on any process using the same URL, and `on({ kind: 'lost' })` once if delivery stops; returns a function that stops it. It resolves once the process is listening, so a change committed after it resolves is never missed. When the listening connection does not open, or closes before it listens, `follow` calls `on({ kind: 'lost' })` once and resolves a stop function; it never throws or rejects for the connection. No error, log line or diagnostic holds `params` or a key.

**Rules.** E2460 a `changed` whose `params` fail the channel's schema or whose payload exceeds 7,900 bytes (throws).

**Conformance.**
- Under sim, on a `pglite:` folder and on Postgres 17 in CI, a `follow` started before a `transaction` that calls `changed(ch, { b: 'x' })` twice and commits gets one `changed`; one whose `fn` returns `err` gets none; under sim a plan `conflict`, `none` that calls `changed` in each run gets one.
- A `follow` of `{ b: 'x' }` gets nothing for a change of `{ b: 'y' }`, another channel name or another capability on the same URL.
- On Postgres 17, with two processes on one URL, a `follow` in process B and a committed `changed` in process A: B's `on` gets `changed`, and a read in B started after it sees A's rows.
- `params` failing the channel's schema and a payload over 7,900 bytes each throw E2460 and run no statement.
- With a `follow` open, a `pg_stat_activity` backend has `application_name` `keel-listen-<pid>`.
- On Postgres 17, terminating the listening connection's backend reports `lost` to each open follow; the next `follow` opens a new connection and gets the next change.
- On Postgres 17, with `KEEL_POSTGRES_URL` naming a port nothing listens on, `follow` resolves a function, and its `on` gets `{ kind: 'lost' }` exactly once.
