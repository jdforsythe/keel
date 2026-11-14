# Golden app 2: the catalog page (widgets and a server-paged table)

Add a catalog page to `apps/golden-2/` (built by `evals/tasks/golden-2`): every recipe in a sortable, searchable, filtered table paged by the `api` deployable, a recipe finder, a currency filter, a shopping list, toasts and a confirmed clear, in `en-US`, `de-DE` and `ja-JP`. Use only kernel and stdlib APIs from the spec slice; read a full section with `pnpm spec <id>`; the READMEs of `@keel/std-headless` and `@keel/std-tables` (`packages/<name>/README.md`) describe each widget and its parts; skills `keel`, `keel-api`, `keel-text`, `keel-testing` are in `.claude/skills/<name>/SKILL.md`. Edit nothing outside `apps/golden-2/`. If the slice leaves an API you need unspecified, stop and report `blocked: <section> <question>`; invent nothing. The `golden-2` task's acceptance keeps holding.

## Data and the api (`kitchen`)
- `CatalogRow` (`CatalogRow.schema.ts`): the `Recipe` fields plus `currency: Currency` (`@keel/std-money`), the price's currency.
- `catalogColumns` (`catalogColumns.ts`): `columns(CatalogRow, { key: 'id', rowHeader: 'title', show: ['title', 'price', 'minutes', 'addedOn', 'favorite'], sort: ['title', 'price', 'minutes', 'addedOn'], search: ['title'], filter: ['currency', 'favorite'], compare: { price } })`; prices order by amount.
- `CatalogSearch` (`CatalogSearch.schema.ts`) is `tableSearch(catalogColumns)`; `CatalogResult` is `tablePage(CatalogRow)`; `CatalogParams { locale: Locale }` (`@keel/std-i18n`).
- Route `kitchen.catalog`, `api: true`, `/api/catalog/:locale`, `params: CatalogParams`, `search: CatalogSearch`, loader with `stores: boxStores`: `applyQuery(catalogColumns, rows, search, { pageSize: 5, locale })` over the box's recipes, each with its `currency`. Listed in `public.routes` and called from `recipes` through the services client (an endpoint `catalog` with `query: CatalogSearch`).

## The page (`recipes`)
`recipes.catalog`, `/:locale/catalog`, `search: CatalogSearch`, layout `recipes.shell`, title `catalogTitle`. Its loader returns `{ page, recipes, text }`: the api's page, every recipe of the box (for the finder) and the copy. `CatalogPage.tsx` renders, in order, with widgets as JSX tags (`<Combobox ... />`) so they receive the page's `ctx`:
- Heading (level 1) `recipes.catalog.title`.
- `Combobox` `recipes.find` labelled "Find a recipe": options are the box's recipes (key the id, text the title) whose title contains the typed text (`toLocaleLowerCase` with the locale); choosing one calls `navigate(routes.href('recipes.show', ...))` (`@keel/router`).
- `Disclosure` `recipes.catalogFilters` ("Filters") holding a single-mode `Listbox` `recipes.currency` ("Currency"): options `any` ("Any currency") then each `Currency` value (text the code); `selected` is the search's `currency` or `any`; choosing navigates to the same search with that `currency` (none for `any`) and no `page`.
- `Tabs` `recipes.views`: tab `recipes` and tab `list`, in that order.
  - Panel `recipes`: `TableSearch` `recipes.search`; a `Box as="nav"` `recipes.catalog.show` with Links `recipes.catalog.all` and `recipes.catalog.favorites` (`favorite: true`), each keeping `currency` and dropping `page`; `DataTable` `recipes.table` over `page`, `text.headers` keyed by column id, money through `formatMoney`, minutes through `formatDuration(..., 'short')`, dates through `formatDate(..., 'long')`, favorite as Yes/No, multiple selection (`selected`, `onSelect` in a signal), and `actions`: a `Menu` `recipes.menu.<id>` per row whose items are `open` then the two other served locales (text `localeName(tag)`), each navigating to that recipe in that locale; then a Button `recipes.addSelected`, disabled while nothing is selected, which commits the selected recipes (`{ id, title }`) to client store `recipes.list` (each once) and raises a status toast `addedToList` (plural `n`).
  - Panel `list`: the list's titles, or Text `recipes.shopping.empty` when empty, and an alert `Dialog` `recipes.clear` ("Clear the list", description `clearBody`) whose content is Button `recipes.clear.cancel` then Button `recipes.clear.confirm`; confirm empties the list and closes.
