# k.testing: Harness and ledger
status: conformance-covered

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
t.dispose()
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`; both move focus). It resolves once effects, resources, and actions are quiescent.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; `renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- `resumeDocument(html, { routes, ctx? })`: a server document's islands resumed, as a `render` handle (a resume warning: E1720).
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused? }, children }`, with implicit roles and accessible names per WAI-ARIA. After the first render and after every `fire`, the harness compares each element's role and name source with the compiler's `a11y.json` (passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, E1702 is not checked) and runs axe.

**Properties.**
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`) and per spec clause (`k.router#3`, the 1-based Conformance sentence). A conformance test in any package names its clause in a header comment, `// Spec: k.router, clause "<sentence>"`, quoted verbatim (backticks, quote style, spacing, case and the final period aside; it may wrap onto the next `//` lines). `rung` is the highest held:
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a property whose generator's finite domain was fully enumerated.
- `proven`: a passing type-level test or prover output; nothing else may claim it.
- `monitored`: production only; never emitted by the kernel. No evidence: `none`.

`keel ledger --diff` compares with the committed ledger and checks every `conformance-covered` or `frozen` section's clauses.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids) · E1706 ledger rung lower than committed, or unsafe count higher · E1719 `fire` `focus` on an unfocusable element, or `blur` off an unfocused one · E1720 (`resumeDocument`) · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it to `// Spec:`).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
- A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line.
- `navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
- `resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720.
