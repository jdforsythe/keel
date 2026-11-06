# k.testing: Harness and ledger
status: proposed

**Harness.** `render(Component, { props, state })` -> `{ a11y(), state(), fire(id, event), find(id) }`. `renderRoute('orders.show', { params, state })`. Events by element ID only; DOM selectors are E1701.

**Properties.** For every component: renders for any valid props; no axe violations; deterministic. For every transaction: invariants declared with `invariant(store, fn)` hold under generated payloads.

**Ledger.** `keel ledger` emits `{ item, rung, evidence }` per public export and spec clause; CI fails on regression.

**Conformance.** Harness runs under sim ctx; property runs record seed; a failing property prints the shrunk case per OUTPUT.md.
