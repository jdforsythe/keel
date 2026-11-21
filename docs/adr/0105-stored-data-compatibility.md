# ADR-0105: schema changes are checked against stored data, and unreplayable logs fold (RFC 0085)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 1 and 6.

**Context.** A stored snapshot outlives the code that wrote it. `restore` parsed the log with the current payload schemas, so removing or renaming a transaction made every snapshot holding it unrestorable and k.server threw on each request. Nothing compared a state schema change with the states already stored. k.compat already had `surface.json`, the `accepts` relation and `keel check --base`.

**Decision.** `surface.json` gains each server store's id, state schema and payload schemas, read by running each `stores` factory once on a sim ctx. With `--base`, E1563 reports a state schema that does not accept the base one (fix for one added required field: make it optional), and W1564 reports a removed or narrowed transaction, for every store whatever its deployable. `restore` of a snapshot whose state parses but whose log names an undeclared transaction or a refused payload keeps `state` and `head`, takes `state` as `initial` and keeps no entry. An accepted change needs no migration; every other state change is refused before it ships.

**Alternatives.**
- Hand-written migration scripts for every change, rejected: most changes are additive and the schemas already decide them.
- Refusing to start on an unreplayable log, rejected: state and head are what the app needs, and the entries are undo history the new code cannot replay.
- Generated SQL migrations, rejected: no app schema becomes a table (ADR-0104).

**Consequences.**
- A deploy that would strand stored states fails `keel check --base` in CI.
- Folded logs drop write keys, so a resend of an old write applies again.
- A change needing values computed from old state has no derived migration; the app moves the data to a new store id with a runner through `commitStores`.
