# RFC 0098: a search-only navigation keeps the page

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 1, 2, 3, 6; open questions answered as recommended; the user confirms or reverses, tasks/0337-s7-ui-modules/PLAN.md D24). For backlog 0593; 0599 stays separate (Known limits). Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0121 records it.

## Decisions
- D1: a navigation to the rendered page's path keeps the page. The router's root `list` keys the committed view by its path when the view rendered without an error (`v.error === null ? splitUrl(v.url).path : v`), not by the view object. A navigation whose path equals the rendered page's (only the search or hash differs) and whose guards and loaders all succeed commits a new `View` under the same key, so the row stays and its `item()` is the new view. Any other navigation, a failing guard or loader, or a page that showed its `errorElement` gets a new key and renders anew, as today (defaults 3, 2).
- D2: `search` becomes a getter, like `data`. `renderView` takes the row's `item` getter; each level's props are `{ params, get search(), get data() }` reading the current view, so a binding reading `props.search` or `props.data` updates in place. `params` stays a plain value: a kept page never sees new params. `title` (k.head) is computed per view from plain props, as today, and `writeHead` runs at each commit (default 3).
- D3: every guard and every loader in the chain re-runs on a kept navigation, exactly as on any navigation today. No per-loader skip (Alternatives).
- D4: a route `Boundary` that caught a throw from its page's render or bindings is reset by the kept page's next navigation, so a kept page retries a broken level the way a rebuilt one does (default 6).
- D5: the last navigation started wins (the existing `token`), now stated. A superseded navigation's guards and loaders run to completion and their results are dropped; nothing is aborted (Questions 1).
- D6: the two std-tables workarounds for the rebuild go: `DataTable`'s module-level `pagerFocus` map becomes per-instance state and an `effect` on its view; `TableSearch`'s module-level `typed` map becomes a "last sent" rule that keeps the input's text while `search.q` is the value it sent (default 2; PRINCIPLES 2).

New codes: none. No compiler, runtime-dom or testing source changes.

## Problem
Measured on `jdforsythe/test-impl` at `d322c3d`.

**What a search-only navigation does today.**
- `go` (`packages/router/src/internal/createRouterWith.ts:218-246`) and `proceed` (`:191-216`) run every guard, then every loader of the chain, then `commit` a new `View` from `makeView` (`:108-128`, `:142-173`). The root renders the committed view through a `list` keyed by the view object (`:366-374`: `(v) => v`), so every commit, a search-only one included, disposes the old row and renders the page from scratch.
- `props.params` and `props.search` are plain values per view (`renderView.ts:15`, `{ params: v.params, search: v.search }`); only `data` is a getter over the level's cell (`:20-23`). A kept page could not see a new search without D2.
- Revalidation already keeps the page: `revalidate` (`:248-266`) sets the current view's cells in place and commits a new view only on a failure (`:261`).

**Consequences, each with a test that shows it.**
- A table's `status` live region is a new node after each sort, page, filter or search change (`packages/std-tables/src/DataTable.ts:246-252`, `role="status"`). A screen reader announces a change to a live region's content, not a new region inserted with its text, so the page change usually goes unannounced. `packages/std-tables/test/review.test.ts:74-83` asserts the rebuild itself: "a search-only navigation rebuilds the page, so search is read fresh", `cat.table` is a new element after a sort.
- Focus survives only because k.head moves it to the element with the same id: `afterNavigate.ts:14-19` refocuses `document.getElementById(kept.id)` when the focused element left the document. `packages/std-tables/conformance/sort-link.test.ts:13` ("after its activation focus stays on it") passes through that path today.
- `DataTable` hands pager focus across the rebuild through a module-level map keyed by table id (`DataTable.ts:16-17`, `:253-268`, `:306-316`), and `TableSearch` keeps text typed past 200 characters through another (`TableSearch.component.ts:12-13`, `:35-40`, `:48-49`). Both are state shared by id between instances (PRINCIPLES 2).
- A page's local signals, open disclosures and menus, a Combobox's typed text, selection and scroll containers reset. In golden-2's `recipes.catalog` (`apps/golden-2/modules/recipes/CatalogPage.tsx:51-53`), sorting or paging clears `picked` (the row selection the table's `selectAll` spans across pages), resets the finder's `typed` text and the open tab. In golden-1's `todos.list` (`apps/golden-1/modules/todos/ListPage.tsx:29`, `:36`), a filter link clears the add-todo form's draft.
- Text typed while a `TableSearch` navigation loads is lost: the new page's input shows the `q` that was sent. Measured on the prototype with a loader held open (`test/race98.test.ts` in the scratch tree): today's `TableSearch` shows `pie` after `pies` was typed during the load.
- Every component on the page is built again.

