# std.tables: Data tables
status: implemented

**Package.** `@keel/std-tables`, client-safe, no config. Exports `columns`, `tableSearch`, `tablePage`, `applyQuery`, `DataTable`, `TableSearch`. A table is a native `table` of `Part`s (k.aria), APG Sortable Table: links and checkboxes in Tab order, no grid keyboard model. Text, ids and `styles` follow std.headless.

**Columns.**
```ts
export const catalogColumns = columns(CatalogRow, {
  key: 'id', rowHeader: 'title', show: ['title', 'price', 'minutes', 'added', 'favorite'],
  sort: ['title', 'price', 'minutes', 'added'], search: ['title'], filter: ['currency', 'favorite'],
  compare: { price: (a, b) => a.minor - b.minor },
})
```
`columns(row, spec)` reads the `s.object` `row`. A field's kind comes from its schema: `text` (a string, or a format type whose JSON is a string), `number` (`s.int`, `s.number`), `enum`, `boolean`, `value` (anything else). `key` is a `text` or `number` field unique per row; `rowHeader` (default the first of `show`) renders as `th scope=row`. `sort` columns compare by kind: `text` with `Intl.Collator(locale)`, `number` numerically, `enum` in declaration order, `boolean` false first, `value` only through `compare`. `search` columns are `text`; `filter` columns are `enum` or `boolean`. Anything else, or a field `row` lacks, is E2851, thrown.

**Query.** `tableSearch(columns)` is the route's `search` schema (k.router), every key optional: `sort` (an enum of `sort`), `dir` (`asc`, `desc`), `page` (`s.int({ min: 1 })`), `q` (`s.string({ max: 200 })`, present when `search` is), and each `filter` column under its own name. A filter column named `sort`, `dir`, `page` or `q` is E2852; a `search` or `filter` column marked `.pii()` is E2852 too: the query is in the URL (k.privacy E1111). `tablePage(row)` is `s.object({ rows: s.array(row), total, page, pages })`. `applyQuery(columns, rows, search, { pageSize, locale })` returns a `TablePage`: rows where some `search` column contains `q` (both `toLocaleLowerCase(locale)`) and each filter equals; sorted stably by `sort` and `dir` (default `asc`), ties by `key` ascending, input order without `sort`; then page `page` clamped to 1 to `pages`, `pages` = max(1, ceil(`total` / `pageSize`)). `pageSize`, `locale` and keys are checked (E2853, thrown). It is pure; loaders and browsers run it.

**Sources.** Client: `rows: () => readonly T[]` with `pageSize`: any reactive read; the table applies `applyQuery`. Read once: `id`, `columns`, `styles`, `scroll`, and which of `selected`, `actions`, `labelledBy` are given. Server: `page: TablePage<T>` from a loader whose `search` is the route's `tableSearch` and whose output holds `tablePage(row)`; the table renders it as given. Sort, page and filter changes are links to `href(search)`: they work without JS, back restores a view, and a server source reloads through its loader.

**DataTable.** `{ id, label | labelledBy, columns, search, href: (s) => Href, locale, rows + pageSize | page, scroll?, selected?, onSelect?, text, cells?, header?, actions?, empty? }`. `text`: `headers` (one per shown column), `pager`, `previous`, `next`, `pageOf(page, pages)`, and with selection `selectAll` and `selectRow(row)`, with `actions` `actions`. Slots: `cells[col](row)` (required for `boolean` and `value` columns, by type; default: `text` and `enum` as is, `number` through `formatNumber`), `header(col, sort)`, `actions(row)` (a last column), `empty` (one cell spanning the row when `total` is 0). Parts: `scroll` (with `scroll="x"`: a `Box scroll="x"`, k.ui, holding the `table` alone and named as it is, the same `label` or `labelledBy`; without it no element wraps the `table`), `table` (`table`, `rowCount` `total + 1` when the page holds fewer than `total`), `head`, `body`, `header.<col>` (`columnheader`, `sort` on the sorted column only), `sort.<col>` (a `Link` to the same search with this `sort`, `dir` `desc` when already `asc` on it, else `asc`, and no `page`), `row.<key>` (`row`, `rowIndex` its position in the whole result plus 1), `cell.<key>.<col>`, `select.<key>` and `selectAll` (`checkbox`; `selectAll` is `'mixed'` when some page rows are selected and toggles the page's keys), `pager` (`navigation`), `previous` and `next` (`Link`s, absent at the ends), `status` (`status`, `pageOf`). When a navigation removes the focused pager link, focus moves to `status`. `styles` also takes `column.<col>` for a shown column: its style props go on `header.<col>` and each `cell.<key>.<col>`, after `header` and `cell`, so they win per prop; the place to align a column (`'column.price': { textAlign: 'end' }`).

**TableSearch.** `{ id, label, search, href, delay?: number }`: an `Input` (`<id>.input`) whose value is `q`; `delay` (default 300 ms on `ctx.clock`) after the last input it calls `navigate(href({ ...search, q, page: undefined }), { replace: true })`, `q` absent when empty.

**Rules.** E2851 a `columns` entry naming no field or a field of the wrong kind, or a `styles` key `column.<col>` naming no shown column (thrown by `DataTable`) · E2852 a filter column with a reserved name, or a `.pii()` `search` or `filter` column · E2853 `pageSize` outside 1 to 500, `locale` not a `Locale`, or a key repeated or not id-safe.

**Conformance.**
- `columns` derives each kind from the schema and throws E2851 for a `value` column in `sort` without `compare`, a `number` in `search` and an unknown field.
- For generated rows and searches, `applyQuery` is deterministic, `total` counts the filtered rows, its pages concatenate to the filtered sorted list, and each page has at most `pageSize` rows.
- `tableSearch` parses `{}` and drops a `sort` outside `sort` columns (k.router); E2852 fires for a filter named `page` and a `.pii()` search column.
- A page-2 server table of 12 rows at size 5 has `aria-rowcount="13"` and rows `aria-rowindex` 7 to 11; `header.price` has `aria-sort="ascending"` under `sort=price` and no other header has `aria-sort`.
- `sort.price` links to `dir=desc` when sorted `asc` by price, drops `page`, and after its activation focus stays on it and scroll is unchanged.
- With two of five page rows selected `selectAll` is `mixed`; activating it calls `onSelect` with all five and the keys of other pages.
- After Next on the next-to-last page, focus is on `status`.
- `TableSearch` navigates once, 300 ms after the last of three inputs, with `replace` and no `page`.
- A client table over a store re-sorts when a transaction changes its rows and renders `empty` at `total` 0.
- With `scroll="x"` and `label="Recipes"`, `<id>.scroll` is a `div` with `role="region"`, `tabindex="0"` and `aria-label="Recipes"` whose one child is `<id>.table`, and `<id>.pager` is outside it; with `labelledBy="h"`, both carry `aria-labelledby="h"`; without `scroll`, `<id>.table`'s parent is `<id>`.
- `styles={{ cell: { px: '2', textAlign: 'start' }, 'column.price': { textAlign: 'end' } }}` gives `header.price` and every `cell.<key>.price` the `textAlign` `end` class and not the `start` one, keeps their `px` `2` class, and gives no other column the `end` class; `'column.nope'` is E2851.
