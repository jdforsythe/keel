# k.testing: Harness and properties
status: implemented

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
t.dispose()
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), ctx, dispose() }`; `ctx` is the one it runs on (`SimCtx` if none given). `props` and each `[store, value]` in `state` are schema-parsed first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller?, user? })` runs the route's guards and loaders (given `caller` and `user`, default `''`; k.user Testing), then renders its chain, resolving when the page is ready. `renderRoute(id, { url })`: a raw path and query, parsed as a navigation parses it, for `params` and `search`. Route handles have `location()`: `{ entries, scrollY }`, history length and scroll. A `url` that is not a root-relative path and query of page `id` is E1501; each route harness starts and ends scrolled to the top. Loaders and actions naming `stores` run their factories over `ctx.storage` as a `node` deployable does (k.server Server state), one request per navigation or submit; `state` holds no factory store.
- With `app` (a `createApp` result) `renderRoute` runs a built `node` page, no router: a GET to `app`, resumed as by `resumeDocument` in its own browser (k.mount Testing). A valid `<Form>` submit (k.mount Form) is POSTed urlencoded, `sec-fetch-site: same-origin`, to `app`; a 303 is followed with a GET; the answer (a 422 too) replaces the page, resumed, before `fire` resolves. A `Link` click or `navigate` to a path of `app` loads so; `documents()` lists every document. With `routes: () => import(path)` the page resumes likewise (E1722 without `app`), so each harness owns its client stores, widgets and islands; server state on `ctx` is shared. Without `app` a router renders.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change` with optional `value`, `keydown` with `key` and optional `shift`, `alt`, `mod`, `submit`, `focus`, `blur`; both move focus). It resolves once effects, resources and actions are quiet. An event goes where a browser sends it; `keydown` and `change` with `value` are dispatched as follows, the rest at `id`.
- `keydown` goes to the document's focused element, as a key press does. With focus on `id` or inside it, it is dispatched there and bubbles through `id`, and no focus event fires. With focus elsewhere and `id` focusable as `focus` requires, `fire` first moves focus to `id` as `focus` does and settles, then dispatches at `id`; that focus is no person's act (k.opening). Otherwise it is E1719 and nothing moves or is dispatched.
- `change` with `value` is a person's pick in a `<select>` without `multiple`: the enabled option whose value is `value` becomes selected, then `input` (bubbling, composed) and `change` (bubbling) are dispatched at the select, in that order, each seeing the new value. A pick of the option already selected dispatches nothing. `value` on another element or a `multiple` select, or naming no enabled option, is E1726 and nothing changes. `change` without `value` dispatches `change` alone, and `input` with `value` writes it and dispatches `input` alone, a select's too.
- `settle()` runs the loop `fire` uses without an event (bounded microtask rounds until DOM and store logs are quiet, no timers), then the render checks; route handles have it too, and `navigate(href)`, resolving when the page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by id.
- `resumeDocument(html, { routes, ctx? })`: a server document's islands resumed, as a `render` handle (a resume warning, a mismatch too: E1720).
- Tests address elements by id only.
- `resumeDocument(html, { routes: () => import(path) })` resumes in a module graph of its own: each module the import reaches, `@keel/store` too, is evaluated anew.

**ctx.** Harness renders use a sim ctx (k.ctx); under `keel test` (`KEEL_TEST=1`) a test's `ctx` defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused?, active?, sort?, rowindex?, rowcount? }, children }`, with implicit roles and accessible names per WAI-ARIA: `checked` is `'mixed'` for a mixed checkbox, `active` is the id `aria-activedescendant` names, `sort` is the `aria-sort` value, `rowindex` and `rowcount` the integer `aria-rowindex` and `aria-rowcount`. After the first render and after every `fire`, the harness runs the render checks of k.a11y.

**Properties.**
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders of one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants: `invariant(store, fn)` from `@keel/store`, beside the store (`@keel/testing` re-exports nothing). `KEEL_SEED=<n>` replays a run's seed. Under `keelConfig` a test that calls `properties` or `simulate` and declares no timeout is given 300 ms per run its calls name, at least the configured test timeout; a call reached through a helper is not counted, and a call inside a loop counts once.

