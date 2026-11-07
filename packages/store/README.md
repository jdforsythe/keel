# @keel/store

**Spec:** k.store · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `store(schema, initial, { id?, clock? }) -> Store<T>` (inside a scope, else E1203): readonly `schema`, `id`; `get(key)`, `select(fn) -> Computed`, `check(state) -> Result<T, store.invariant>` (parse and run every invariant; never commits or logs), `log() -> LogEntry[]`, `snapshot({ meta }?) -> Snapshot<T>`, `restore(snap) -> Result<T, SchemaError>`, `undo() -> boolean`, `undoWhere(pred) -> boolean` (undo the latest entry only if `pred` holds for it), `uses([t])`. `stores() -> ReadonlyMap<string, Store<unknown>>` (live stores of the caller's registry). `isolate(scope)` (the scope gets its own registry, RFC 0022). `transaction(store, name, payloadSchema, (state, p) => state) -> Transaction<T, P>` (readonly `name`, `schema` = payload schema, `store`). `tx(t, payload: P | unknown, { meta }?) -> Result<T, SchemaError | store.undeclared | store.invariant>` (payload typed by the transaction's schema; a value typed `unknown` is validated at run time; RFC 0028). `invariant(store, check)`. Types `Store`, `Transaction`, `TxOptions`, `LogMeta` (JSON record), `LogEntry { id, name, payload, at, meta? }`, `Snapshot { state, log, initial }`.
- **Invariants:** state changes only through `tx`; payload and result state are validated, copied and deep-frozen. Any `err` or throw leaves state and log unchanged; a throwing transaction rethrows. A commit sets state and log in one `batch`. `get(key)` reruns readers only when that key changes. `at` comes from `clock` (default: per-store counter, never `Date`); ids are unique per store, across undo and restore. `undo` replays the log minus its last entry from the base: `initial`, or the snapshot `initial` after `restore`. `meta` is copied, frozen and never in state; `snapshot()` drops it, `snapshot({ meta: true })` keeps it, `restore` keeps what it is given. `snapshot()` is JSON-safe (schema `encode`); `restore` validates state, `initial` and every payload against its transaction. `uses` is bound to `owner()` and dropped when that scope is disposed; `tx` consults the calling scope and its ancestors, and a caller with no declaring scope in its chain is unrestricted. Default id is `store.<n>` (module counter); a store registers in the registry of the nearest isolated scope on its `owner()` chain, else the module registry; `stores()` lists the caller's registry; a duplicate live id throws within one registry. Transaction names are unique per store.
- **Dependencies:** `@keel/schema`, `@keel/reactive`.
- **Rungs:** probabilistic: conformance and `test/` properties against a pure model (replay, undo inverse, restore), seed 1337. E1301 static and E1302 are checker rules.

## Extension points

`invariant(store, check)`: checks are permanent for the store and run on every candidate state.

## Unsafe

count: 0