- `BoxShell` adds Link `recipes.catalogLink` to the nav and renders a `Toaster` `recipes.toaster` over client store `recipes.toasts` (toast ids `toast<n>`, counting from 1), whose dismiss button removes the toast.
- Every visible word comes from `RecipesText` in all three locales; style each widget by part (`styles`), with a visible `highlighted` state on options and menu items.

## Copy (U+00A0 is written `␣`)
| Element | en-US | de-DE | ja-JP |
| --- | --- | --- | --- |
| title, `recipes.catalog.title`, `recipes.catalogLink` | `Catalog · Keel`, `Catalog`, `Catalog` | `Katalog · Keel`, `Katalog`, `Katalog` | `カタログ · Keel`, `カタログ`, `カタログ` |
| `recipes.find` label | `Find a recipe` | `Rezept finden` | `レシピを探す` |
| header `price` | `Price` | `Preis` | `価格` |
| `recipes.table.status`, page 1 of 3 | `Page 1 of 3` | `Seite 1 von 3` | `1 / 3 ページ` |
| price EUR 1200, date 2026-11-10 | `€12.00`, `November 10, 2026` | `12,00␣€`, `10. November 2026` | `€12.00`, `2026年11月10日` |
| tab `list` | `Shopping list` | `Einkaufsliste` | `買い物リスト` |
| toast, 2 added | `Added 2 recipes to the list` | `2 Rezepte zur Liste hinzugefügt` | `2 件のレシピをリストに追加しました` |
| dismiss | `Dismiss` | `Schließen` | `閉じる` |

## Tests (`@keel/testing` only; ids only)
- `test/catalog.test.ts`: `renderRoute('recipes.catalog', { ..., artifacts: { tokens } })` in each locale over a sim api seeded with twelve recipes over three currencies; one flow per widget by `fire` with `keydown` (the flows below).
- `test/catalogColumns.test.ts`: `applyQuery` over the fixture (sort, search, filters, paging, clamping), a seeded property over generated rows and queries, `CatalogSearch` parse, `properties()` on the client transactions, and a `render` of `CatalogPage` and `BoxShell`.

## Acceptance (checked by `pass.ts`)
1. `pnpm --filter golden-2 check`, `keel check` and `keel test` in `apps/golden-2` clean; no `unsafe`, `any`, casts or suppressions; every golden-2 ledger item at example or better and `pnpm ledger --diff --scope golden-2:` clean; the `golden-2` eval still passes.
2. Every `a11y:recipes.catalog#<criterion>` claim that render rules map to at `example` (the tests pass `artifacts: { tokens }` to `renderRoute`, so render contrast runs), and the ledger holds `@keel/std-headless` `openChart` and `toastChart` at `proven` and `optionsChart` at `exhaustive`.
3. A hidden suite, with the api's clock at 2026-11-10T09:30:00.000Z and the twelve recipes posted a day apart (Apple pie, Borscht, Curry udon, Dal, Empanadas, Focaccia, Gazpacho, Hummus, Irish stew, Jambalaya, Kimchi, Lasagne; EUR, USD, JPY in turn; Apple pie, Dal, Gazpacho and Jambalaya favorites), renders the page in each locale (copy, `document.title`, the shell's `lang`) and runs, with the harness's render checks after every `fire`: the Combobox's ArrowDown, ArrowDown, Enter lands on `recipes.show` (Borscht) with focus on its `h1`, and typing filters it; Listbox focus, ArrowDown, Enter sets `currency=EUR` and the table shows only EUR rows; focusing and activating `recipes.table.sort.price` gives `aria-sort="ascending"` on `recipes.table.header.price` with focus still on the link; Next twice reaches page 3 with rows `aria-rowindex` 12 and 13 and focus on `recipes.table.status`; two selected rows make `recipes.table.selectAll` mixed; the add Button raises `toast1` in `recipes.toaster.status` that its dismiss Button removes; Tabs ArrowRight shows the list panel and `focusOrder()` holds one tab; the alert Dialog opens with focus on `recipes.clear.cancel` and Escape returns focus to `recipes.clear.trigger`; a row Menu opens with ArrowDown and Enter on its second item opens the de-DE recipe.
4. A planted twin (a copy whose DataTable gets `''` as the `title` header text) fails its render with E1703.
5. A browser journey (`browser.ts`, Playwright on Chromium and WebKit from the local cache) against the built `dist/api/server.mjs`: the same flows by keyboard, Tab staying inside the open dialog, no CSP violation or page error, and axe-core `color-contrast` clean in every widget state.