**Failure output** (OUTPUT.md): one diagnostic per failure: a property failure's seed, run count and shrunk case; a state mismatch, one compact diff.

**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate`: k.sim. When a handle is disposed and how a run's errors print: k.test-run. The requests a page sent (`requests()`): k.requests.

**Rules.** E1701 a DOM selector or query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (nearest ids listed) · E1719 `fire` `focus` on an unfocusable element, `blur` off an unfocused one, or `keydown` on an unfocusable one with focus outside it (`<id> cannot take focus, so no key press reaches it`) · E1720 (`resumeDocument`; a throw while an island claims is named with its thrown text, as the harness shows what a page threw while resuming) · E1726 `fire` `change` with `value` a person cannot pick (`<id> has no enabled option with that value`; `<id> takes no value on change: not a single select`) · E1722 `renderRoute` given `app` with `state` or `shell`, or `routes` as an import without `app` · E1724 (k.user Testing) · W1723 a literal `renderRoute` id of a `node` deployable's module, no `app` (`keel check`; fix: pass `app`).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- In a harness render `ctx.clock.now()` is the sim clock's, and two runs with one seed give equal `state()`.
- `fire` resolves only once every effect and resource it triggered has settled.
- `fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `settle()` shows its ready state without an event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking an `invariant` fails `properties()` with E1704.
- Under `keelConfig`, a test whose one `properties` call names 100 runs and declares no timeout has 30 s; one that declares a timeout keeps it; a test with no `properties` or `simulate` call keeps the configured timeout.
- `navigate(c.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
- `renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state.
- On one ctx, a save through `renderRoute` is read by `createApp`, and a save through `createApp` by the next `renderRoute` navigation.
- `resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720; an island whose component throws `new Error('boom')` while claiming is E1720 whose text holds `boom`.
- `find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`, `sort: 'ascending'` for a header with that `aria-sort`, and `checked: 'mixed'` for a mixed checkbox.
- `resumeDocument` with `routes` as an import: a module store written before the request is initial in `state()`; a `fire` leaves the test's instance unchanged.
- With `app`, a valid submit whose action answers `keel.fields` `{ amount: 'Too many decimals' }` leaves the amount field `invalid` holding the submitted value and that message, and one POST in `documents()` of exactly the named fields; an invalid submit reaches no action.
- With `app`, an action's `ok(href)` leaves `route().id` the target's, `location().entries` 2, and the target's loader run once through `app`.
- The same page without `app` records no document on a submit, and the `keel.fields` answer sets the field's error in process.
- Two harnesses of one page with `app`, `routes` as an import, a client store and a widget each resume and keep their own client state.
- `app` with `state` or `shell` rejects E1722, `app` unrequested; W1723 fires on `renderRoute('f.page', { routes })` when a `node` deployable serves `f`, not with `app` nor for a `client` one.
- `find(id).state` has `rowindex: 2` for a row with `aria-rowindex="2"` and `rowcount: 10` for a grid with `aria-rowcount="10"`, and no key for a value that is not an integer; `a11y()` gives a `th scope="row"` role `rowheader`.
- With focus on an `input` inside an unfocusable container, `fire(container, { type: 'keydown', key: 'Enter' })` calls the input's and the container's keydown handlers once each, `event.target` the input, and no focus or blur handler.
- With focus on another input, `fire(id, keydown)` on a focusable element runs the other input's blur handler, then `id`'s focus handler, then its keydown handler, and `find(id).state.focused` is then true; on the focused element it runs no focus or blur handler.
- With focus outside it, `fire(id, keydown)` on an unfocusable element rejects E1719 `<id> cannot take focus, so no key press reaches it` with `data` `{ id, type: 'keydown' }`; no handler runs and focus stays.
- On a `<select>` of `alex` (selected) and `sam`, `fire(id, { type: 'change', value: 'sam' })` runs its `input` handler, then its `change` handler, each reading `sam`, and an ancestor's too; the same call again runs none.
- `change` with a `value` of no option or of a disabled one rejects E1726 `<id> has no enabled option with that value`; on an `<input>` or a `multiple` select, E1726 `<id> takes no value on change: not a single select`; each with `data` `{ id, type: 'change' }`, no handler run, the value unchanged. `change` without `value` runs the `change` handler alone; `input` with `value` the `input` handler alone.
