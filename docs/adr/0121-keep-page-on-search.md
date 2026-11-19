# ADR-0121: a search-only navigation keeps the page (RFC 0098)

**Status:** proposed; the orchestrator accepts or reverses it under the WORKFLOW RFC defaults.

**Context.** Every committed navigation renders the page from scratch: the router root keys its `list` row by the `View` object, and `props.search` is a plain value per view. A sort, page, filter or `TableSearch` change on a table route therefore rebuilds the page. The table's `status` live region is a new node, which screen readers usually do not announce; focus survives only through k.head's same-id refocus; local signals, selection, typed text, open widgets and scroll reset. std-tables carries two module-level maps keyed by id (`pagerFocus`, `typed`) to hand state across the rebuild. Revalidation already keeps the page and updates `data` in place, and since RFC 0097 bindings are the only way a built component updates.

**Decision.**
- D1: the root `list` keys a view that rendered without an error by its path (`v.error === null ? splitUrl(v.url).path : v`). A navigation to the rendered page's path (only the search or hash differs) whose guards and loaders succeed commits a new `View` under the same key, so the page stays; anything else renders anew.
- D2: `renderView` takes the row's `item` getter; `search` is a getter like `data`, `params` stays a plain value. Titles are computed per view and written at each commit, as today.
- D3: every guard and every loader in the chain re-runs, as on any navigation.
- D4: a route `Boundary` showing its `errorElement` after a render or binding throw resets on the kept page's next navigation.
- D5: the last navigation started wins (the existing token); superseded loads are dropped, not aborted.
- D6: `DataTable`'s `pagerFocus` map becomes per-instance state and an `effect`; `TableSearch`'s `typed` map becomes a "last sent" rule that keeps the input's text while its navigation loads.
- Spec: k.router (1,499 tokens), k.head (878), k.testing (1,416); three new ledger items. No new code.
- Budgets: none re-based. router 10,431 B (+64, 65 left), std-tables 4,096 B (-78).

**Alternatives.**
- Keep only live regions across the rebuild, rejected: a second mechanism beside the page that still loses focus, selection, typed text and open widgets.
- A route-level `keep` opt-in, rejected: a new user-facing API shape and two behaviours for one navigation; a route that forgets it stays inaccessible.
- Leave the rebuild and document a pattern, rejected: the pattern is the module-level maps keyed by id (PRINCIPLES 2), and every app page keeps resetting.
- Re-run only loaders whose declared `search` changed, rejected: every loader gets `search` and `url` whatever it declares, so a skipped layout loader could serve stale data.
- One mutable `View` with `search` and `url` cells, rejected: more state and branches in `commit` and `revalidate` for the same result; keying by path reuses new-view-per-navigation.

**Consequences.**
- With D1 to D6 on a copy of the tree, all 39 package and app suites pass. The router part alone turns 7 tests in 3 std-tables files red: `test/review.test.ts:74` asserts the rebuild (flipped), two tests after it fail by cascade, `conformance/sort-link.test.ts` reads `search` and `data` once in its fixture (`conformance/fixtures.ts:113`, `:116`, given getters), and `conformance/pager-focus.test.ts` needs D6. The router and std-tables changes land in one commit.
- golden-2's catalog keeps its selection, tab, finder text and open widgets across sort, page, filter and search; golden-1's lists keep the add-todo draft across filters. No app file changes.
- A page reading `props.search` at its top level shows the value at build after a search-only navigation; E1405 reports the static case.
- A navigation to the identical URL keeps the page and re-runs its loaders.
- k.ui's string-only `label` (0599) stays separate; a label derived from `search` now keeps its first value across a kept navigation.
- Resume is untouched: a server-rendered document has no client router.
