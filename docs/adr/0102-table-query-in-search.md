# ADR-0102: a table's query lives in the route's search, and one pure `applyQuery` serves loaders and browsers (RFC 0084)

**Status:** accepted (2026-11-11), user decisions D1 and D3, under the WORKFLOW RFC defaults 2, 3 and 4.

**Context.** Neither golden app paged a list, and k.router scrolled to the top after every push, so a link that changed only the search moved the reader away from the table. k.router's "focus `main`" sentence also disagreed with k.head's focus rule from RFC 0083.

**Decision.** std.tables, a new stdlib package `@keel/std-tables`. `columns(row, spec)` derives each column's kind and comparator from an `s.object` schema; `tableSearch(columns)` is the route's `search` schema (`sort`, `dir`, `page`, `q`, filter columns); `applyQuery` filters, sorts stably and pages, and the same function runs in a loader for a server source and in a computed for a client source. Sort and pager controls are links to the same route with a new search, inside a native table with APG Sortable Table semantics, `aria-sort`, `aria-rowcount` and `aria-rowindex`. k.router keeps scroll on a search-only push and points to k.head for focus, so k.head holds the one focus rule. A `.pii()` search column is refused (E2852), since `q` travels in the URL. Virtual rows are deferred (D3).

**Alternatives.**
- TanStack Table, rejected: code-defined columns and a second state model beside the route's search; its stable sort, ascending-first cycle, row id and row count are borrowed as semantics.
- Table state in a chart or a signal, rejected: no shareable URL, no back button, and no server paging through loaders.
- The ARIA grid pattern, rejected: it takes every cell into the keyboard model, where a record table keeps links and checkboxes in Tab order.

**Consequences.**
- k.router stays at 1,499 tokens; the `push-focus-scroll` conformance header changes under `rfc:0084`.
- golden-1's and golden-2's search-only links keep scroll.
- Two tables on one route share one query.
