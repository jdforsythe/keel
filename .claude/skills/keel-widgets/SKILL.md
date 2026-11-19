---
name: keel-widgets
description: "Keel widgets and tables: @keel/std-headless Listbox Combobox Menu Tabs Dialog Disclosure Toaster, @keel/std-tables columns tableSearch tablePage applyQuery DataTable TableSearch, navigate from @keel/router; E1822, E2801, E2851-E2853, E1111"
---

# Widgets and tables

Spec: `pnpm spec std.headless`, `std.options`, `std.tables`. Example: `apps/golden-2/modules/recipes/CatalogPage.tsx`.

**Write each widget as a JSX tag**: `<Menu id="m" trigger={() => text} items={() => [{ key: 'a', text }]} onSelect={(k) => go(k)} />`. A call in JSX (`{Menu({...})}`) renders nothing. Part ids are `<id>.<part>` (`m.trigger`, `m.item.a`).
- Tags: Listbox, Combobox, Menu, Tabs, Dialog (`title`, `trigger`, `content={(close) => ...}`, `alert`), Disclosure, Toaster. Option, tab and toast keys: 1 to 64 of `[A-Za-z0-9_-]`, unique (E2801).
- Every word is a prop or a message set value (`data.text.x`).
- Style a part: `styles={{ option: { px: '3', states: { highlighted: { bg: 'text' } } } }}`; `states` also takes `selected`, `checked`, `expanded`.
- From a callback, `navigate(routes.href(id, params, search))` from `@keel/router`.
- E1822: `@keel/ui/aria` (`Part`) is for packages only; app code uses these widgets.

**Tables.** `columns(Row, { key, rowHeader, show, sort, search, filter, compare })` in a shared file (a bad entry is E2851). Route `search: tableSearch(cols)` (E2852: filter named `sort`/`q`, or a `.pii()` search or filter column; a `.pii()` key is E2851; E1111: other `.pii()` in `search`). The loader returns `applyQuery(cols, rows, search, { pageSize, locale })` (E2853) in `tablePage(Row)`, or an api does.
```tsx
<TableSearch id="r.search" label={t.search} search={props.search} href={href} />
<DataTable id="r.table" label={t.table} columns={cols} search={props.search} href={href}
  locale={loc} page={props.data.page} text={{ headers, pager, previous, next, pageOf, selectAll, selectRow, actions }}
  cells={{ price: (row) => <Text id={...}>{fmt(row.price)}</Text> }} />
```
`href = (q) => routes.href(id, params, q)`.

**Test.** `renderRoute(id, { routes, params | url, ctx, artifacts })`, passing `artifacts = { 'a11y.json': <read .keel/a11y.json>, tokens }`. `fire(id, { type: 'keydown', key: 'ArrowDown', shift?, alt?, mod? })`; `find(id).state` has `active`, `selected`, `expanded`, `sort`; `focusOrder()`; `location()`.
