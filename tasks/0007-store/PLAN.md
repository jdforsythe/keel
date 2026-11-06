# Task 0007: store (covers backlog 0007 and 0008)

**Spec:** k.store, k.errors (throwing transaction) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/store

## Deliverables
- [x] 0007: `store`, `transaction`, `tx`, `log`; reactive `get`/`select`; payload validation; invariants
- [x] 0008: `snapshot`, `restore`, `undo`, ownership (`uses`, runtime form of E1301)
- [x] property tests (model, replay determinism, undo inverse, restore); README; changeset; spec status

## Steps
1. [x] conformance-writer wrote packages/store/conformance from k.store (read only here).
2. [x] Implement in `src/` (one export per file; internals in `src/internal/`, types in `src/types/`); check; test.
3. [x] Properties and examples in `test/`; smoke test removed; README; changeset; k.store and spec/00-map.md status -> implemented.

## Decisions
- D1: Reads: one root signal holding the state plus one `computed` per top-level key of an object schema (`schema.node.fields`). `get(key)` reads that key's computed (dependency) and returns the mirrored `current[key]` (typed `T[K]` without casts). Keys outside the schema, or non-object schemas, depend on the root signal. `select(fn)` is `computed(() => fn(root.get()))`. `log()` and `snapshot()` track a version signal.
- D2: `tx<T>(t: Transaction<T, unknown>, payload: unknown)`: conformance passes untyped payloads (`payload.test` arbitrary values, `replay.test` `entry.payload`), so call sites are not payload-typed; runtime validation is the guard. Typed call sites need an RFC.
- D3: Transactions bind to a store at declaration, `transaction(store, name, schema, fn)`, as the fixtures require. The spec example `transaction(name, schema, fn)` diverges; spec text needs an RFC to align.
- D4: Store-private hooks (`define`, `guard`, the transaction entry point) sit under an unexported `unique symbol` (`src/internal/coreKey.ts`) on `Store`/`Transaction`; avoids a WeakMap and its casts.
- D5: Undo replays the log minus its last entry from the store's `initial` (O(n) per undo; memory is the log only). After `restore`, undo still replays from this store's `initial`; precondition: the snapshot came from a store with the same definition (initial value and transaction code).
- D6: `snapshot()` = `{ state, log }`, each copied through its schema (`parse` -> `encode` -> `decode`), so it is JSON-safe and detached. The log codec is a `s.union('name', ...)` with one variant per transaction, so `restore` checks each payload against its own schema; with no transactions only an empty log decodes. `restore` returns `Result<T, SchemaError>` (external data is an expected failure) and changes nothing on `err`.
- D7: Payloads are copied and deep-frozen before logging; the result state is validated with the store schema and deep-frozen (already-frozen subtrees skipped, so shared structure is cheap).
- D8: A transaction whose result fails the store schema throws `Error` (a bug, unexpected per k.errors); nothing is committed. A throwing transaction function rethrows; state and log unchanged.
- D9: Order in `tx`: payload (`schema.invalid`) -> `uses` (`store.undeclared`) -> apply -> result schema -> invariants (`store.invariant`) -> stamp `at`, append, commit state and log in one `batch`.
- D10 (superseded by D17 under rfc:0003; kept for history): `@keel/reactive` exposes no current-owner identity, so `uses` cannot tell which scope `tx` runs in. A declaration holds while its scope lives (probe: a `computed` created in that scope; reading it after disposal is E1205). While any declaration on the store is live, a transaction in none of them is `store.undeclared`, whatever scope calls `tx`. Deviation: the conformance title "Declarations are not enforced outside any scope" holds only when no declaration is live (its body tests exactly that). Exact form needs k.reactive to expose an owner token.
- D11: `invariant(store, check)` is permanent for the store, not scope-bound; not re-checked on undo or restore.
- D12: Default clock is a per-store counter; ids come from a per-store sequence; both are raised to the restored maxima on `restore`, so ids stay unique and default `at` non-decreasing across undo and restore.
- D13: Error values are `s.error` declarations in `src/internal/` (`store.undeclared`, `store.invariant`, data `{ transaction }`); not exported.
- D14: Transaction names must be non-empty and unique per store (throw); `options.id` defaults to `"store"` and is informational.
- D15: `tx` inside an effect or computed is E1201 from k.reactive (store signals are private and cannot be in `writes`).
- D16 (rfc:0003): `Snapshot` is `{ state, log, initial }`; `restore` validates `initial` against the schema (required) and replaces the base `undo` replays from. Snapshots without `initial` are `schema.invalid`. D5's precondition is gone.
- D17 (rfc:0003): `uses` records declarations keyed by `owner()` (merged per scope, dropped via `Scope.onDispose`); outside a scope it throws E1203. `tx` unions the declarations of the caller's scope and its `parent` chain; none in the chain means unrestricted. Replaces the D10 probe (`liveness.ts` deleted). Test "Declarations are not enforced outside any scope" now holds in general. `test/examples` "uses declaration stops applying" rewritten for the new semantics (not a conformance test).
- D18 (rfc:0003): default id `store.<n>` from a module counter (supersedes D14 default `"store"`); `stores()` returns a live registry Map (internal, `src/internal/registry.ts`), entries removed by `onDispose` of the creating scope; a live duplicate id throws before anything is created.
- D19 (rfc:0007): `Store` exposes readonly `schema` and `id`; `Transaction` exposes readonly `schema` (alias of `payload`) and `store` (set after `self` exists; `define` runs only on call, so no TDZ). Tests: conformance/schema-exposed.test.ts.
- D20 (rfc:0011): `Store.check(state)` parses `state` with `schema`, then runs every guard in `guards`; `ok(parsed)` or `err(store.invariant)` with data `{ transaction: "" }` (a schema-rejected candidate is also `store.invariant`, so the type stays one code). No commit, log entry, or signal write. Tests: conformance/check.test.ts.

## Verification
- [x] conformance green (22 tests) · properties present · `pnpm --filter @keel/store check` clean · structure-lint clean for store · build ok
- Root structure-lint red only outside store (`packages/forms/conformance/fixtures.ts` S0003; other task).
- Mutation: `mutate` script for store is `echo skip`; the 80% threshold is not measured.

Test trailer (`pnpm --filter @keel/store test`): `ok 49 tests, 0 failed, 0 skipped (0.5s)`

## Next action
review
