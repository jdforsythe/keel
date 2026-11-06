# k.store: Store and transactions
status: proposed

**API.**
```ts
export const cart = store(CartSchema, { items: [] })
export const addItem = transaction('cart.addItem', s.object({ item: Item }), (state, { item }) => ({ ...state, items: [...state.items, item] }))
```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload)`. Log: `cart.log()` ordered entries `{ name, payload, at, id }`; `cart.snapshot()`, `cart.restore(snap)`, `cart.undo()`.

**Ownership.** A component declares `uses: [addItem]`; calling an undeclared transaction is E1301. Transaction functions must be pure: E1302 on any `ctx` or global access.

**Conformance.** Transactions are deterministic for equal inputs; log replay reproduces state; undo is exact inverse; snapshot round-trips through JSON.
