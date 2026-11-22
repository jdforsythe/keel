# k.testing: Harness and properties
status: implemented

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
t.dispose()
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), ctx, dispose() }`; `ctx` is the one it runs on (a route handle: the app's; `SimCtx` if none given). `props` and each `[store, value]` in `state` are schema-parsed first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready. `renderRoute(id, { url })` takes a raw path and query, parsed as a navigation parses it, for `params` and `search`. Route handles also have `location()`: history length and scroll as `{ entries, scrollY }`. A `url` that is not a root-relative path and query of page `id` is E1501; each route harness starts and ends scrolled to the top. Loaders and actions naming `stores` run their factories over `ctx.storage` as a `node` deployable does (k.server Server state), each navigation or submit one request; `state` and `state()` hold no factory store.
- With `app` (a `createApp` result) `renderRoute` runs a built `node` page, no router: a GET through `app.fetch`, resumed on `ctx` as by `resumeDocument`, one browser keeping `app`'s cookies, so `app` mints `caller`. A valid `<Form>` submit (k.mount Form) is POSTed urlencoded, `sec-fetch-site: same-origin`, to `app`; a 303 is followed with a GET; the answer (a 422 too) replaces the page, resumed, before `fire` resolves. A `Link` click or `navigate` to a path of `app` loads alike; `documents()` lists every document, `location().entries` the loaded ones. Without `app` a router renders; a submit runs in process.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key` and optional `shift`, `alt`, `mod`, `submit`, `focus`, `blur`; both move focus). It resolves once effects, resources, and actions are quiet.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; route handles have it too, and `navigate(href)`, resolving when the page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by id.
- `resumeDocument(html, { routes, ctx? })`: a server document's islands resumed, as a `render` handle (a resume warning, a mismatch too: E1720).
- Tests address elements by id only.
- `resumeDocument(html, { routes: () => import(path) })` resumes in a module graph of its own: each module the import reaches, `@keel/store` too, evaluated anew.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused?, active?, sort?, rowindex?, rowcount? }, children }`, with implicit roles and accessible names per WAI-ARIA: `checked` is `'mixed'` for a mixed checkbox, `active` is the id `aria-activedescendant` names, `sort` is the `aria-sort` value, `rowindex` and `rowcount` the integer `aria-rowindex` and `aria-rowcount`. After the first render and after every `fire`, the harness runs the render checks of k.a11y.

**Properties.**
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared beside the store with `invariant(store, fn)` (`@keel/store`); `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, run count and shrunk case. State mismatches print one compact state diff.

**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate`: k.sim.

**Rules.** E1701 a DOM selector or query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (nearest ids listed) · E1719 `fire` `focus` on an unfocusable element, or `blur` off an unfocused one · E1720 (`resumeDocument`) · E1722 `renderRoute` given `app` with `state` or `shell` · W1723 a literal `renderRoute` id of a `node` deployable's module, no `app` (`keel check`; fix: pass `app`).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- `navigate(c.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
- `renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state.
- On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation.
- `resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720.
- `find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`, `sort: 'ascending'` for a header with that `aria-sort`, and `checked: 'mixed'` for a mixed checkbox.
- `resumeDocument` with `routes` as an import: a module store written before the request is initial in `state()`; a `fire` leaves the test's instance unchanged.
- With `app`, a valid submit whose action answers `keel.fields` `{ amount: 'Too many decimals' }` leaves the amount field `invalid`, holding the submitted value, its error text that message, and one POST in `documents()` of exactly the named fields; an invalid submit reaches no action.
- With `app`, an action's `ok(href)` leaves `route().id` the target's, `location().entries` 2, and the target's loader run once through `app`.
- The same page without `app` records no document on a submit, and the `keel.fields` answer sets the field's error in process.
- `app` with `state` or `shell` rejects E1722, `app` unrequested; W1723 fires on `renderRoute('f.page', { routes })` when a `node` deployable serves `f`, not with `app` nor for a `client` one.
- `find(id).state` has `rowindex: 2` for a row with `aria-rowindex="2"` and `rowcount: 10` for a grid with `aria-rowcount="10"`, and no key for a value that is not an integer; `a11y()` gives a `th scope="row"` role `rowheader`.
