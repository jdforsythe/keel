# std.postgres-errors: Errors of app data on Postgres
status: proposed

**By SQLSTATE.** What a caller of std.postgres gets for each thing the database or the connection can answer. A failure a caller can act on is a value; the rest is a defect (k.defects).

| The database answers | The caller gets |
| --- | --- |
| a row failing its schema | `postgres.result` |
| class `23` | `postgres.constraint` |
| `40001`, `40P01` | the statement or `fn` runs again, at most 3 runs; then `keel.conflict` whose `cause` is `postgres.database` with that SQLSTATE |
| no answer: a refused, reset or lost connection; `57P01` to `57P03`; `53300`; `08000`, `08001`, `08003`, `08006` | `keel.unreachable`: nothing ran, or the connection went, and a later try may work |
| `08007` | `postgres.database`: the commit's outcome is unknown, so a caller reads the state before it writes again |
| classes `22`, `40` (but the reruns), `53` (but `53300`), `54`, `55`, `57` (but `57P01` to `57P03`) and `P0` | `postgres.database`, data `{ sqlstate }` |
| any other SQLSTATE: class `42` (the app's own SQL is wrong), `XX` (the store is), `0A`, `08004`, `08P01` (a protocol violation) and the rest of class `08` | the defect E2461, `data` `{ sqlstate }` |

No error, defect or log line holds a parameter, a row value or the database's message text. A wrapped error stays readable above: the `postgres.database` error's `in(e)` (k.attempt) finds it on a `keel.conflict`'s cause chain, so a caller three frames up still tells a deadlock from a serialization failure.

**PGlite and `statement_timeout`.** PGlite keeps no statement timer and has no way to cancel a running statement, so on a `pglite:` engine and under sim no timeout is left in force, however it was set. The driver judges the value, never the statement's text. When the engine opens and after every statement, in one query it reads the session's `current_setting('statement_timeout')`, each default kept for a database or a role (`pg_db_role_setting`) and each function's own setting (`pg_proc.proconfig`). A value other than `0` is put back (`set statement_timeout = 0`, `alter database` or `alter role ... reset statement_timeout`, `alter function ... reset statement_timeout`) and the statement is the defect E2461 with `data.sqlstate` `0A000`; inside a `transaction`, which then rolls back. So `set`, `set local`, `set_config` under any spelling or inside a function, an identifier written with escapes, `alter database`, `alter role` and a function's `set` clause are refused alike. The cost is one more query in the same process for each statement, and no network. On Postgres the server runs the timer and nothing is read.

**Not held.** A function that sets the parameter and puts it back within one statement leaves nothing in force after it, and nothing was enforced while it ran.

**Rules.** E2461 (std.postgres) a database answer no error above takes, a defect, message `E2461 std.postgres: the database answered an SQLSTATE no error takes`.

**Conformance.**
- A driver error whose `code` is `08000`, `08001`, `08003`, `08006`, `57P01` or `53300` is `err` `keel.unreachable`; `08007` is `err` `postgres.database` with data `{ sqlstate: '08007' }`; `08004` and `08P01` reject with a value `isDefect(v, 'E2461')` accepts whose `data` is `{ sqlstate }` and whose message is `E2461 std.postgres: the database answered an SQLSTATE no error takes`.
- Under sim, a plan of three `conflict` steps makes a `transaction` `err` `keel.conflict` whose `cause` has code `postgres.database` and data `{ sqlstate: '40001' }`; on Postgres 17, a deadlock on each of three runs gives the `cause` `{ sqlstate: '40P01' }`.
- On a `pglite:` folder each of `set statement_timeout = 5`, `set local statement_timeout = 5` inside a `transaction`, `select set_config('statement' || '_timeout', '5', false)`, `set U&"statement\005ftimeout" = 5`, and `select f()` with `f` a function calling `set_config('statement_timeout', '5', false)`, rejects with the E2461 defect whose `data.sqlstate` is `0A000`, and `show statement_timeout` is `0` after it.
- On a `pglite:` folder `alter database postgres set statement_timeout = 5` and `alter role postgres set statement_timeout = 5` reject with that defect and leave `pg_db_role_setting` naming no `statement_timeout`; the folder opened again reads `0`.
- On a `pglite:` folder `create function g() returns int language sql set statement_timeout = 5 as 'select 1'` rejects with that defect and leaves `g`'s `proconfig` null.
- On a `pglite:` folder `set statement_timeout = 0` and `select 1` answer as on Postgres, and the same statements under sim are judged the same way.