**Since RFC 0097.** Every unit is built untracked, so the only things that update a kept page are bindings, `computed`, `effect` and op inputs (`pnpm spec k.component` Build). The router root is a keyed `list` and `data` is a getter that revalidation updates in place (`pnpm spec k.router` Manifest). The two widget packages bind every prop an app can change (`DataTable.ts:31-41`, `packages/std-tables/test/liveProps.test.ts:66`): a kept `DataTable` given getter `search` and `page` stays correct.

**What relies on the rebuild.** Measured by applying the router part of D1 and D2 alone to a copy of the tree and running all 39 package and app suites:
- Red: 7 tests in 3 files, all in `packages/std-tables`.
  - `test/review.test.ts:74-83` asserts the rebuild (flip it).
  - `test/review.test.ts:85` and `:100` fail only by cascade: the failing assertion at `:80` skips `h.dispose()`, so the next harness sees two `cat.pager` landmarks (E1703). Green once `:74` is flipped.
  - `conformance/sort-link.test.ts:13`, `:40`: the conformance fixture passes `search: queryOf(props.search)` and `page: pageOf(props.data)` as plain values (`conformance/fixtures.ts:113`, `:116`), read once at build. Green with getters.
  - `conformance/pager-focus.test.ts:10`, `:26`: the `pagerFocus` map moves focus only at build; on a kept page the `next` link is removed by its `If` and focus falls to `<body>`. Green with D6.
- Green with no edit: the other 36 suites, including golden-1 (124 tests, the one `it.fails` as on the base), golden-2 (75, whose `catalog.test.ts` sorts, pages and searches), inspector (17), sessions (14), router (299), testing (468), runtime-dom (446), std-headless (106), std-sessions (315).
- A grep of every test under `packages/*/test`, `packages/*/conformance` and `apps/*/test` for node identity asserted across a navigation (`not.toBe(` on an element, "rebuil", "re-render", "read fresh") finds no other route test.

**What apps read at build.** golden-2 `CatalogPage.tsx` passes `search={props.search}`, `page={props.data.page}`, `to={href(refine(…))}` and `selected={() => [props.search.currency ?? "any"]}`: compiled JSX gives getters, `DataTable`, `TableSearch` and `Link` (`packages/ui/src/elements/Link.ts:23`) bind them. Its labels come from `props.data.text`, fixed per locale param. golden-1 `ListPage.tsx:36` reads `props.search.filter` inside `shown()`, called from a `For`'s `each` (`:122`); `:38` reads `props.params.listId` once, and params never change on a kept page. Inspector and sessions have no route with a `search` schema.

## Proposal

### D1. The root keys the page by its path
In `createRouterWith.ts:372`, the key becomes:

```ts
// A page that rendered keeps its row across navigations to its path: only the search or hash differs.
(v) => (v.error === null ? splitUrl(v.url).path : v),
(v) => renderView(v, ctx),
```

The canonical path encodes the route and its params (`matchUrl.ts:53-63`), so an equal path is the same route with the same params; two paths with equal parsed params (a param with two encodings) render anew, which is the conservative side. The view stays immutable and is still made per navigation (`makeView`), so its `head`, `data` cells and `scope` work as today; `commit` disposes the previous view's scope after the batch has moved every binding to the new view's cells. The `kept` element in `commit` (`:160`) is still connected after a kept navigation, so `afterNavigate` moves no focus (`afterNavigate.ts:17`), and the path is unchanged, so scroll stays (`:28`). History (`push`, `replace`), `location()`, `route()`, `pending` and the `nav` report are untouched: they are per navigation, before and at `commit`.

A view whose `error` is set (a loader or guard failure, a 404) keys by itself: an `errorElement` that was showing is replaced by a fresh render when the next navigation succeeds, and a navigation whose loader fails renders the nearest `errorElement`, as revalidation does (`:261`).

### D2. `search` is a getter
`renderView(v: () => View, ctx)`, `levelAt` and `componentAt` take the row's `item` getter. Each level's props:

```ts
{
  params,
  get search() { return v().search; },
  get data() { return v().data[i]?.get(); },
}
```

plus `children` for a layout. `chain`, `params` and `error` are read once at build: they are fixed for a key. `RouteProps.search` keeps its type (`readonly search?: unknown`); its doc comment says it is a getter like `data`.

A page reading `props.search` at its top level gets the value at build, as for `data` today. E1405 already reports the static case (`const sort = props.search.sort` used in JSX); a read through a function call is the case RFC 0097 declined to diagnose. No new code.

### D3. Guards and loaders
`proceed` is unchanged: every guard, outermost first, then every loader of the chain concurrently, each with the new `search` and `url`, one `state.request()` per navigation. A denial redirects to another route (a new view); a guard's non-denial `err` and a loader's `err` commit an error view (a new key).

### D4. A route Boundary retries on the next navigation
In `renderView.ts`, the per-level `boundary` fallback watches the row's item and resets when it changes:

```ts
boundary(anchor, render, (error, reset) => {
  const seen = v();
  effect(() => {
    if (v() !== seen) reset();
  });
  return errorAt(now, i, error);
});
```

Without it, a binding that throws on one search would leave the `errorElement` in place across every later search-only navigation; today each navigation rebuilds the level. The root boundary already resets at each commit (`resetRoot`, `:168-170`).

### D5. The last navigation wins
Unchanged code: `go` increments `token`, and `proceed` and `commit` drop a result whose token is stale (`:143`, `:201`, `:214`). A `TableSearch` user typing quickly starts several replace navigations; each runs its guards and loaders, the last one's page and `route()` show whatever order they settle in, and `pending` stays true until it commits. Superseded promise loaders are not aborted: k.server gives `signal` to live loaders only, and `firstYield` already aborts a live loader after its first yield.

### D6. std-tables
- `DataTable.ts`: the `pagerFocus` map, its `Scope` and `owner` imports and the build-time check go. A local `was` (`next`, `previous` or empty) is set by the pager's `focusin` and cleared by a `focusout` with a `relatedTarget`; an `effect` on `view` queues the same microtask as today when `was`'s link no longer exists on the new page. The std.tables sentence "When a navigation removes the focused pager link, focus moves to `status`" holds unchanged.
- `TableSearch.component.ts`: the `typed` map goes. The input keeps its text while `search.q` equals the `q` it last sent (typing goes on while the navigation loads); any other `q` (back, forward, a link) replaces the text and becomes the new baseline. Text past 200 characters stays in the input because the input stays.
- `conformance/fixtures.ts:113`, `:116`, `:138`: `search` and `page` passed as getters.

Measured on the prototype: std-tables `vitest run` passes 42 of 42 with the typing test, and the typing test fails on today's `TableSearch` (`expected 'pie' to be 'pies'`).

