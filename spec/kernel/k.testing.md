# k.testing: Harness and properties
status: conformance-covered

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
t.dispose()
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready. Loaders and actions naming `stores` run their factories over `ctx.storage` as a `node` deployable does (k.server Server state), each navigation or submit one request; `state` and `state()` hold no factory store.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`; both move focus). It resolves once effects, resources, and actions are quiescent.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; `renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- `resumeDocument(html, { routes, ctx? })`: a server document's islands resumed, as a `render` handle (a resume warning: E1720).
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused?, active?, sort? }, children }`, with implicit roles and accessible names per WAI-ARIA: `checked` is `'mixed'` for a mixed checkbox, `active` is the id `aria-activedescendant` names, `sort` is the `aria-sort` value. After the first render and after every `fire`, the harness runs the render checks of k.a11y.

**Properties.**
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.

**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate` and schedules: k.sim.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids) · E1719 `fire` `focus` on an unfocusable element, or `blur` off an unfocused one · E1720 (`resumeDocument`).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- `navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
- `renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state.
- On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation.
- `resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720.
- `find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`, `sort: 'ascending'` for a header with that `aria-sort`, and `checked: 'mixed'` for a mixed checkbox.
