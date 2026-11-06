# @keel/store

**Spec:** k.store · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `store(schema, initial, { id?, clock? }) -> Store<T>` (inside a scope, else E1203): `get(key)`, `select(fn) -> Computed`, `log() -> LogEntry[]`, `snapshot() -> Snapshot<T>`, `restore(snap) -> Result<T, SchemaError>`, `undo() -> boolean`, `uses([t])`. `transaction(store, name, payloadSchema, (state, p) => state) -> Transaction<T, P>`. `tx(t, payload) -> Result<T, SchemaError | store.undeclared | store.invariant>`. `invariant(store, check)`. Types `Store`, `Transaction`, `LogEntry { id, name, payload, at }`, `Snapshot { state, log }`.
- **Invariants:** state changes only through `tx`; payload and result state are validated, copied and deep-frozen. Any `err` or throw leaves state and log unchanged; a throwing transaction rethrows. A commit sets state and log in one `batch`. `get(key)` reruns readers only when that key changes. `at` comes from `clock` (default: per-store counter, never `Date`); ids are unique per store, across undo and restore. `undo` replays the log minus its last entry from `initial`. `snapshot()` is JSON-safe (schema `encode`); `restore` validates every payload against its transaction. `uses` holds while its scope lives; while any is live, a transaction outside all live declarations is `store.undeclared`. Transaction names are unique per store.
- **Dependencies:** `@keel/schema`, `@keel/reactive`.
- **Rungs:** probabilistic: conformance and `test/` properties against a pure model (replay, undo inverse, restore), seed 1337. E1301 static and E1302 are checker rules.

## Extension points

`invariant(store, check)`: checks are permanent for the store and run on every candidate state.

## Unsafe

count: 0
