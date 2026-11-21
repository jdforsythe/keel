---
"@keel/router": minor
"@keel/std-tables": patch
---

A navigation to the rendered page's path (only the search or hash differs) keeps the page when its guards and loaders succeed: no node is rebuilt, focus stays, and `props.search`, now a getter like `props.data`, updates its bindings; `title` is written at each commit, and the last navigation started wins. `DataTable` keeps pager focus per instance and `TableSearch` keeps text typed while its search loads.

Migration: a page that read `props.search` at its top level and relied on the rebuild now shows the value at build after a search-only navigation; read it in a binding or wrap the derived value in `computed`.