## Alternatives
- **Keep only live regions across the rebuild.** Rejected: it needs a registry of nodes carried from one render to the next beside the page, a second mechanism for one symptom, and still loses focus without k.head's id lookup, selection, typed text, open widgets and scroll (default 2).
- **A route-level opt-in (`keep: true` in the manifest).** Rejected: a new hand-written user-facing API shape, two behaviours for one navigation (default 2), and every table route would need it; a route that forgets it is silently inaccessible.
- **Leave as is and document a pattern (a live region in a layout, a module-level map per widget).** Rejected: the pattern is the two maps D6 removes, state shared by id between instances (PRINCIPLES 2), and it leaves every app page resetting; kernel enforcement beats a documented discipline (defaults 6, 1).
- **Re-run only loaders whose declared `search` changed.** Rejected: every loader gets `search` and `url` whatever it declares (`createRouterWith.ts:210`), so a layout loader without a `search` schema can read the query from `url`; skipping it would serve stale data. It would need per-level equality on parsed values and a second rule beside `ok(null)`'s "re-runs every loader" (default 2). Loads on a search change are already one request per navigation.
- **Keep one `View` and set its `search` and `url` cells in place, as revalidation sets `data`.** Rejected: the `View` gains three mutable cells, `head` must be recomputed and written beside `commit`, and `revalidate`, `commit` and `failedAt` all need a kept-view branch. Keying the row by path reuses the existing new-view-per-navigation path and the `list` row's `item` getter; it is 31 B against an estimated 80 B.
- **Keep the page for a params change too.** Rejected for now: a new param is usually another record, k.head's id refocus covers it, and layouts and pages read `params` once by contract. Questions 2.

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/kernel/*.md` at `d322c3d`. Unchanged: k.component (1,458; its Build paragraph already lists "a route"), k.guards (284; "every guard in the chain runs, outermost first, before any loader" covers a kept navigation), std.tables (1,499; its pager focus sentence holds, and D6 needs no new sentence).

### k.router (1,343 to 1,499)
**Manifest**, the sentence on `component`, replacement text:

> `component` receives `{ params, search, data }`, `data` being its loader's `ok` value; `search` and `data` are getters that revalidation and a kept page update in place (a top-level read keeps the value at build, k.component);

**Client**, the sentence ending "until the new chain's loaders finish.", replacement text:

> `pending` is true while a navigation or action runs; the previous page stays rendered until the new chain's loaders finish, and the last navigation started wins. A navigation to the rendered page's path (only the search or hash differs) keeps the page when its guards and loaders succeed: no node is rebuilt. Otherwise the page renders anew.

**Conformance**, appended:

> - After a search-only navigation each guard and loader of the chain ran once more and the page keeps its nodes, focus and local signals, and its `props.search` and `props.data` bindings update; a loader `err` renders the `errorElement`, a params change a new page.
> - Of two navigations started before either settles, the later one's page shows in either settle order.

### k.head (818 to 878)
**Client**, from "a navigation within one route keeps focus" to the end of the paragraph, replacement text:

> a navigation within one route keeps focus: a kept page (k.router) keeps the focused element, a page rendered anew focuses the element with the same id. Revalidation (an action's `ok(null)`) moves neither focus nor scroll. Neither it nor a kept page rebuilds an element or text node.

**Conformance**, appended:

> - After a search-only navigation, `document.title` is the route's `title` for the new search and data, and the focused element and every `role="status"` node are the same nodes as before.

### k.testing (1,417 to 1,416)
**Harness**, the `settle()` bullet's last clause, replacement text:

> and `navigate(href)`, resolving when the page is ready.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:

New files:
- `packages/router/conformance/search-only-keeps-page.test.ts`:
  - `// Spec: k.router, Conformance "After a search-only navigation each guard and loader of the chain ran once more and the page keeps its nodes, focus and local signals, and its `props.search` and `props.data` bindings update; a loader `err` renders the `errorElement`, a params change a new page."`
  - `// Spec: k.router, Client "A navigation to the rendered page's path (only the search or hash differs) keeps the page when its guards and loaders succeed: no node is rebuilt. Otherwise the page renders anew."`
  - A route under a layout, both with loaders, the page with a guard, a `search` schema, an `errorElement` and a `title`; the page holds a local `signal` shown in a binding, binds `props.search` and `props.data`, and has a focused button. After `navigate` with a new search (push and replace): the same `main`, the same focused element, the local value kept, both bindings new, guard and both loaders counted once more, `route()` the new search with `pending` false, history length +1 for a push and +0 for a replace. A loader `err` on one search renders the `errorElement`; the next search renders the page as new nodes with the local value reset. A params change gives a new `main`. A hash-only navigation keeps the page. `// Seed: 1337.` Plus a property over generated search sequences: one build, loads = 1 + navigations, binding text = the last search.
- `packages/router/conformance/last-navigation-wins.test.ts`:
  - `// Spec: k.router, Conformance "Of two navigations started before either settles, the later one's page shows in either settle order."`
  - `// Spec: k.router, Client "the last navigation started wins"`
  - A loader held open per search: two search-only navigations, then released in both orders; the binding, `route().search` and the page element are the second's, `pending` true until it commits. The same for a search-only navigation followed by one to another route.
- `packages/router/conformance/head-search-only.test.ts`:
  - `// Spec: k.head, Conformance "After a search-only navigation, `document.title` is the route's `title` for the new search and data, and the focused element and every `role="status"` node are the same nodes as before."`
  - `// Spec: k.head, Client "a kept page (k.router) keeps the focused element, a page rendered anew focuses the element with the same id."`
  - A titled route whose page has a `role="status"` node bound to `props.data` and a focused link: after a search-only navigation the title is `title` of the new props and both elements are the same objects; after a params change the focused element is the new page's element with the same id.

Changed files:
- `packages/std-tables/conformance/fixtures.ts:113`, `:116`, `:138`: `search` and `page` become getters (`get search() { return queryOf(props.search); }`, `get page() { return pageOf(props.data); }`) in `catalog` and in the `TableSearch` call. This keeps `sort-link.test.ts:13`, `:40` green; their assertions do not change.
- Kept green with no edit (all 39 suites run with the prototype): every other file under `packages/*/conformance/**`, including `packages/std-tables/conformance/pager-focus.test.ts` (green through D6), `table-search-input.test.ts`, the router's `push-focus-scroll.test.ts`, `head-focus.test.ts`, `pending-keeps-previous-page.test.ts`, `revalidate-data-binding.test.ts` and `loader-error-slot.test.ts`.

Outside conformance:
- `packages/std-tables/test/review.test.ts:74-83` becomes "a search-only navigation keeps the page: the table and its status are the same nodes" (`toBe(before)` for `cat.table` and `cat.status`).
- New `packages/std-tables/test/searchTyping.test.ts`: text typed while a `TableSearch` navigation loads stays in the input, and its next navigation sends it (the scratch `race98.test.ts`).
- New `packages/router/test/keptBoundary.test.ts`: a binding that throws on one search shows the `errorElement`; the next search-only navigation renders the level again (D4).
- Ledger: new items `k.router#14`, `#15` and `k.head#7`; no item changes text or number (the replaced Manifest, Client and Harness text is prose, not a clause).

## Lanes and build order
- **Step 1, orchestrator:** the spec diff in one commit (k.router, k.head, k.testing).
- **Step 2, one conformance-writer:** the three router files. Red until step 3.
- **Step 3, in parallel on disjoint files:** the kernel agent takes `createRouterWith.ts` and `renderView.ts` (D1, D2, D4) and the `RouteProps` doc comment, with `test/keptBoundary.test.ts`; the std-tables lane takes `DataTable.ts`, `TableSearch.component.ts`, `conformance/fixtures.ts`, `test/review.test.ts` and `test/searchTyping.test.ts` (D6), rebased on the std-tables edits in flight. The orchestrator commits both together: the router change alone turns `pager-focus.test.ts` red, and the `DataTable` change alone loses pager focus across today's rebuild.
- Root gates, budgets, golden-1, golden-2, inspector and sessions suites, mutation for router alone, ledger on a quiet tree, push. Changesets: `@keel/router` (minor: `search` is a getter and a search-only navigation keeps the page) and `@keel/std-tables` (patch).

## Migration
- Apps: none required. golden-1, golden-2, inspector and sessions pass unchanged. What changes for their users: golden-2's catalog keeps its row selection, open tab, finder text, open menus and scroll across sort, page, filter and search; golden-1's lists keep the add-todo draft across filter links.
- Stdlib: `DataTable.ts`, `TableSearch.component.ts` and the std-tables fixture (D6).
- Kernel: `createRouterWith.ts`, `renderView.ts`, `types/RouteProps.ts` (doc comment).
- An app outside the repo that reads `props.search` or a value derived from it at a page's top level (outside E1405's static reach) and relied on the rebuild sees the value at build after a search-only navigation. The fix is the one E1405 names: read it in a binding, or wrap the derived value in `computed`. This goes in the `@keel/router` changeset as a migration note.
- Docs, same commits: the `RouteProps`, `renderView` and `afterNavigate` doc comments; the `keel-widgets` skill shows `search={props.search}` already and needs no edit; `docs/guide` has no sentence on the rebuild (grep "rebuil", "search-only": no hit).

## Token impact
| section | before | after |
| --- | --- | --- |
| k.router | 1,343 | 1,499 |
| k.head | 818 | 878 |
| k.testing | 1,417 | 1,416 |

k.router has 1 token of room after this RFC; the next k.router change needs a trim or a split (Questions 4).

## Budget
Measured with `tooling/budgets.mjs`'s method (own code bundled from `src/index.ts`, dependencies external, minified, gzip) on the prototype.
- `@keel/router`: 10,367 of 10,496 B today; 10,431 B after (D1 and D2 +31 B, D4 +33 B), 65 B left. No re-base.
- `@keel/std-tables`: 4,174 to 4,096 B (both maps removed).
- `@keel/runtime-dom` 4,218 B and `@keel/testing` 13,036 B: untouched.

## Risks
- **Accessibility.** Improved: the `status` region is one node whose text changes, which is what screen readers announce, and focus stays on the activated sort link or pager link without an id lookup. The one regression found, pager focus after the last page's `next` link disappears, is fixed in the same commit (D6) and covered by `pager-focus.test.ts`. No ledger a11y claim names the rebuild.
- **Resumability.** None. A server-rendered document resumes without a client router (`packages/compiler/src/internal/entryCode.ts:61` mounts one only in a `client` deployable), so a search-only link there is a document request, as today. The server render is untouched.
- **Ledger.** Three new items with conformance files; none changes, none is lowered.
- **Stale reads in code outside the repo.** The behaviour change with no failing test in the repo (Migration).
- **Order inside `commit`.** The previous view's scope is disposed after the batch has moved bindings to the new cells; a binding that read a disposed cell would show `undefined`. Covered by the new conformance (bindings show the new values after many navigations).

## Known limits
- A superseded navigation's loaders run to completion; their results are dropped (Questions 1).
- A navigation to the identical URL (a second click on the same link) also keeps the page and re-runs its guards and loaders; today it rebuilds.
- Scroll containers inside the page keep their position across a page change; an app that wants a table scrolled to its top on a new page does it in an `effect` on `props.search`.
- 0599 stays separate: k.ui controls take `label` as a string, read at build. No repo label depends on `search` (labels come from `data.text`, fixed per locale param, and a locale change is a params change), but a label an app derives from `search` or from search-dependent `data` now stays at its first value across search-only navigations, where the rebuild refreshed it. Recommendation: take 0599 next.
- Revalidation still writes no title (unchanged); a kept navigation does.

## Questions
The defaults decide the shape: 1 (the two std-tables maps are a stdlib workaround for a kernel rebuild; the kernel keeps the page), 2 (one update path for a kept page, the one revalidation uses; no opt-in; the maps go), 3 (the existing keyed `list`, `View` and `proceed`; no new op or flag), 6 (the router keeps the page for every app; no documented pattern). No new user-facing API shape (`props.search` keeps its type), no privacy or auth change (guards re-run on every navigation), no external integration, no golden-app migration. Open points, with recommendations:
1. **Abort a superseded navigation's loaders.** It would need an `AbortSignal` passed to promise loaders, which k.server gives to live loaders only, and about 40 B of the router's 65. Recommendation: no now; `TableSearch`'s 300 ms debounce bounds the waste. File a backlog line if a costly loader shows it.
2. **Keep the page for a params change on the same route.** Recommendation: no. A new param is another record; k.head's same-id refocus covers focus; keeping would widen the read-once contract to `params`.
3. **State the `TableSearch` typing rule in std.tables.** The section has 1 token of room. Recommendation: no spec sentence; the std.tables text "an `Input` whose value is `q`" already allows the input's own text past `q`, and the behaviour is pinned by `test/searchTyping.test.ts`.
4. **k.router at 1,499 tokens.** Recommendation: split Client (navigation, scroll, focus) into its own section the next time k.router grows, through the RFC that grows it.
5. **D4's 33 B.** Recommendation: keep it. Without it a kept page's broken level stays broken until a navigation to another path, a regression against today's rebuild.

## 0593's seven points
1. Same page: the same path (route id and params) and a page that rendered without an error, with every guard and loader of the new navigation succeeding (D1). Not the chain's loader inputs.
2. `search` is a getter like `data`; `params` stays a plain value; the k.router Manifest sentence is replaced; `title` reads each view's plain props and updates at each commit (D2).
3. Guards re-run, every one, outermost first; a denial's redirect navigates to its route as a new page (D3).
4. k.head Client is amended (Spec diff): a kept page keeps the focused element with no move; the same-id refocus is for a page rendered anew. Scroll is already kept for a search-only navigation.
5. Migration: `DataTable`'s `pagerFocus` map and `TableSearch`'s `typed` map are removed, the std-tables fixture passes getters, `review.test.ts:74` flips; golden-2's `CatalogPage` needs no edit (it passes getters through JSX).
6. `route().pending` is true from the navigation's start to its commit and `nav` is reported once per navigation before its guards, superseded ones included, both as today; the last started wins (D5).
7. Budget: router 10,431 of 10,496 B, 65 B left (the estimate in RFC 0097, 124 B left, was on an older base).
