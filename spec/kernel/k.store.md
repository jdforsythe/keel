# k.store: Store and transactions
status: implemented

**API.**
```ts
export const cart = store(CartSchema, { items: [] })
export const addItem = transaction(cart, 'cart.addItem', s.object({ item: Item }), (state, { item }) => ({ ...state, items: [...state.items, item] }))
```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload)`. Log: `cart.log()` ordered entries `{ name, payload, at, id }`; `cart.snapshot()`, `cart.restore(snap)`, `cart.undo()`. `stores()` returns the live stores by id. `cart.check(state)` returns `Result<T, KeelError<'store.invariant'>>`: ok iff `state` parses with `schema` and every `invariant` holds, without committing or logging. A store exposes readonly `schema` and `id`; a transaction exposes readonly `schema` (its payload schema) and `store`. `snapshot()` is `{ state, log, initial }`.

**Ids and invariants.** `store(schema, initial, { id, clock? })`: `id` is the stable store id `<module>.<export>`; the compiler fills it from the export name when omitted (runtime default `store.<n>` from a module counter); it keys `state()` in the harness and the `k-state` snapshot. `invariant(store, fn)` declares a predicate over state checked after every transaction; a violation returns `err` with code `store.invariant` and rolls back; it is declared once, next to the store, and `@keel/testing` runs it under generated payloads. A payload failing its schema returns `err(schema.invalid)`; an undeclared transaction returns `err` with code `store.undeclared` (runtime form of E1301). Log entry `at` comes from `clock` (default: a counter); never from `Date`.

**Ownership.** A component declares `uses: [addItem]`, bound to the declaring scope (`owner()`); `tx` consults the declarations of the calling scope and its ancestors, and a caller with none in its chain is unrestricted. Calling an undeclared transaction from a component is E1301; loaders and actions (k.router) run outside component scopes and are unrestricted. Transaction functions must be pure: E1302 on any `ctx` or global access.

**Conformance.** Transactions are deterministic for equal inputs; log replay reproduces state; undo is exact inverse; snapshot round-trips through JSON; `restore` replaces the base `undo` replays from with the snapshot's `initial`; of two sibling scopes, the one declaring `uses` is restricted and the other is not; `stores()` lists stores whose owning scope is live and drops one on disposal; a duplicate live id throws; `check(state)` returns ok iff every invariant holds and never changes state or log; `store.schema` parses every state the store accepts and `transaction.schema` parses every payload `tx` accepts.
