# k.testing: Harness and ledger
status: implemented

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
expect(t.state(cart).items).toHaveLength(1)
expect(t.find('cart.total').name).toBe('Total 3')
t.dispose()
const r = await renderRoute('orders.show', { params: { id }, search: {}, state: [], ctx: sim })
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { params, search?, state?, ctx? })` runs the route's guards and loaders, then renders its chain; it resolves when the page is ready.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`). It resolves once effects, resources, and actions are quiescent.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim. Pass `ctx` to control clock, seed, and net fixtures.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused? }, children }`, with implicit roles and accessible names per WAI-ARIA. After the first render and after every `fire`, the harness compares each element's role and name source with the compiler's `a11y.json` (passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, E1702 is not checked) and runs axe.

**Properties.**
```ts
properties(CartView)   // generated props and state
properties(addItem)    // generated state and payload
```
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.
```
E1704 cart/addItem.test.ts:3:1 invariant cart.nonNegative failed (seed 4021, run 37, shrunk)
  payload: {"item":{"id":"i1","qty":-1}}
```

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`) and per spec clause (`k.router#3`, the 1-based Conformance sentence). A conformance test names its clause in a header comment: `// Spec: k.router, clause "<sentence>"`. `rung` is the highest held (docs/TESTING.md):
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a property whose generator's finite domain was fully enumerated.
- `proven`: a passing type-level test or prover output; nothing else may claim it.
- `monitored`: production only; never emitted by the kernel. No evidence: `none`.

`keel ledger --diff` compares with the committed ledger.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids) · E1706 ledger rung lower than committed.

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `a11y()` for `<Button label="Save" disabled />` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
