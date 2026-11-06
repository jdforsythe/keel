# k.store: Store and transactions
status: implemented

**API.**
```ts
export const cart = store(CartSchema, { items: [] })
export const addItem = transaction(cart, 'cart.addItem', s.object({ item: Item }), (state, { item }) => ({ ...state, items: [...state.items, item] }))
```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload)`. Log: `cart.log()` ordered entries `{ name, payload, at, id }`; `cart.snapshot()`, `cart.restore(snap)`, `cart.undo()`.

**Ids and invariants.** `store(schema, initial, { id, clock? })`: `id` is the stable store id `<module>.<export>`; the compiler fills it from the export name when omitted (runtime default `store.<n>`); it keys `state()` in the harness and the `k-state` snapshot. `invariant(store, fn)` declares a predicate over state checked after every transaction; a violation returns `err` with code `store.invariant` and rolls back; it is declared once, next to the store, and `@keel/testing` runs it under generated payloads. A payload failing its schema returns `err(schema.invalid)`; an undeclared transaction returns `err` with code `store.undeclared` (runtime form of E1301). Log entry `at` comes from `clock` (default: a counter); never from `Date`.

**Ownership.** A component declares `uses: [addItem]`; calling an undeclared transaction is E1301. Transaction functions must be pure: E1302 on any `ctx` or global access.

**Conformance.** Transactions are deterministic for equal inputs; log replay reproduces state; undo is exact inverse; snapshot round-trips through JSON.
