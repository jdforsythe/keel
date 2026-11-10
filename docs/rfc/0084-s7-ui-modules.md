# RFC 0084: S7 UI modules: widget parts, headless widgets and data tables

Status: draft (2026-11-10). Stage design RFC for S7 (`tasks/PROGRAM.md`, task 0337). Implementation waits for the S6 push and builds on RFC 0079's message sets, RFC 0081's live stores, RFC 0082's std.statecharts and `explore`, and RFC 0083's k.a11y (axe-core render checks, `focusOrder()`, focus after navigation, `.pii()`). It applies WORKFLOW RFC defaults 1 (five kernel gaps get kernel changes, K1 to K5, with the largest in a new kernel section, k.aria), 2 (one way: stdlib widgets are the only path to roles and ARIA states, slot props are the only named slots and the reserved `slots` argument is retired, a table's query has one home, the route's search, and one function, `applyQuery`, for loaders and browsers), 3 (widget state runs on std.statecharts charts and `explore`, tables on k.router search and loaders, checks on RFC 0083's a11y pack, styles on the k.ui compiler, the proof on the `golden-2` eval), 4 (charts hold indexes and counts, never keys, text or typed characters; a personal field cannot be a search column), 5 (both packages are client-safe and read no config; a table's server source is an ordinary loader), 6 (`Part`'s props type is discriminated by role, E1822 keeps it out of app code, focus and dialog behavior live in the kernel element rather than in advice) and 7 (new size budgets; no threshold lowered). Measurements are from commit `4df4719` with RFC 0082's and RFC 0083's spec text applied where they edit the same section; the orchestrator re-measures when it writes the text into `spec/`.

## Problem
S7 must ship `@keel/std-headless` (listbox, combobox, menu, dialog, tabs, disclosure, toast with WAI-ARIA keyboard, focus and ARIA, styled by the app through k.ui tokens) and `@keel/std-tables` (tables over a store, resource or loader with columns from a schema, sort, filter, paging, selection and table semantics). The kernel cannot express either today (evidence from the code at `4df4719`):

1. **No ARIA vocabulary.** No base element takes `role`, an `aria-*` prop, `tabindex`, or a keyboard or focus handler (`packages/ui/src/elements/*.ts`; k.ui's event props are a closed set). A stdlib package cannot write its own elements either: `isAppPath` (`packages/check/src/internal/isAppPath.ts:8-12`) exempts `unsafe/`, `.keel/` and `node_modules/` but not `packages/std-*`, so E1805 (lowercase intrinsic) and E1251 (runtime op import) apply to stdlib source.
2. **No table elements.** `Box as` is `div section nav main header footer aside article ul ol li` (`Box.ts:10`) and `Text as` holds no table tag; the compiler's role map knows `table`, `tr`, `td` and `th` (`packages/compiler/src/a11y/IMPLICIT_ROLES.ts`), but nothing renders them.
3. **No focus or dialog primitive.** The only `.focus(` calls are the router after a navigation (`packages/router/src/internal/afterNavigate.ts:14`), resume restoring the active element (`resumeIsland.ts:34`) and forms focusing the first invalid control (`packages/forms/src/form.ts:103`). Nothing opens a modal. happy-dom 21.0.4, the harness DOM, implements `showModal()` as setting `open` only (`HTMLDialogElement.js:81-83`), with no top layer, no focus move and no `showPopover`.
4. **Parts cannot be styled.** The compiler collects style props from k.ui base elements only (`packages/compiler/src/internal/collectStyles.ts`, `uiBaseElements`), and `StyleUsage.state` is `hover`, `focusVisible`, `active` or `disabled` (`packages/compiler/src/types/StyleUsage.ts`), so an app cannot style a stdlib component's inner elements, nor a selected, checked, expanded or highlighted option.
5. **Named slots are pending.** k.component reserves the `slots` argument "for named slots (later RFC)", while `children` and the standard slots (`loading`, `empty`, `error`) are already props; the router types the argument as `undefined` (`packages/router/src/types/RouteDef.ts:19`).
6. **A chart is a singleton.** std.statecharts compiles one declaration to one store with one id; a page with two listboxes needs two stores of one chart.
7. **No paging, and sort links scroll.** Neither golden app pages: no limit, offset or cursor exists in `apps/`, and golden-2's `RecipeList` is a `ul` of rows. k.router scrolls to the top after every push, so a sort or page link that changes only the search jumps the reader away from the table.
8. **The harness cannot see widget state.** `find(id).state` has `checked`, `disabled`, `expanded`, `selected`, `invalid` and `focused` (`packages/testing/src/internal/stateOf.ts:31-39`): no active descendant, no `aria-sort`, no mixed checkbox.

## Proposal

### 1. The pieces and how they layer

| Piece | Where | Section | Built on |
| --- | --- | --- | --- |
| `Part`: the one element widgets are made of | `@keel/ui/aria` (kernel) | k.aria (new) | k.ui base elements, k.runtime `element` and delegation |
| Part styles and four ARIA style states | `@keel/compiler`, `@keel/ui/css` (kernel) | k.aria | k.ui atomic classes |
| Slot props; the second argument is `undefined` | k.component | k.component | `children`, standard slots |
| Harness state `active`, `sort`, `'mixed'` | `@keel/testing` (kernel) | k.testing | `find`, `a11y()` |
| Search-only push keeps scroll | `@keel/router` (kernel) | k.router | k.head focus (RFC 0083) |
| Chart instances | `@keel/std-statecharts` | std.statecharts | k.store scopes |
| Dialog, Disclosure, Toaster; the three charts | `@keel/std-headless` (new) | std.headless (new) | `Part`, `instance` |
| Listbox, Combobox, Menu, Tabs | `@keel/std-headless` | std.options (new) | `optionsChart` |
| `columns`, `tableSearch`, `tablePage`, `applyQuery`, `DataTable`, `TableSearch` | `@keel/std-tables` (new) | std.tables (new) | `Part`, k.router search and loaders, std.i18n |

**Values belong to the app; interaction belongs to a chart.** Every widget is controlled: it reads its value through a function (`selected`, `text`, `items`) and reports changes through a callback, so the value lives where the app already keeps values: a store, a form field, a signal or the route's search. What only the widget knows (open or closed, which option is highlighted, whether focus should go back to a trigger) is an instance of one of three std.statecharts charts. Each chart is a store, so its transitions are logged, replayed by sessions and explored by `explore`; no widget keeps a second state machine in signals. The one widget signal outside a chart is the typeahead buffer, which holds typed characters and empties after 500 ms.

**Focus has three models, chosen per pattern.** Option lists (Listbox, Combobox, Menu) keep DOM focus on the list or the input and move a highlight with `aria-activedescendant`; Tabs move DOM focus with a roving `tabindex`; Dialog uses the platform's modal `<dialog>`, which makes the rest of the page inert, with `Part` moving focus in and back out. No widget writes a JavaScript focus trap or a portal.

**Tables keep their query in the URL.** Sort, page, `q` and filters are the route's `search`, typed by `tableSearch(columns)`. A header or pager control is a `Link` to the same route with a new search, so a table sorts and pages with no JavaScript, back restores the previous view, and a server source reloads through its loader, the k.router path every route already uses. `applyQuery` is the one implementation of filter, sort and page; a loader calls it on the server, a client table calls it in a computed.

### 2. Kernel changes
One new kernel section, k.aria, holds the largest change; k.ui, k.component, k.a11y, k.testing and k.router change by a pointer, a paragraph or a sentence. No change to the text of k.compiler, k.runtime, k.store, k.reactive, k.forms, k.ctx or k.head.

- **K1, k.aria: `Part`** (`@keel/ui/aria`). One element whose `role` fixes its tag and the ARIA props it accepts, typed as a union discriminated by role (a `columnheader` takes `sort`, an `option` must take `selected`). Behavior props: `tabIndex` 0 or -1, a reactive `focus` that focuses on a rising edge only, `onKey` with a `KeyInput` whose true return prevents the default, `onFocus`, `onBlur`, `onClick`, `onInput`; `activeDescendant` marks and scrolls the highlighted option; `dialog` opens with `showModal()`, focuses its first control and returns focus on close, turning a close request into `onDismiss`. Stdlib only: E1822 refuses `@keel/ui/aria` in app code, as E1207 refuses a detached scope. This is the kernel's because every element is a k.ui base element built through k.runtime's `element` (resume, `data-k`, delegated events), and a stdlib package may not write intrinsics (default 1).
- **K2, k.aria: part styles.** A component from a `@keel/std-*` package takes `styles={{ <part>: { <style props> } }}`; the compiler collects them as it collects a base element's, and `states` there and on `Part` also takes `selected`, `checked`, `expanded` and `highlighted`, compiled to attribute selectors. Without this an app cannot style a widget it did not write (principle 2 forbids a stylesheet that reaches into it).
- **K3, k.component: slot props.** A named slot is a prop whose value is a function returning JSX, typed with the props and kept out of the schema; the second argument of a component is always `undefined`. This ends the reserved second path (default 2) and states what `children`, the standard slots and every widget slot (`option`, `panel`, `cells`) already are.
- **K4, k.testing: harness state.** `state` gains `active` (the id `aria-activedescendant` names) and `sort`, and `checked` can be `'mixed'`, so a test asserts a highlight, a sort and a select-all without a DOM query (E1701).
- **K5, k.router: scroll.** A push to another route scrolls to the top; a push that changes only the search keeps scroll, so sorting and paging leave the reader at the table. The focus sentence ("focus `main`") gives way to a pointer to k.head, where RFC 0083 states focus after navigation; that pays for the scroll text.

Kernel touches by package: `@keel/ui` (`aria/Part.ts`, `aria/KeyInput.ts`, `aria/PartRole.ts`; `css/compileStyles.ts` gains four states), `@keel/compiler` (`collectStyles` reads `styles` on `@keel/std-*` components), `@keel/check` (rule `ariaImport.ts`, E1822), `@keel/testing` (`stateOf`), `@keel/router` (`afterNavigate`), `@keel/runtime-dom` (the `Slots` type becomes `undefined` in `Component` and `Island`).

**Where the tokens come from** (`ceil(length / 4)`, measured on copies of the sections):

| section | before | after | what changes |
| --- | --- | --- | --- |
| k.aria | new | 1,470 | K1, K2 |
| k.ui | 1,421 (RFC 0083) | 1,433 | in: one pointer sentence to k.aria |
| k.component | 788 | 988 | in: the Slot props paragraph, one IDs sentence, two clauses; the reserved-slots sentence becomes "always `undefined`" |
| k.a11y | 1,281 (RFC 0083) | 1,293 | the tabindex sentence names `Part`'s `0` and `-1` |
| k.testing | 1,081 (RFC 0083) | 1,169 | the a11y state list and one clause |
| k.router | 1,499 | 1,499 | the Client scroll sentence and its clause rewritten; "focus `main` (`tabindex="-1"`)" becomes "Focus: k.head" |
| std.statecharts | 1,120 (RFC 0082) | 1,298 | in: the Instances paragraph and one clause |
| std.headless | new | 1,446 | |
| std.options | new | 1,382 | |
| std.tables | new | 1,498 | |

### 3. Package contracts
Every new file has one export named as the file; schemas come first (`*.schema.ts`); effects go through `ctx` (`ctx.clock` for typeahead, toast deadlines and `TableSearch`'s delay). Widget and table components are `.ts` files that call `Part`, base elements, `For` and `If` as functions (k.component), so stdlib source needs no app compiler pass, and every part's id comes from the instance `id` (k.component IDs).

| Package | Files (exports) | Extension points | Codes |
| --- | --- | --- | --- |
| `@keel/ui` (kernel) | `./aria`: `aria/Part.ts`, `aria/KeyInput.ts` (type), `aria/PartRole.ts` (type); `css/compileStyles.ts` takes the four states | widget parts (new, stdlib only) | E1822 (rule in `@keel/check`) |
| `@keel/compiler` (kernel) | internal `collectStyles` (`styles` on `@keel/std-*` components) | none | none |
| `@keel/testing` (kernel) | internal `stateOf` (`active`, `sort`, `'mixed'`); `types/Found.ts` | none | none |
| `@keel/router` (kernel) | internal `afterNavigate` | none | none |
| `@keel/std-statecharts` | `instance.ts`, `ChartInstance.ts` (type) | none | none |
| `@keel/std-headless` (new) | `Listbox.ts`, `Combobox.ts`, `Menu.ts`, `Tabs.ts`, `Dialog.ts`, `Disclosure.ts`, `Toaster.ts`, `optionsChart.ts`, `openChart.ts`, `toastChart.ts`, `Option.ts` (type), `ToastItem.schema.ts`; internal `typeahead.ts`, `partIds.ts`, `checkKeys.ts` | widget parts | E2801 |
| `@keel/std-tables` (new) | `columns.ts`, `Columns.ts` (type), `tableSearch.ts`, `tablePage.ts`, `TablePage.ts` (type), `applyQuery.ts`, `DataTable.ts`, `TableSearch.ts`; internal `kindOf.ts`, `compareBy.ts`, `nextSort.ts` | widget parts | E2851 to E2853 |

**Widget contracts** (props, slots, chart, keys, ARIA, k.ui needs; the spec sections hold the full text):

| Widget | Pattern (APG 1.2) | Value in / out | Chart | Keys | ARIA output | Slots |
| --- | --- | --- | --- | --- | --- | --- |
| Listbox | Listbox | `selected()` / `onChange(keys)`, `mode` single or multiple | `optionsChart` (open while focused) | arrows (by orientation), Home, End, typeahead, Space, Enter (single) | `listbox` with `aria-activedescendant`, `aria-multiselectable`; `option` with `aria-selected` | `option` |
| Combobox | Combobox, list autocomplete, manual selection | `text()` / `onInput`, `onChange(key)` | `optionsChart` | ArrowDown, ArrowUp, Alt+ArrowDown, Enter, Escape | `combobox` input with `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`; `listbox`; `status` when empty | `option`, `empty` |
| Menu | Menu Button | `items()` / `onSelect(key)` | `optionsChart` (`back` returns focus) | trigger: Enter, Space, ArrowDown, ArrowUp; menu: arrows (wrap), Home, End, typeahead, Enter, Space, Escape, Tab | `button` with `aria-haspopup="menu"`, `aria-expanded`; `menu`; `menuitem`, `menuitemcheckbox` with `aria-checked` | `trigger`, `item` |
| Tabs | Tabs, automatic activation | `selected()` / `onChange(key)` | `optionsChart` (open while a tab has focus) | arrows (wrap, by orientation), Home, End | `tablist`; `tab` with `aria-selected`, `aria-controls`, roving `tabindex`; `tabpanel` with `aria-labelledby` | `tab`, `panel` |
| Dialog | Dialog (Modal) | trigger-owned; `content(close)` | `openChart` | Enter, Space on trigger; Escape | native `dialog` (or `alertdialog`) with `aria-labelledby`, `aria-describedby` | `trigger`, `content` |
| Disclosure | Disclosure | trigger-owned | `openChart` | Enter, Space | `button` with `aria-expanded`, `aria-controls`; panel `hidden` | `summary`, `children` |
| Toaster | none; WCAG 4.1.3 | `items()` / `onDismiss(id)` | `toastChart` per item | Tab to dismiss | `status` and `alert` regions present from the first render | none |

Every widget takes `id`, its text as props (`label` or `labelledBy`, option `text`, `title`, `dismiss`; std.messages supplies them, and E2406 refuses a literal `label`), and `styles` for the parts its table names; it needs from k.ui only the style props and tokens the app already has.

**Table contract.** Columns derive from an `s.object` row schema (kind from the node; collation, numeric, declaration-order and boolean comparators; a `compare` for any other value), the query is `tableSearch(columns)` in the route's search, a server source is a loader returning `tablePage(row)` built by `applyQuery`, a client source is `rows()` read from a store, a live store, a signal or a matched resource, and selection is a list of row keys the app holds (`selected()`, `onSelect(keys)`), with a page-level `selectAll` that is `'mixed'` when part of the page is selected.

**Diagnostics** (message under 90 characters):

| code | where | message | fix |
| --- | --- | --- | --- |
| E1822 | `keel check` (k.aria) | `@keel/ui/aria is for stdlib widgets; use @keel/std-headless` | none |
| E2801 | thrown at render (std.headless) | `option key "a b" is not 1-64 of A-Z a-z 0-9 _ -` / `option key "beef" repeats in recipes.find` | none |
| E2851 | thrown by `columns` (std.tables) | `price is a value column; sort needs compare.price` | none |
| E2852 | thrown by `tableSearch` (std.tables) | `filter column page collides with the table query` / `search column name is personal (name); q travels in the URL` | none |
| E2853 | thrown by `applyQuery` (std.tables) | `pageSize 1000 is outside 1 to 500` / `row key r1 repeats` | none |

**Diagnostic blocks.** E1822 sits in k.ui's E18xx block after RFC 0083's E1820 and E1821; the rule lives in `@keel/check`, which emits every E18xx code today. This RFC takes E2800 to E2849 for std.headless and E2850 to E2899 for std.tables; no earlier RFC uses them (the stdlib blocks in use are E200x, E21xx, E230x, E240x, E250x, E255x, E260x, E265x, E270x and E275x; E22xx and E29xx stay fixture codes). Neither package registers a check rule, so neither has a `./tools` export.

### 4. Semantics

**Part.** A `Part` is a base element: it is built through `element` in document order, so an island of them resumes in place, and it is bound (`data-k`) under k.ui's rule plus `focus` and `open`. The role table fixes the tag (`listbox` is a `ul`, `columnheader` a `th scope=col`, `dialog` a native `dialog`) and writes `role` only where it differs from the tag's implicit role, so the compiler's `a11y.json` and axe see native semantics wherever HTML has them. `focus` acts on a false-to-true change after the binding attaches and never at the first render or at resume, which keeps a server-rendered page from moving focus on load (resume already restores the active element). `KeyInput` carries `key`, `shift`, `alt` and `mod`; `fire(id, { type: 'keydown', key })` delivers `false` for the three modifiers, so every keyboard map a test can drive needs no modifier, and Alt+ArrowDown is checked in the browser journey.

**Dialog.** `open` true calls `showModal()`, which in browsers puts the dialog in the top layer and makes the rest of the document inert, so Tab cycles inside it with no script; `Part` then focuses the first focusable descendant itself, because the platform's choice differs between engines and happy-dom makes none. A close request (Escape, the Android back gesture) fires `cancel`, which `Part` prevents and reports as `onDismiss`; the Dialog widget also maps Escape through `onKey` to `close`, so the harness, which cannot raise `cancel`, drives the same path. Focus returns to the element focused when the dialog opened.

**Charts.** `optionsChart` serves four widgets. For a Listbox and Tabs, `open` means "focus is inside"; for a Combobox and a Menu it means the popup shows. Its data is `active` (-1 to 9,999), `count` (0 to 10,000) and `back`, so no key, text or typed character enters a chart, its log, a session or a counterexample (default 4); a widget passes indexes, and the app's callbacks get keys. `openChart` (Dialog, Disclosure) and `toastChart` (one instance per toast) have no data. Each instance is created with `instance(chart, id)` in the widget's scope, so two widgets on a page are two stores, `<chart id>:<widget id>`, and a widget in a `For` row is disposed with its row.

**What `explore` proves.** `openChart` and `toastChart` have finite data and payloads, so `explore`'s closed form runs over their whole space: `proven`. `optionsChart`'s data is larger than the closed form enumerates (a bounded integer is enumerable to 256 values, k.model), so its tests run `explore` from `initial` with counts 0, 1 and 3, `at` and `to` -1, 0, 2 and 5, every move and both `back` values, to depth 6: `exhaustive`, holding the invariant that `active` is -1 or below `count`, and -1 while closed. An instance runs the chart's own transaction function on the chart's own schemas, so the claim about the chart is a claim about every instance; the per-widget flows are `example` tests.

**Tables.** `applyQuery` filters (`q` as a lower-cased substring of any `search` column; each filter column by equality), sorts stably with ties broken by key, then clamps the page and slices it. Because it is pure, its properties (determinism, `total`, pages concatenating to the whole sorted result, page size) are fast-check properties over rows generated from the row schema (`gen`). Row indexes in `aria-rowindex` count from the header row across the whole result, and `aria-rowcount` is set when a page holds fewer rows than `total`, so a screen reader announces "row 7 of 13" on page 2. Only the sorted column carries `aria-sort`, as the APG Sortable Table example does.

**Search-only navigation.** With K5 and RFC 0083's k.head rule, activating a sort link changes the search, re-runs the loader, keeps scroll and keeps focus on the link, whose element persists because the header row is keyed by column. A pager link that the new page no longer renders (Next on the last page) hands focus to the pager's status text, which announces the new page.

### 5. Privacy and auth
- **Charts** hold indexes, counts and one boolean (default 4). The typeahead buffer is a widget signal that empties after 500 ms of `ctx.clock` and is never logged.
- **The URL.** A table's `q` and filters travel in the URL and reach server logs for a server source; `tableSearch` refuses a `search` column whose schema is `.pii()`-marked (E2852), as k.privacy's E1111 refuses marked params and search. Filter columns are enums and booleans, which hold no free text.
- **Selection** is a list of row keys held by the app; it leaves the browser only through the app's own action.
- **Server-only by default** (default 5). Neither package reads config or a secret; a server source is a loader the app writes.
- Nothing here changes a guard, a cookie, the write proof, a CSP rule or a session redaction rule. Toast text arrives from the app and is logged wherever the app keeps it.

### 6. Exit proof and golden-2
S7 exits when a golden app page built from all seven widgets and a server-paged table passes RFC 0083's accessibility pack with no violation in three locales, its keyboard flows pass through the harness and two browser engines, the widget charts hold their `explore` rungs in the ledger, and an agent builds the page from the public docs.

**golden-2 changes** (Open question 2). golden-2 holds the values a table should format (`Money`, `PlainDate`, durations, three locales) and a server store behind its `api` deployable.
- `kitchen` (api, node): the route `kitchen.catalog` with `search: CatalogSearch`, whose loader applies `applyQuery(catalogColumns, rows, search, { pageSize: 5, locale })` to the box's recipes and returns `tablePage(CatalogRow)`; `CatalogRow` is a recipe plus its `currency` enum; the fixture seeds 12 recipes over three currencies.
- `recipes` (client): the route `recipes.catalog` (`/:locale/catalog`, `search: CatalogSearch`, layout `recipes.shell`) and `CatalogPage.tsx`: a Combobox "Find a recipe" (choosing one navigates to `recipes.show`), a Disclosure "Filters" holding a single Listbox of currencies (choosing one sets the `currency` search key), Tabs with a "Recipes" panel holding the `DataTable` (sort by title, price, minutes and date; `TableSearch` on title; `favorite` filter; multiple selection; a Menu per row with Open and the two other locales) and a "Shopping list" panel; an "Add selected to the list" Button that commits to a client store `recipes.list` and raises a toast; an alert Dialog "Clear the list" in the second panel. `BoxShell` renders the `Toaster` and a link to the catalog. About 30 `RecipesText` keys gain en-US, de-DE and ja-JP text.
- Tests: `test/catalog.test.ts` (`renderRoute` per locale; one flow per widget), `test/catalogColumns.test.ts` (`applyQuery` over the fixture, `tableSearch` parse).

**The eval** (new task `evals/tasks/golden-2-catalog`: `TASK.md`, `spec-slice.txt` with std.headless, std.options, std.tables and k.aria's Part styles paragraph, `task.json`, `pass.ts`, hidden `acceptance.test.ts`, `browser.ts`). `pnpm eval --task golden-2-catalog --runner none --strict` on the built app; `--runner claude` for the agent build, which reads the spec slice, the package READMEs and the `keel` skill. `pass.ts` requires:
1. The app's `check` script, `keel check` and its tests green; unsafe count 0; every new export at `example` or better; the ledger not regressed; the existing `golden-2` eval still converges.
2. Accessibility pack: `renderRoute('recipes.catalog')` in en-US, de-DE and ja-JP reports no E1702, E1703, E1804 or E1821 after the first render and after every `fire` of the flows below (the harness runs the render checks after each, k.a11y), and every `a11y:recipes.catalog#<criterion>` item is at `example`.
3. Keyboard flows (hidden test, harness `fire` with `keydown`): Combobox ArrowDown, ArrowDown, Enter lands on `recipes.show` with focus on its `h1`; Listbox focus, ArrowDown, Enter sets `currency` in the URL and the table shows only that currency; activating `sort.price` gives `aria-sort="ascending"` on `header.price` with focus still on the link; Next twice reaches page 3 with rows `aria-rowindex` 12 and 13 and focus on `status`; selecting two rows makes `selectAll` `'mixed'`; the add Button raises a toast in the `status` region that the dismiss Button removes; Tabs ArrowRight shows the list panel and `focusOrder()` holds one tab; the alert Dialog opens with focus on its first button and Escape returns focus to its trigger; a row Menu opens with ArrowDown and Enter on its second item navigates to the de-DE recipe.
4. Browser journey (`browser.ts`, Playwright on Chromium and WebKit from the Playwright cache): the same flows by keyboard only, Tab staying inside the open dialog, and axe-core with `color-contrast` on every widget state; no violation.
5. Charts: the committed ledger holds `@keel/std-headless` `openChart` and `toastChart` at `proven` and `optionsChart` at `exhaustive`.
6. Planted twins: an `optionsChart` whose `items` does not clamp fails its `explore` test with E1708 and the shortest counterexample (`open { count: 3, at: 2 }`, `items { count: 1 }`); a Menu whose Escape sends `close { back: false }` fails flow 3's focus assertion; a page passing `''` as a header text fails its render with E1703 (`empty-table-header`).

## Alternatives
- **ARIA props on the k.ui base elements for app code.** A second way to build every widget, one ARIA misuse at a time (an `aria-selected` on a `div` with no keyboard model); axe catches structure, never a missing key handler. Widgets that own the keyboard model are the one way, and an app that needs a pattern Keel lacks writes it under `unsafe/` with a justification.
- **Lowercase intrinsics in stdlib source** (exempting `packages/std-*` from E1805). No types for roles and states, no `data-k` or resume guarantee beyond what the compiler infers, and every widget would re-implement focus and `showModal()`.
- **One kernel element per widget** (`k.ui` `Listbox`, `Dialog`, ...). Seven kernel contracts frozen at once, where one element with a role table is a single contract the stdlib composes.
- **Radix UI, React Aria, Downshift.** React libraries: they render through React, hold state in hooks and share it through context providers (principle 2 forbids providers). Their keyboard maps follow the APG, which Keel cites directly.
- **Zag.js** (framework-agnostic widget machines). Its machines run on their own runtime, so widget state would be a second state model beside stores, unlogged and outside `explore`: the argument RFC 0082 made against XState.
- **Widget state in signals.** Unlogged, unreplayable and invisible to `explore`; std.statecharts exists so that such state is a store (default 2).
- **Charts that hold keys and text.** Simpler handlers, but keys and option text would enter the log and sessions, and a person's typed query with them (default 4).
- **Portals or the popover API for popups and toasts.** A portal moves content away from the component that owns it (principle 2), and happy-dom 21.0.4 has no `showPopover`. Popups and toasts render in flow; the modal dialog uses the top layer the platform gives `showModal()`.
- **A JavaScript focus trap for dialogs.** `showModal()` makes the page inert in every engine Keel supports; a trap duplicates it and fights the platform's own close requests.
- **TanStack Table** (`@tanstack/table-core`). Its column definitions are code (`accessorKey`, cell functions) rather than a schema, and its state (`sorting`, `pagination`, `rowSelection` with `onStateChange`) is a second model beside the route's search and the app's stores; server paging is `manualPagination` plus a row count. Keel borrows its semantics (stable sort, ascending first, a row id function, a row count for server data) and builds `applyQuery`, one pure function.
- **An ARIA grid for tables.** The grid pattern takes every cell into the keyboard model and suits spreadsheets; the APG Sortable Table keeps links and checkboxes in Tab order, which a data table of records needs.
- **Table state in a chart or a signal.** Loses the URL: no shareable view, no back button, no server paging through loaders without a second request path.
- **Keeping the `slots` argument for named slots.** Two ways to pass the same function; every slot in Keel is already a prop.
- **A k.router option for scroll per link.** A per-call choice where one rule (search-only pushes keep scroll) covers tables, filters and tabs in the URL.

## Spec diff
Token counts are `ceil(length / 4)`, the `tooling/budgets.mjs` rule, measured on copies of the sections at `4df4719` with RFC 0082's and RFC 0083's text applied (k.ui, k.a11y and k.testing as RFC 0083 leaves them; std.statecharts as RFC 0082 writes it). One existing conformance clause changes text (k.router); every other edit adds clauses.

### spec/kernel/k.aria.md (new, 1,470)
~~~md
# k.aria: Widget parts
status: proposed

**Part.** `@keel/ui/aria` exports `Part`, the one element stdlib widgets are built from. It is a base element in every k.ui sense: built through the runtime's `element` in document order, so it resumes in place; it takes `id` (required), `role`, `lang`, `hidden`, the style props and a `children` thunk; it is bound (`data-k`) when it has an event prop, a `focus` or `open`, or a signal or computed. Only kernel and stdlib code imports `@keel/ui/aria`: an app file outside `packages/` and `unsafe/` that does is E1822.

**Roles.** `role` fixes the tag and the ARIA props `Part` accepts (its props type is a union discriminated by `role`; a prop another role takes is a type error). The `role` attribute is written only where it differs from the tag's implicit role.

| role | tag | props (required first) |
| --- | --- | --- |
| `listbox`, `menu` | `ul` | `label`; `activeDescendant`, `orientation`, `multiselectable` (listbox) |
| `option` | `li` | `selected`; `disabled` |
| `menuitem`, `menuitemcheckbox` | `li` | `checked` (menuitemcheckbox); `disabled` |
| `combobox` | `input type=text` | `label`, `expanded`, `controls`; `activeDescendant`, `value`; writes `aria-autocomplete="list"` |
| `button` | `button type=button` | `controls`; `hasPopup` (`menu`, `listbox`, `dialog`), `expanded`, `disabled` |
| `checkbox` | `input type=checkbox` | `label`, `checked` (`true`, `false`, `'mixed'`) |
| `tablist` | `div` | `label`; `orientation` |
| `tab` | `button type=button` | `selected`, `controls` |
| `tabpanel` | `div` | `labelledBy` |
| `dialog`, `alertdialog` | `dialog` | `labelledBy`, `open`; `describedBy` (required for alertdialog) |
| `status`, `alert`, `generic` | `div` | none |
| `navigation`, `group` | `nav`, `div` | `label` |
| `table` | `table` | `label`; `rowCount` |
| `rowgroup` | `tbody`, `thead` with `head` | none |
| `row` | `tr` | `rowIndex` |
| `columnheader`, `rowheader`, `cell` | `th scope=col`, `th scope=row`, `td` | `sort` (`ascending`, `descending`; columnheader), `colSpan` (cell) |

`label` is a string written as `aria-label`; wherever a role takes `label` it takes `labelledBy` instead, exactly one. `labelledBy`, `describedBy`, `controls` and `activeDescendant` are element ids (`aria-labelledby`, ...). A boolean writes `"true"` or `"false"`; `disabled` writes the attribute on `button` and `input` and `aria-disabled` elsewhere. Each prop takes a value, a signal or a computed (bound as k.ui binds `value`).

**Behavior.**
- `tabIndex` is `0` or `-1`, never positive (type).
- `focus: boolean`, reactive: when it turns from false to true the element is focused. A first render or a resume never moves focus.
- `onKey(key: KeyInput) => boolean` runs on `keydown` through the delegated table (k.runtime). `KeyInput` is `{ key, shift, alt, mod }`: `key` the DOM `key`, `mod` Ctrl or Meta. Returning true prevents the default.
- `onClick`, `onFocus` and `onBlur` (bound directly, k.runtime), and `onInput(value: string)` on `combobox`.
- On `option`, `menuitem` and `menuitemcheckbox`, `mousedown` is prevented, so a click leaves focus where it was.
- When `activeDescendant` changes, the element it names gets `data-k-highlighted` (the previous one loses it) and is scrolled into view (`block: 'nearest'`).
- `dialog`, `alertdialog`: `open` true calls `showModal()` after the commit and focuses the first descendant that is a `button`, `input`, `select`, `textarea`, `a[href]` or `tabindex="0"`, else the dialog (`tabindex="-1"`). `open` false calls `close()` and returns focus to the element focused when it opened, if still connected. A close request (`cancel`) is prevented and calls `onDismiss`; a platform `close` while `open` is true calls it too.

**Part styles.** A component from a `@keel/std-*` package takes `styles={{ <part>: { <style props> } }}`; the compiler collects each part's style props as it collects a base element's (k.ui), and the component passes them to the `Part` or base element of that part. There and on `Part`, `states` also takes `selected` (`[aria-selected="true"]`), `checked` (`[aria-checked="true"]`, `:checked`), `expanded` (`[aria-expanded="true"]`) and `highlighted` (`[data-k-highlighted]`).

**Rules.** E1822 `@keel/ui/aria` imported by app code (no fix: use a `@keel/std-headless` widget, or a file under `unsafe/` with a justification).

**Conformance.**
- `option` renders `<li role="option" aria-selected="false">`; `tab` a `<button type="button" role="tab">`; `columnheader` a `<th scope="col">` and `dialog` a `<dialog>`, neither with a `role` attribute.
- `label` writes `aria-label` and `labelledBy` `aria-labelledby`; a signal bound to `expanded` changes only that attribute.
- `focus` turning true focuses the element; `focus` true at the first render, and at resume, leaves focus where it was.
- `fire(id, { type: 'keydown', key: 'ArrowDown' })` calls `onKey` with `{ key: 'ArrowDown', shift: false, alt: false, mod: false }`; a true return cancels the event, a false one does not.
- A `mousedown` on an `option` is default-prevented.
- Setting `activeDescendant` to an option's id gives that option `data-k-highlighted` and removes it from the one before.
- A `dialog` given `open` true has the `open` attribute and focus on its first `button`; a `cancel` event calls `onDismiss` and leaves it open; `open` false closes it and focuses the element focused before.
- `styles={{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}` on a stdlib component puts the `2` rule and an `accent` rule under `[data-k-highlighted]` into the CSS file, once each.
- Each role rendered with its required props, inside its required parent and children (a `listbox` with one `option`, a `table` with one `row` of one `cell`), has no axe violations.
- E1822 fires on an app file importing `@keel/ui/aria` and not on one under `packages/` or `unsafe/`.
~~~

### k.ui (1,421 after RFC 0083, to 1,433)
- Base elements: after "Required a11y props, `autocomplete` and contrast: k.a11y." insert "Stdlib widget parts and their `styles`: k.aria."
- Rules and Conformance unchanged.

Full text after the change:
~~~md
# k.ui: Tokens and styling
status: conformance-covered

**Tokens.** `tokens.ts` at the project root, validated by `TokenSchema` from `@keel/ui`:
```ts
export const tokens = defineTokens({
  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },
  space: { 1: '4px', 2: '8px', 3: '16px' },
  fontSize: { sm: '14px', md: '16px', lg: '24px' },
  breakpoint: { md: '768px' }, motion: { fast: '120ms' },
})
```
Groups are closed: `color`, `space`, `size`, `radius`, `font`, `fontSize`, `weight`, `shadow`, `border` (shorthands such as `1px solid var(--k-color-divider)`), `breakpoint`, `motion`. A color is a value or `{ light, dark }`, chosen by `prefers-color-scheme`. Motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `TextArea`, `Select`, `Checkbox`. Required a11y props, `autocomplete` and contrast: k.a11y. Stdlib widget parts and their `styles`: k.aria. `Image src` is an asset URL string, not an `Href`. Every base element takes `lang`, a string written as its `lang` attribute. `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). Event props are a closed set: `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs. A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input), so server HTML shows it. Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written. A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime). An eager `Node` child is made first, so its island re-renders (E1253; check E1808).

**Style props** are the only styling: no `class` prop, no `styles()`. Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap`. Types accept any string shaped like a token name (`TokenName`: an identifier or short numeric key, so `16px` and `#fff` are type errors); whether the token exists is E1801. Responsive values are keyed by breakpoint. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object, so `disabled` stays the boolean attribute.
```tsx
<Box as="section" p={{ base: '2', md: '3' }} bg="bg" states={{ hover: { bg: 'accent' } }}>
  <Heading level={2}>Orders</Heading>
</Box>
```
The compiler emits one atomic class per (prop, token, breakpoint, state), deduplicated across the app, into one CSS file. Dynamic values switch classes; no inline style is generated.

**Standard slots.** JSX children are the default slot and arrive as `props.children` (k.component); base elements accept a thunk or a plain string/Node. `loading: () => JSX`, `empty: () => JSX`, `error: (e: KeelError) => JSX`. These names carry these signatures everywhere; `For` accepts `empty`.

**Rules.** E1801 raw value where a token is required (fix: nearest token) · E1803 `style` attribute · E1805 lowercase intrinsic element in app code (fix: matching base element) · E1806 standard slot name with another signature · E1807 `tokens.ts` fails `TokenSchema` · E1808 base element `children` made eagerly (an element call or JSX, or an array or `const` of them) (fix: `() =>`). E1802 and E1804: k.a11y.

**Conformance.**
- Two elements with identical style props get identical class lists, and the CSS file contains each atomic rule once.
- `p={{ base: '2', md: '3' }}` yields the `2` rule unconditioned and the `3` rule inside `@media (min-width: 768px)`.
- Under `prefers-reduced-motion: reduce` every motion token resolves to `0ms`.
- Every base element rendered with only its required props has no axe violations.
- A signal bound to a style prop changes only the element's class list; no element ever has a `style` attribute.
- `fg="fg" bg="bg"` with the tokens above passes E1804 in both schemes; a pair at 3:1 fails it.
- `Image src` accepts a string such as `'logo.png'` (no `Href` required); a `javascript:` value renders as `about:blank`.
- `fire(id, 'click')` on a Button with `onClick` calls the handler once; `fire(id, 'change')` on a Checkbox with `onChange` passes the new checked state.
- An `Input`, `TextArea`, `Select` or `Checkbox` given a signal for `value` or `checked` shows its first value in the markup; a later signal write changes only the property.
- `@keel/ui` exports no `styles`; no base element takes `class`; `Button` has no `label`, its children are its text.
- An `Input` bound to a signal and edited in server HTML before resume keeps the edit after resume, its server node and its markup default.
- A route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry, and resume adopts its server nodes without E1253 when children are thunks; a route of base elements with no event prop, `field` or signal has no `data-k`.
- A base element given `lang="ja-JP"` has `lang="ja-JP"` in server and client output; without it, none.
~~~

### k.component (788 to 988)
- Shape: "the `slots` argument is reserved for named slots (later RFC)." becomes "the second argument is always `undefined`."; the **Slot props** paragraph follows Shape.
- IDs: "A stdlib widget gives each element it renders the id `<id>.<part>` from its own `id` prop; its section names the parts." appended.
- Conformance: two clauses added after the `props.children` clause, so later clauses renumber by two; no clause text changes.

Full text after the change:
~~~md
# k.component: Components
status: conformance-covered

**Shape.** One default export per file; filename equals name. `export const Props = s.object(...)`. Signature `(props: Props, slots?: { name: Slot }, ctx?: Ctx) => JSX`: `ctx` (k.ctx) is passed by the runtime from the mount or island root and by the harness from `render`; it is the only way a component reaches an effect (resource fetchers close over it). A component file (a PascalCase `.tsx` with a default export, or a PascalCase `.ts` whose default export is a function whose first parameter's type names `Props`; rfc:0068) may also export `Props` and `uses`; any other file declaring `Props` is E1104 (`export const uses = [addItem]`, k.store); the compiler calls `uses(...)` in the component's scope. Props are getters: destructuring is E1401 (compiler rewrites simple cases and emits the fix). JSX children are the default slot, delivered as `props.children: () => Node | Node[] | string` (a thunk, rendered inside the child's scope); the second argument is always `undefined`.

**Slot props.** A named slot is a prop whose value is a function returning JSX, typed with the component's props and kept out of its `Props` schema: `option?: (o: Option<K>, s: OptionState) => JSX`. The receiving component calls it in its own scope, once per place it renders (inside a `For`, in that row's scope, disposed with the row); its arguments are values and accessors, never DOM nodes. `children` and the standard slots (k.ui) are slot props with fixed names.

**Control flow.** `<If when={} fallback={() => …}>`, `<For each={} key="id">`, `<Match on={union}>` with one `<Case tag="">` per variant (missing variant is E1402). A file without JSX calls them as functions with the same props (`If({ when, children: () => node })`); the compiler removes a `@keel/runtime-dom` import only when every binding it imports is used solely as a JSX tag. Elements in a JSX child expression are E1403 and bind nothing: `{a && <b/>}`, `{a ? <b/> : c}` (also `||`, `??`), an array or `map()` of elements, a function, or a same-file call or binding returning them, names resolved by scope (rfc:0061). At runtime `text` renders nothing for a node or an array holding one. In a file importing `If`, the fix rewrites `&&` and `?:` to it.

**IDs.** Every element gets a stable id: explicit `id="cart.submit"` or derived `<file>.<index>`, where `<file>` is the project-root-relative path without extension with `/` as `.` (`src.orders.OrderList.0`) and `<index>` counts the file's elements in source order; duplicates are E1404. A stdlib widget gives each element it renders the id `<id>.<part>` from its own `id` prop; its section names the parts.

**Conformance.**
- Render is pure for equal props and state.
- A11y tree snapshot stable across re-renders.
- Every element addressable by id in the harness.
- A component's JSX children arrive as `props.children` and render inside the child's scope.
- A slot prop a component calls inside a `For` renders in that row's scope: removing the row disposes what the call rendered.
- The runtime, the router and the harness call a component with `undefined` as its second argument.
- A base element given JSX text children renders that text.
- `{a ? <b/> : <i/>}`, `{a && <b/>}`, `{[<b/>]}` and `{xs.map((x) => <li/>)}` as children are each one E1403 and render nothing; `<If when={a} fallback={() => <i/>}>` renders `<i>` while `a` is falsy.
- A plain `.ts` component file exporting `Props` and `uses` beside its default export reports neither E1752 nor E1104.
- A PascalCase `.ts` file whose default export is not a function taking `Props` and that exports a `Props` schema reports E1104.
- A plain `.ts` module calling `If` and `Boundary` imported from `@keel/runtime-dom`, or naming `If` only as a parameter or destructuring default, compiles with that import kept and renders the chosen branch; a `.tsx` module using them only as tags compiles with the import removed.
~~~

### k.a11y (1,281 in RFC 0083, to 1,293)
- Order and focus: "No base element takes `tabindex`, and the style vocabulary" becomes "No base element takes `tabindex` but `Part` (k.aria), which takes only `0` or `-1`, and the style vocabulary".
- Rules and Conformance unchanged.

Full text after the change:
~~~md
# k.a11y: Accessibility
status: proposed

**Target.** WCAG 2.2 Level A and AA. Each criterion is checked statically (`keel check`), at render (`keel test`), or by a person; the ledger and the evidence bundle (k.evidence) say which.

**Required props.** In the `@keel/ui` types (E1802): `Heading level`; `Image alt` or `decorative`; `label` on `Input`, `TextArea`, `Select`, `Checkbox`; `Link to: Href` with text; `Button` children (text, or an `Image` whose `alt` names it; no `label`). `Input`, `TextArea` and `Select` take `autocomplete: Autofill`, written as the attribute: an HTML autofill field name from the WCAG 2.2 input purposes (`name`, `email`, `tel`, `street-address`, `bday`, ...) or `off`.

**Contrast.** Text needs 4.5:1 against its background, 3:1 when large (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700), per color scheme and breakpoint; text inside `states.disabled` is exempt, and text without a `fontSize` token is normal size. Statically (E1804), the background is the element's `bg`, else its nearest ancestor's `bg` in the same component; with neither, the element is checked at render. At render, colors and sizes come from each element's atomic classes and their tokens (no layout): the background is the nearest painted ancestor's `bg`, else `#FFFFFF`. `contrastTable(tokens)` (`@keel/ui`) lists every ordered pair of color tokens per scheme with its ratio.

**Order and focus.** No base element takes `tabindex` but `Part` (k.aria), which takes only `0` or `-1`, and the style vocabulary has no `order`, `position`, `z-index` or `outline`, so sequential focus order is document order and the platform's focus indicator stays. `direction` `row-reverse` or `column-reverse` on an element with two or more focusable base elements under it in its component is E1820. Harness handles have `focusOrder()`: the ids of focusable elements in sequential order, skipping disabled and hidden ones. Focus after a client navigation: k.head.

**Render checks** (`@keel/testing`). After the first render, after every `fire` and on `settle()`, the harness compares each element's role and name source with the compiler's `a11y.json` (E1702; passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, not checked), then runs axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` over the rendered root (E1703). A `render` of a component runs element rules only; a `renderRoute` page also runs the document rules (`document-title`, `html-has-lang`, `landmark-one-main`, `region`, `bypass`). axe-core's `color-contrast` is replaced by the render contrast check (E1804), and a control with `data-k-pii` (k.privacy) and no `autocomplete` is E1821. An axe result of `incomplete` counts as not run.

**Claims.** `keel test` writes every render check to `reports/a11y.json` (`A11yRun[]`: route or component, rules run, violations). For each route in `routes.json` and each criterion a rule maps to, `keel ledger` emits `{ kind: 'ledger', item: 'a11y:<routeId>#<criterion>', rung, evidence }`: `example` when a passing `renderRoute` test rendered the route, every rule mapped to the criterion ran, none was violated and `keel check` reports none of its static codes; else `none`. The map is axe-core's `wcag` rule tags plus: E1702 4.1.2 · E1802 1.1.1, 1.3.1, 2.4.4, 4.1.2 · E1804 1.4.3 · E1820 1.3.2, 2.4.3 · E1821 1.3.5. Criteria no rule maps to are for a person; the evidence bundle lists them.

**Rules.** E1802 missing a11y-required prop · E1804 text below its contrast threshold (static and render) · E1820 reversed `direction` over focusable elements (fix: reverse the children, plain direction) · E1821 a control bound to a `.pii()` field without `autocomplete` (render).

**Conformance.**
- A `Text` whose `fg` is 4.4:1 against the `bg` of its nearest ancestor in the same component is E1804; at `fontSize` 18.66px and `weight` 700, or under `states.disabled`, it is not.
- A `renderRoute` page whose text is 4.4:1 against a `bg` set in another component fails with E1804 naming the text's element id; at 4.6:1 it passes.
- A `render` of a component reports no document rule; a `renderRoute` of a titled route reports no `document-title` or `html-has-lang` violation.
- An unlabeled `input` made with the runtime's `element` fails its render with E1703 naming rule `label` and the element id.
- A `Box` with `direction="row-reverse"` over two `Button`s is E1820 and its fix leaves `direction="row"` with the children reversed; over one `Button` it is clean.
- An `Input` bound to a `.pii('contact')` field without `autocomplete` fails its render with E1821; with `autocomplete="email"` or `"off"` it passes and the attribute is in the markup.
- `focusOrder()` lists focusable element ids in document order without disabled or hidden ones.
- After `keel test` with one passing `renderRoute` test of route `r`, `keel ledger` gives `a11y:r#1.4.3` rung `example` and `a11y:r2#1.4.3` rung `none` for an untested route `r2`; a violation of a rule mapped to 1.4.3 on `r` makes it `none`.
- `contrastTable(tokens)` has one entry per ordered pair of distinct color tokens per scheme, each ratio WCAG's to two decimals.
~~~

### k.testing (1,081 after RFC 0083, to 1,169)
- a11y: the state list gains `active?` and `sort?`, followed by "`checked` is `'mixed'` for a mixed checkbox, `active` is the id `aria-activedescendant` names, `sort` is the `aria-sort` value."
- Conformance: one clause added before the resource clause.

Full text after the change:
~~~md
# k.testing: Harness and properties
status: conformance-covered

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
expect(t.state(cart).items).toHaveLength(1)
expect(t.find('cart.total').name).toBe('Total 3')
t.dispose()
const r = await renderRoute('orders.show', { routes, params: { id }, search: {}, ctx: sim })
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`). It resolves once effects, resources, and actions are quiescent.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; `renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused?, active?, sort? }, children }`, with implicit roles and accessible names per WAI-ARIA: `checked` is `'mixed'` for a mixed checkbox, `active` is the id `aria-activedescendant` names, `sort` is the `aria-sort` value. After the first render and after every `fire`, the harness runs the render checks of k.a11y.

**Properties.**
```ts
properties(CartView)   // generated props and state
properties(addItem)    // generated state and payload
```
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.
```
E1704 cart/addItem.test.ts:3:1 invariant cart.nonNegative failed (seed 4021, run 37, shrunk)
  payload: {"item":{"id":"i1","qty":-1}}
```

**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate` and schedules: k.sim.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- `find(id).state` has `active: 'c.option.b'` for a combobox whose `aria-activedescendant` is `c.option.b`, `sort: 'ascending'` for a header with that `aria-sort`, and `checked: 'mixed'` for a mixed checkbox.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- `navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
~~~

### k.router (1,499 to 1,499)
- Client: "After a push: scroll to the top (or the hash target) and focus `main` (`tabindex="-1"`). Back or forward restores each history entry's scroll. Revalidation changes neither scroll nor focus." becomes "Scroll: a push to another route goes to the top (or the hash target); back or forward restores each entry's; a search-only push and revalidation keep it. Focus: k.head."
- Conformance: "After a push, `document.activeElement` is `main` and scroll is 0; back and forward restore each entry's position, also for two entries with one URL." becomes "After a push to another route scroll is 0, after a search-only push it is unchanged; back and forward restore each entry's position, also for two entries with one URL." The focus half is RFC 0083's k.head clause.

Full text after the change:
~~~md
# k.router: Routes
status: conformance-covered

**Manifest.** One per module, in `routes.ts`; a deployable's route table is their union.
```ts
export const routes = manifest({
  'orders.show': {
    path: '/orders/:id',
    params: OrderParams,
    loader: loadOrder,
    component: OrderPage, guard: auth,
  },
})
routes.actions({ 'orders.show': { POST: updateOrder } })
```
`routes.actions` attaches path routes' actions once each. An entry without `path` is a layout: its `component` renders a `children` slot. A route's chain is the route plus its layouts, outermost first. `component` receives `{ params, search, data }`, where `data` is its loader's `ok` value; `errorElement` receives `{ error: KeelError }`. A path route's `title` names its document (k.head).

**Matching.** Segment by segment; static beats `:param`; no wildcards; k.prefix elides a leading param. A trailing slash redirects (308) to the canonical path. Params that fail their schema: 404 with `keel.notFound`; no guard or loader runs. It renders in the chain's nearest `errorElement`, inside the layouts above it unless one declares a loader or guard (then alone). Failing search keys are dropped; the rest parse.

**Links.** `routes.href(id, params?, search?)` returns a branded `Href`: `id` is a path route of that manifest; `params` (required iff declared) and `search` are typed by its schemas. Params are encoded by schema then URL-encoded; search keys are sorted and absent optionals omitted. `Link to`, `navigate`, and `Form action` take `Href` only; other URL attributes follow the k.compiler URL policy. `routes.href`, a router, and guard redirects resolve ids only in their own manifest.

**Guards.**
```ts
export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))
```
`caller` is k.server's `caller` (`''` if none or client-only). A guard returns `Result<null, KeelError<'keel.denied'>>`. Every guard in the chain runs, outermost first, before any loader; on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }` (`url`'s own `next` if `url` is a `redirect` route; never nested).

**Execution.** Guards, loaders, and actions run on the server, or in the browser in a client-only app. API: `@keel/router`; `@keel/router/match`: `matchHref(routes, href)` matches as navigation does: `{ id, params, search }` or `null`; `@keel/router/internal` is not public.

**Client.** `navigate(href, { replace? })` pushes or replaces a history entry. `route()` is a computed of the match `{ id, params, search, pending }`, discriminated by `id`; `pending` is true while a navigation or action is in flight; the previous page stays rendered until the new chain's loaders finish. Scroll: a push to another route goes to the top (or the hash target); back or forward restores each entry's; a search-only push and revalidation keep it. Focus: k.head. Same-origin link clicks inside the router navigate client-side.

**Form.** `<Form method action form? error?>`; `action` is an `Href`. Without JS it posts natively (`PUT`/`PATCH`/`DELETE` via a hidden `_method`). Inside a router it submits FormData to the matched route's action and applies its `Result`: `ok(href)` navigates; `ok(null)` re-runs every loader in the current chain once.

**Artifacts.** In `routes.json` (k.compiler), `actions` lists methods; `guard` is the guard's `redirect`; layouts have `path: null`.

**Rules.** E1501 string path where an `Href` is required · E1502 two routes with the same path pattern · E1503 `:name` in `path` without a `params` field, or the reverse · E1504 required field in a `search` schema · E1505 `actions` in an entry, or a `routes.actions` key or `<Form method>` not `POST`/`PUT`/`PATCH`/`DELETE` or not on the target route · E1506 unknown `layout` name, a layout with a `path`, or a layout cycle · E1507 loader or action `params`/`search` typed by hand, or declared with another schema than the route's (that throws) · E1508 a guard's literal `redirect` route is under that guard, or (runtime) a guard redirect loop or a missing `redirect` param.

**Conformance.**
- For every route and generated `p`, `q`, `navigate(routes.href(id, p, q))` makes `route()` equal `{ id, params: p, search: q, pending: false }`.
- `routes.href` output is identical for equal inputs and omits absent optional search keys; a layout id or a missing or mistyped param does not compile.
- A path whose params fail the schema yields 404 and calls no loader.
- `?tab=bogus&x=1` on `orders.show` yields `search` `{}`.
- A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs.
- A loader `err` renders the nearest `errorElement` in the chain; layouts above it stay.
- After an `ok(null)` action, each loader in the current chain runs exactly once more; after `ok(href)`, `route().id` is the target's id.
- After a push to another route scroll is 0, after a search-only push it is unchanged; back and forward restore each entry's position, also for two entries with one URL.
- E1501-E1506 each have a triggering fixture and a clean one.
- Outside any router a `Form` renders `action` unchanged and lets submit through; inside one, an `action` route lacking `method` throws E1505.
- A loader declared with `params: P` gives `fn` `params` of type `Infer<typeof P>`; `manifest` throws E1507 for another schema value.
- A guard redirect revisiting a location, or a ninth, is E1508 (server: 500 `keel.unexpected`); no redirect nests `next`.
- An action returning `ok(routes.href(id))` compiles unannotated and navigates to `id`; an entry with `actions` throws E1505.
- A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`).
- `matchHref(routes, routes.href(id, p, q))` is `{ id, params: p, search: q }`; an unmatched href, or one whose params fail, is `null`.
~~~

### std.statecharts (1,120 in RFC 0082, to 1,298)
- An **Instances** paragraph after Compiles to; one clause appended.

Full text after the change:
~~~md
# std.statecharts: State charts
status: proposed

**Extension points.** Check rule registry: E2751-E2755 through `@keel/std-statecharts/tools`. A chart compiles to a k.store store and one transaction per event, so it needs no capability and no kernel change.

**Declare.** In a client-safe file whose name is the export:
```ts
export const editorChart = chart('todos.editor', {
  data: EditorData, start: { attempts: 0 },
  events: { edit: s.object({}), save: s.object({}), saved: s.object({}), refused: s.object({}), failed: s.object({}), mine: s.object({}), theirs: s.object({}), cancel: s.object({}) },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: d.attempts + 1 }), reset: () => ({ attempts: 0 }) },
  initial: 'viewing',
  states: {
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { saved: { to: 'viewing', do: 'reset' }, refused: 'conflict', failed: [{ to: 'saving', guard: 'canRetry', do: 'count' }, { to: 'gaveUp' }] } },
    conflict: { on: { mine: { to: 'saving', guard: 'canRetry', do: 'count' }, theirs: { to: 'viewing', do: 'reset' } } },
    gaveUp: { final: true },
  },
})
```
`chart(id, { data, start, events, guards?, actions?, initial, states })`: `id` is the store id, prefixed by the declaring module (E1155). `data` is the schema of the chart's own values and `start` their first value; `events` maps each event to its payload schema. A state is `{ on?, final? }`; `on` maps an event to a target: a state name, `{ to?, guard?, do? }` (`to` absent: stay), or a list of those, tried in order. `guards` are pure predicates `(data, payload) => boolean` and `actions` pure updates `(data, payload) => data`, named by `guard` and `do`.

**Compiles to.** The store `id`, state schema `s.object({ state: s.enum(<state names>), data }, { closed: true })`, initial `{ state: initial, data: start }`; and per event the transaction `<id>.<event>` with that event's payload schema. Its function takes the first target of the current state's `on[event]` whose `guard` holds for `(data, payload)`, applies `do` to `data` and moves to `to`; with no such target the state is unchanged. The chart exposes `store`, `events` (each event's `Transaction`), `states`, `initial`, and `enabled(state, event, payload)`, true when a target applies. Writes go through `tx(editorChart.events.save, {})`, under `uses` (k.store) as any transaction.

**Instances.** `instance(chart, key)` compiles the same declaration again in the calling scope: the store `<id>:<key>` with the same schema and initial, and per event the transaction `<id>:<key>.<event>` with the same function; it returns `{ store, events, enabled }` and is disposed with the scope. `key` is 1 to 64 characters of `[A-Za-z0-9._-]`, else it throws; a live duplicate throws (k.store). `explore` over the chart covers every instance: each runs the chart's function on the chart's schemas.

**Checked.** `keel check` analyzes the declaration as written; `chart` repeats E2751, E2753 and E2754 as throws. Reachability treats every guard as possibly true, so a state E2752 names is unreachable on every run. Guarded reachability and stuck states are k.model's: `coverage(chart, explore(Object.values(chart.events)))` returns `{ unreached, dead }`, the declared states no explored state holds and the non-final states some `terminal` state holds.

**Rules.** E2751 `initial` or a `to` naming no state (fix: the nearest state name) · E2752 a state unreachable from `initial` through `on` targets · E2753 a non-final state with no target to another state (fix: add `final: true`) · E2754 a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry · E2755 a `chart` whose `initial`, `states`, `on` keys or targets are not literals (the checker cannot prove it).

**Conformance.**
- The compiled store's schema parses `{ state: initial, data: start }` and refuses a state name outside `states`; each event's transaction is named `<id>.<event>` and its `schema` is that event's payload schema.
- `tx` of an event moves to the first target whose guard holds and applies its `do`; with no applicable target the state and `data` are unchanged.
- `enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`.
- Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`, and `coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`.
- A state whose every exit is guarded false from some reachable `data` appears in `dead`.
- `keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins; E2751 carries a fix to the nearest name and E2753 one adding `final: true`.
- `chart` throws E2751, E2753 and E2754 for those fixtures.
- An event's transaction passes `properties` for a chart whose guards and actions are pure.
- `instance(c, 'a')` and `instance(c, 'b')` in one scope are stores `<id>:a` and `<id>:b`; a `tx` on one leaves the other unchanged; disposing the scope drops both from `stores()`; `instance(c, 'a b')` throws.
~~~

### spec/std/std.headless.md (new, 1,446)
~~~md
# std.headless: Headless widgets
status: proposed

**Package.** `@keel/std-headless`, client-safe, no config, no capability, no CSS. Widgets: `Listbox`, `Combobox`, `Menu`, `Tabs` (std.options), `Dialog`, `Disclosure`, `Toaster` (here); charts `optionsChart`, `openChart`, `toastChart`; types `Option`, `ToastItem`. Each widget is a component file (`.ts`) that calls `Part` (k.aria), base elements and `For` and `If` as functions. Keyboard, focus and ARIA follow the WAI-ARIA Authoring Practices 1.2 pattern each widget names.

**Ids.** A widget takes `id` and gives each part the id `<id>.<part>` from its table (k.component). Option, tab and toast keys become id segments: 1 to 64 characters of `[A-Za-z0-9_-]`, unique in the widget, else E2801 at render. Tests address parts by these ids.

**Text.** No widget holds copy: each string a person sees or hears is a prop (`label`, an option's `text`, `title`, `dismiss`) or a slot's output, so it comes from a message set (std.messages). A widget with a name takes `label` (written as `aria-label`) or `labelledBy` (an element id), exactly one.

**Values and state.** Values are the app's: a widget reads them through a function (`selected`, `text`, `items`) and reports a change through a callback (`onChange`, `onSelect`, `onDismiss`), so they live in a store, a form field, a signal or the route's search. Interaction state is a chart instance (std.statecharts `instance`) keyed by the widget's `id`, created in its scope:

| chart (id) | states | data | events |
| --- | --- | --- | --- |
| `optionsChart` (`headless.options`) | `closed` (initial), `open` | `active` -1 to 9,999; `count` 0 to 10,000; `back` | `open { count, at }` closed to open, `active` = `at` when below `count`, else -1, `back` false · `close { back }`, `choose` open to closed, `active` -1, `back` from the payload (`choose`: true) · `move { by, wrap }` (`next`, `prev`, `first`, `last`) in open: `next` from -1 is 0, `prev` from -1 is `count - 1`; past an end it wraps when `wrap`, else stays · `jump { to }` in open: `active` = `to` when below `count` · `items { count }`: `active` clamps to `count - 1` |
| `openChart` (`headless.open`) | `closed` (initial), `open` | none | `open`, `close`, `toggle` |
| `toastChart` (`headless.toast`) | `showing` (initial), `paused`, `gone` (final) | none | `pause`, `resume`, `expire` (in `showing`), `dismiss` (to `gone`) |

Invariant of `optionsChart`: `active` is -1 or below `count`, and -1 in `closed`. Chart data hold indexes and counts only: no key, text or typed character enters a chart, its log or a session. Every instance starts at `initial` on the server and at resume.

**Styling.** `styles` (k.aria) takes the parts each table names; `highlighted` marks the active option.

**Dialog** (APG Dialog (Modal)). `{ id, title: string, level?: 2-6, trigger: () => JSX, content: (close: () => void) => JSX, alert?: { description: string } }`; `openChart`. Parts: `trigger` (`button`, `hasPopup: 'dialog'`, `controls` `<id>.dialog`), `dialog` (`dialog`, or `alertdialog` with `describedBy` `<id>.description`; `labelledBy` `<id>.title`, `open` while `open`), `title` (`Heading`, default level 2), `description` (`Text`). Keys: a click or Enter or Space on the trigger sends `open`; Escape in the dialog sends `close`; Tab stays in the dialog by the platform's modal behavior. Focus moves in on open and back to the trigger on close (k.aria).

**Disclosure** (APG Disclosure). `{ id, summary: () => JSX, children }`; `openChart`. Parts: `button` (`button`, `expanded`, `controls` `<id>.panel`), `panel` (`generic`, `hidden` while closed). A click (Enter, Space) sends `toggle`.

**Toaster** (WCAG 4.1.3). `{ id, items: () => readonly ToastItem[], onDismiss: (id: string) => void, dismiss: string, duration?: number }`, `ToastItem = { id, text, tone: 'status' | 'alert' }`, `duration` 5,000 ms or more; a `toastChart` instance per item, keyed by its `id`. Parts: `status` (`status`) and `alert` (`alert`), both rendered from the first render so they are live before an item arrives; `toast.<item>` (`generic`) inside the region of its tone, `dismiss.<item>` (a `Button`, text `dismiss`). A `status` item with `duration` sends `expire` that long after it shows (`ctx.clock`); focus inside the item sends `pause`, leaving it `resume`, which starts the full duration again; an `alert` item never expires. The dismiss button sends `dismiss`; at `gone` the Toaster calls `onDismiss(id)`, and the app removes the item.

**Rules.** E2801 an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in its widget (thrown at render).

**Conformance.**
- `optionsChart`, `openChart` and `toastChart` hold the transitions in the table; under `explore`'s closed form `openChart` and `toastChart` are `complete` and `coverage` is empty; `explore` of `optionsChart` from `initial` with counts 0, 1 and 3, `at` and `to` -1, 0, 2 and 5, every `by`, `wrap` and `back`, at depth 6, finds no state breaking its invariant.
- No chart's state or log holds a key, a text or a typed character after any widget flow in this section or std.options.
- A Dialog's trigger click opens the dialog with focus on its first button; Escape closes it and focuses the trigger; an `alert` Dialog renders `alertdialog` with `aria-describedby`.
- A Disclosure's button click shows the panel and sets `aria-expanded="true"`; a second click hides it.
- A Toaster renders empty `status` and `alert` regions; a `status` item with `duration` 5,000 calls `onDismiss` after 5,000 ms of sim clock and not before; focus inside it holds it past 5,000 ms; an `alert` item stays.
- A key `a b` or a repeated key throws E2801.
- Every widget of this section and std.options rendered with its required props has no axe violations open and closed.
~~~

### spec/std/std.options.md (new, 1,382)
~~~md
# std.options: Listbox, combobox, menu and tabs
status: proposed

**Shared.** Part of `@keel/std-headless` (std.headless: ids, text, values, charts, styling). Each widget here keeps an `optionsChart` instance; `count` is the length of its list, sent as `items` when the list changes. `Option<K> = { key: K; text: string; disabled?: boolean }`, `K` a string. A disabled option or item can be highlighted and is never chosen or selected. The slot `option?: (o: Option<K>, s: { active(): boolean; selected(): boolean }) => JSX` renders an option's content (default: `o.text`). Typeahead: a printable key without `mod` adds to a buffer that empties 500 ms after the last key (`ctx.clock`, a signal of the widget, never in the chart) and sends `jump` to the next option, after the active one, whose `text` starts with the buffer (case-insensitive, `toLocaleLowerCase`). An option is highlighted through `activeDescendant`, so DOM focus stays on the list or the input.

**Listbox** (APG Listbox). `{ id, label | labelledBy, options: () => readonly Option<K>[], mode: 'single' | 'multiple', selected: () => readonly K[], onChange: (keys: K[]) => void, orientation?: 'vertical' | 'horizontal', option? }`. Parts: `list` (`listbox`, `tabIndex` 0, `multiselectable` in multiple), `option.<key>` (`option`, `selected`). Focus on the list sends `open` at the first selected option's index, else 0; blur sends `close`. Keys: ArrowDown and ArrowUp (ArrowRight and ArrowLeft when horizontal) `move` without wrap; Home, End `first`, `last`; typeahead; Space toggles the active option (multiple) or makes it the selection (single), and so does Enter in single; a click jumps to the option and does the same.

**Combobox** (APG Combobox, list autocomplete, manual selection). `{ id, label | labelledBy, text: () => string, onInput: (text: string) => void, options: () => readonly Option<K>[], onChange: (key: K) => void, option?, empty?: () => JSX }`; the app filters `options` from `text`. Parts: `input` (`combobox`, `expanded` while open, `controls` `<id>.list`, `activeDescendant`, `value` from `text`), `list` (`listbox`, `hidden` while closed or empty), `option.<key>`, `empty` (`status`, the `empty` slot while open with no options). Keys in the input: ArrowDown opens at 0 or moves next; ArrowUp opens at `count - 1` or moves prev (both wrap); Alt+ArrowDown opens at -1; Enter on an active option sends `choose` and calls `onChange`, else passes through; Escape closes, or when closed calls `onInput('')`; Home and End stay with the text. Typing calls `onInput` and opens at -1. Blur and a chosen click close.

**Menu** (APG Menu Button). `{ id, trigger: () => JSX, items: () => readonly (Option<K> & { checked?: boolean })[], onSelect: (key: K) => void, item? }`; an item with `checked` is a `menuitemcheckbox`. Parts: `trigger` (`button`, `hasPopup: 'menu'`, `expanded`, `controls` `<id>.menu`, focused when the chart closes with `back`), `menu` (`menu`, `tabIndex` -1, `labelledBy` `<id>.trigger`, `activeDescendant`, `hidden` while closed, focused while open), `item.<key>` (`menuitem` or `menuitemcheckbox`). Keys on the trigger: Enter, Space and ArrowDown open at 0; ArrowUp at `count - 1`. In the menu: ArrowDown, ArrowUp `move` with wrap; Home, End; typeahead; Enter and Space `choose` and call `onSelect`; Escape `close { back: true }`; Tab `close { back: false }` and moves on. A click on an item chooses it; blur outside the menu closes it.

**Tabs** (APG Tabs, automatic activation). `{ id, label | labelledBy, tabs: () => readonly Option<K>[], selected: () => K, onChange: (key: K) => void, orientation?, tab?, panel: (key: K) => JSX }`. Parts: `list` (`tablist`), `tab.<key>` (`tab`, `selected`, `controls` `<id>.panel.<key>`, `tabIndex` 0 on the selected tab and -1 on the others, focused when it is the active one of an open chart), `panel.<key>` (`tabpanel`, `labelledBy` `<id>.tab.<key>`, `tabIndex` 0, `hidden` unless selected). Focus on a tab sends `open` at its index; blur sends `close`. Keys: ArrowRight, ArrowLeft (ArrowDown, ArrowUp when vertical) `move` with wrap, Home, End; each move calls `onChange` with the new active tab's key, and focus follows it.

**Conformance.**
- A Listbox focused with nothing selected highlights `option.<first>`: the list's `aria-activedescendant` names it and `find` gives `state.active`; ArrowDown at the last option stays there; End then Home highlight the last and the first.
- In single mode Space calls `onChange([key])` with the active key; in multiple it adds or removes the key and keeps the others; a disabled option is never in a call.
- Typing `b`, `e` within 500 ms highlights the first option after the active one whose text starts with `be`; after 500 ms with no key a new buffer starts.
- A Combobox's ArrowDown opens the list with `aria-expanded="true"` and the first option active; Enter calls `onChange` with its key and closes the list; Escape closes an open list and clears the text of a closed one.
- A Combobox with no options while open hides the `listbox` and shows `empty` in a `status`.
- A Menu trigger's Enter opens the menu with focus on `menu` and the first item highlighted; ArrowUp on the first wraps to the last; Enter calls `onSelect` and returns focus to the trigger; Escape returns focus without a call; Tab closes it without moving focus back.
- Tabs: ArrowRight on the last tab calls `onChange` with the first key and focuses it; only the selected tab has `tabindex="0"` and only its panel is shown; `focusOrder()` (k.a11y) holds one tab.
~~~

### spec/std/std.tables.md (new, 1,498)
~~~md
# std.tables: Data tables
status: proposed

**Package.** `@keel/std-tables`, client-safe, no config. Exports `columns`, `tableSearch`, `tablePage`, `applyQuery`, `DataTable`, `TableSearch`. A table is a native `table` of `Part`s (k.aria) with APG Sortable Table semantics: links and checkboxes in Tab order, no grid keyboard model. Text, ids and `styles` follow std.headless.

**Columns.**
```ts
export const catalogColumns = columns(CatalogRow, {
  key: 'id', rowHeader: 'title', show: ['title', 'price', 'minutes', 'added', 'favorite'],
  sort: ['title', 'price', 'minutes', 'added'], search: ['title'], filter: ['currency', 'favorite'],
  compare: { price: (a, b) => a.minor - b.minor },
})
```
`columns(row, spec)` reads the `s.object` `row`. A field's kind comes from its schema: `text` (a string, or a format type whose JSON is a string), `number` (`s.int`, `s.number`), `enum`, `boolean`, `value` (anything else). `key` is a `text` or `number` field unique per row; `rowHeader` (default the first of `show`) renders as `th scope=row`. `sort` columns compare by kind: `text` with `Intl.Collator(locale)`, `number` numerically, `enum` in declaration order, `boolean` false first, `value` only through `compare`. `search` columns are `text`; `filter` columns are `enum` or `boolean`. Anything else, or a field `row` lacks, is E2851, thrown.

**Query.** `tableSearch(columns)` is the route's `search` schema (k.router), every key optional: `sort` (an enum of `sort`), `dir` (`asc`, `desc`), `page` (`s.int({ min: 1 })`), `q` (`s.string({ max: 200 })`, present when `search` is), and each `filter` column under its own name. A filter column named `sort`, `dir`, `page` or `q` is E2852; a `search` column marked `.pii()` is E2852 too, since `q` travels in the URL (k.privacy E1111). `tablePage(row)` is `s.object({ rows: s.array(row), total, page, pages })`. `applyQuery(columns, rows, search, { pageSize, locale })` returns a `TablePage`: rows where some `search` column contains `q` (both `toLocaleLowerCase(locale)`) and each filter equals; sorted stably by `sort` and `dir` (default `asc`), ties by `key` ascending, input order without `sort`; then page `page` clamped to 1 to `pages`, `pages` = max(1, ceil(`total` / `pageSize`)). `pageSize` is 1 to 500 and keys are unique and id-safe (std.headless), else E2853, thrown. It is pure and runs in loaders and browsers alike.

**Sources.** Client: `rows: () => readonly T[]` with `pageSize`: a store read (`get`, `select`; a live store's changes rerun it), a signal, or a resource's value inside `Match`; the table applies `applyQuery`. Server: `page: TablePage<T>` from a loader whose `search` is the route's `tableSearch` and whose output holds `tablePage(row)`; the table renders it as given. Sort, page and filter changes are links to `href(search)`: they work without JS, back restores a view, and a server source reloads through its loader.

**DataTable.** `{ id, label | labelledBy, columns, search, href: (s) => Href, locale, rows + pageSize | page, selected?, onSelect?, text, cells?, header?, actions?, empty? }`. `text`: `headers` (one per shown column), `pager`, `previous`, `next`, `pageOf(page, pages)`, and with selection `selectAll` and `selectRow(row)`, with `actions` `actions`. Slots: `cells[col](row)` (required for `boolean` and `value` columns, by type; default: `text` and `enum` as is, `number` through `formatNumber`), `header(col, sort)`, `actions(row)` (a last column), `empty` (one cell spanning the row when `total` is 0). Parts: `table` (`table`, `rowCount` `total + 1` when the page holds fewer than `total`), `head`, `body`, `header.<col>` (`columnheader`, `sort` on the sorted column only), `sort.<col>` (a `Link` to the same search with this `sort`, `dir` `desc` when already `asc` on it, else `asc`, and no `page`), `row.<key>` (`row`, `rowIndex` its position in the whole result plus 1), `cell.<key>.<col>`, `select.<key>` and `selectAll` (`checkbox`; `selectAll` is `'mixed'` when some page rows are selected and toggles the page's keys), `pager` (`navigation`), `previous` and `next` (`Link`s, absent at the ends), `status` (`status`, `pageOf`). When a navigation removes the focused pager link, focus moves to `status`.

**TableSearch.** `{ id, label, search, href, delay?: number }`: an `Input` (`<id>.input`) whose value is `q`; `delay` (default 300 ms on `ctx.clock`) after the last input it calls `navigate(href({ ...search, q, page: undefined }), { replace: true })`, `q` absent when empty.

**Rules.** E2851 a `columns` entry naming no field or a field of the wrong kind · E2852 a filter column with a reserved name, or a `.pii()` `search` column · E2853 `pageSize` outside 1 to 500, or a key repeated or not id-safe.

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
~~~

### spec/00-map.md and spec/std/README.md (orchestrator)
- Kernel rows: `k.aria | Widget parts | proposed | Part, roles, focus, dialog, part styles (stdlib only)`.
- Std rows: `std.headless | Headless widgets | proposed | Dialog, Disclosure, Toaster, three charts`; `std.options | Option widgets | proposed | Listbox, Combobox, Menu, Tabs`; `std.tables | Data tables | proposed | columns from a schema, query in the URL, applyQuery`.
- Codes: `E2800-E2849 std.headless`, `E2850-E2899 std.tables`; E1822 joins k.aria. About 70 tokens on the map.

## Conformance diff
The conformance-writer of each lane writes these from the accepted spec text, skipped until implementation; each new clause is cited verbatim by exactly one file. k.ui, k.component, k.a11y, k.testing and k.router keep every clause covered, so they stay at their status; k.aria and the three std sections are `proposed`.

- **Kernel, edited header (one `rfc:0084` commit in the kernel lane).** `packages/router/conformance/push-focus-scroll.test.ts` quotes the k.router clause that changes. Its scroll assertions keep their meaning for a push to another route and gain a search-only push; its `activeElement` assertion moves to the k.head focus file RFC 0083 adds (if RFC 0083's lane has not already moved it). k.component's clauses renumber by two after the second clause (citations are by text, so no header changes).
- **Kernel, added.** k.aria: `packages/ui/conformance/aria-roles.test.ts`, `aria-labels.test.ts`, `aria-focus.test.ts`, `aria-onkey.test.ts`, `aria-mousedown.test.ts`, `aria-highlighted.test.ts`, `aria-dialog.test.ts`, `aria-axe.test.ts`; `packages/compiler/conformance/part-styles.test.ts`; `packages/check/conformance/rule-E1822.test.ts`. k.component: `packages/runtime-dom/conformance/slot-prop-scope.test.ts`, `second-argument-undefined.test.ts`. k.testing: `packages/testing/conformance/state-active-sort-mixed.test.ts`.
- **std-statecharts, added.** `instance.test.ts`.
- **std-headless, added** (`packages/std-headless/conformance/`). std.headless: `charts-transitions`, `charts-explore`, `charts-no-app-data`, `dialog`, `disclosure`, `toaster`, `keys-e2801`, `axe-widgets`; std.options: `listbox-keys`, `listbox-select`, `typeahead`, `combobox-keys`, `combobox-empty`, `menu-keys`, `tabs-keys`.
- **std-tables, added** (`packages/std-tables/conformance/`). `columns-kinds`, `apply-query`, `table-search`, `aria-rows`, `sort-link`, `select-all`, `pager-focus`, `table-search-input`, `client-store`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): `Part` renders every role with generated required props without a type escape and with no axe violation; `applyQuery` over rows generated from a row schema; `optionsChart` against a naive index model under generated event sequences; `columns` over generated `s.object` schemas either throws E2851 or derives one kind per field.

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (k.aria, std.headless, std.options and std.tables new; the k.ui, k.component, k.a11y, k.testing, k.router and std.statecharts edits; the map and `spec/std/README.md`). Write the ADRs. Create `packages/std-headless` and `packages/std-tables` in the std-messages shape (`package.json` with a `.` export only; `std-headless` depends on `@keel/ui`, `@keel/runtime-dom`, `@keel/reactive`, `@keel/schema`, `@keel/ctx`, `@keel/std-statecharts`; `std-tables` on `@keel/ui`, `@keel/router`, `@keel/runtime-dom`, `@keel/reactive`, `@keel/schema`, `@keel/ctx`, `@keel/std-i18n`; `@keel/testing`, `@keel/compiler`, `happy-dom`, `axe-core` and `fast-check` as dev dependencies; `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, an empty `src/index.ts`, `conformance/`, `unsafe/`). Add the `./aria` export to `packages/ui/package.json`. Set the `tooling/deps.json` order: `std-headless`, then `std-tables`, after RFC 0082's `std-statecharts`. Add the `tooling/budgets.json` entries (Token impact). Add both packages to `apps/golden-2/package.json`. Run `pnpm install` once. Run the conformance-writers. Shared files stay with the orchestrator: `spec/**`, `docs/**`, `.claude/skills/**`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 to K5) | `packages/ui/src/**`, `packages/compiler/src/internal/collectStyles.ts` and its tests, `packages/check/src/rules/ariaImport.ts`, `packages/check/src/internal/EXPLANATIONS.ts`, `packages/testing/src/**`, `packages/router/src/**`, `packages/runtime-dom/src/types/**`; the kernel conformance files above and the one header edit; kernel changesets | nothing; commits K1 (`Part`), K2 (part styles), K4 (harness state), K5 (scroll), K3 (slot types) in that order | `pnpm --filter @keel/ui --filter @keel/compiler --filter @keel/check --filter @keel/testing --filter @keel/router --filter @keel/runtime-dom run check`, the same with `run test` |
| headless | `packages/std-headless/**`; `packages/std-statecharts/src/instance.ts`, `src/ChartInstance.ts`, its `index.ts` export line, `conformance/instance.test.ts`, its changeset | K1 to render; writes `instance`, the three charts and their `explore` tests first, then the widgets | `pnpm --filter @keel/std-statecharts --filter @keel/std-headless run check && pnpm --filter @keel/std-statecharts --filter @keel/std-headless run test` |
| tables | `packages/std-tables/**` | K1 and K4 for `DataTable` tests; writes `columns`, `tableSearch`, `tablePage` and `applyQuery` with their property tests first | `pnpm --filter @keel/std-tables run check && pnpm --filter @keel/std-tables run test` |
| golden-2 | `apps/golden-2/**`; `evals/tasks/golden-2-catalog/**` (new) | every lane; starts with the schemas, `catalogColumns`, the api route and the message keys | `pnpm --filter golden-2 run check && pnpm --filter golden-2 run test && pnpm eval --task golden-2 --runner none --strict && pnpm eval --task golden-2-catalog --runner none --strict` |

Order: kernel, headless and tables start at once; headless and tables write their pure parts against the spec text and render once K1 lands. golden-2 writes its schemas, columns, api route and copy first and the page last. That is three implementation agents and one kernel agent, inside the program's batch budget. After the batch, alone: `pnpm mutate` for `@keel/ui`, `@keel/compiler`, `@keel/check`, `@keel/testing`, `@keel/router`, `@keel/std-statecharts`, `@keel/std-headless` and `@keel/std-tables`, one at a time; `pnpm ledger`; `pnpm eval --task golden-2-catalog --runner claude` for the agent build, its result committed under `evals/results/`. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, `pnpm ledger --diff`, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0317 (kernel lane, `packages/testing`: `find` has no `lang` and no stable handle across navigations) if S2 to S6 left it open, since K4 edits the same `Found` type; 0316 (kernel lane, `packages/router`: a route `title` gets untyped `RouteProps`) if still open. 0324 (std-messages: E2406 misses `aria-label`, `title`, `placeholder` and literal consts) matters to this stage, because a literal passed to a widget's `title`, `dismiss` or `text` prop passes E2406 today; it needs a std.messages text change that does not fit this RFC's sections (std.messages is at 1,489), so it waits for its own RFC, which this RFC recommends opening with S7's batch. 0335 (a size budget for golden-2's client entry) is orchestrator work and should land before the golden-2 lane grows the entry. 0282, 0289 and 0281 (`packages/runtime-dom` beyond `types/`), 0304 and 0313 (`packages/compiler` beyond `collectStyles.ts`) are outside these lanes and wait.

## Migration
- **Kernel callers.** `Part`, the part styles and the four states are additions; no base element changes. The `Slots` type becomes `undefined` in `Component`, `Island` and `TestComponent`; nothing passes a second argument today (the router already types it `undefined`, `mount` passes none), so no caller changes. Harness `state` gains optional fields that appear only for elements carrying `aria-activedescendant`, `aria-sort` or a mixed checkbox; no existing app renders one.
- **k.router scroll.** golden-1's filter links (`?filter=active`) and golden-2's `?only=favorites` links keep scroll after this change where they scrolled to the top; no test of either app asserts that scroll. The changed conformance header is in the kernel lane.
- **std.statecharts.** `instance` is an addition; `chart` is unchanged.
- **golden-2** (Open question 2). The catalog page, the api route, the `Toaster` in `BoxShell`, about 30 message keys in three locales, two tests and the new eval task; the README follows.
- **Docs** (orchestrator). docs/GLOSSARY.md: the **extension point** list gains "widget parts (`@keel/ui/aria` `Part`, stdlib only)" (an addition; no term renamed). docs/ARCHITECTURE.md: the extension point list gains widget parts; std-headless and std-tables join the stdlib paragraph; Borrow vs build gains "Widget behavior: borrow the WAI-ARIA Authoring Practices and the platform `<dialog>`; build widgets on `Part` and charts; no React library", "Tables: borrow TanStack Table's sort and paging semantics; build `applyQuery` and keep the query in the route's search". docs/A11Y-TARGET.md: "headless primitives ship keyboard and focus behavior" names `@keel/std-headless` and `@keel/std-tables`. The `keel` skill gains widget and table lines (controlled values, `label` from a message set, `styles` by part, the table query in the route search); the `keel-testing` skill gains `state.active`, `state.sort` and driving widgets with `keydown`. Each new package gets a README in the std-money shape.

## Token impact
Sections after the change (measured): k.aria 1,470 (new), k.ui 1,433 (from 1,421 after RFC 0083), k.component 988 (from 788), k.a11y 1,293 (from 1,281 in RFC 0083), k.testing 1,169 (from 1,081 after RFC 0083), k.router 1,499 (unchanged count), std.statecharts 1,298 (from 1,120 in RFC 0082), std.headless 1,446, std.options 1,382 and std.tables 1,498 (new); spec map about 70 more. k.router stays 1 token under the cap and std.tables 2; the next change to either needs a split first (k.router's seam is its Guards paragraph, std.tables' its TableSearch paragraph). An app author building a widget page reads std.headless and std.options (2,828 tokens); a table page, std.tables and std.headless (2,944); the kernel agent reads k.aria, k.ui and k.component (3,891). The `keel` skill grows by about 90 tokens, `keel-testing` by about 30.

Package sizes (gzip, `tooling/budgets.mjs` rule; estimates, measured at batch end):

| Package | Today | Estimate | `budgets.json` |
| --- | --- | --- | --- |
| `@keel/ui` | `4kb` budget | unchanged (`Part` is a separate entry) | holds |
| `@keel/ui/aria` | new | 1.8 kB (role table, focus, dialog, highlight) | `"2.5kb"` |
| `@keel/std-statecharts` | `1.5kb` budget (RFC 0082) | +0.15 kB (`instance`) | holds |
| `@keel/std-headless` | new | 4.5 kB (seven widgets, three charts, typeahead) | `"6kb"` |
| `@keel/std-tables` | new | 3 kB (`columns`, `applyQuery`, `DataTable`, `TableSearch`) | `"4kb"` |
| `@keel/compiler`, `@keel/testing`, `@keel/router`, `@keel/check` | | under 0.2 kB each | hold |

A page that uses one widget adds `Part`, the chart runtime and that widget's file; tree shaking keeps the other widgets out.

## Known limits
- **Popups and toasts render in flow.** The style vocabulary has no `position`, `inset` or anchor, so an open menu or combobox list pushes content down, and the Toaster sits where the layout puts it. A later RFC can add placement once CSS anchor positioning is in every engine Keel supports.
- **A toast raised while a modal dialog is open** sits in an inert region and is not announced until the dialog closes.
- **No virtual rows** (Open question 3). Large results page, on the client or through a loader.
- **Patterns not shipped.** Grid, treegrid, tree, slider, radio group, menubar, submenus, date picker; Shift+Arrow range selection in a Listbox; manual tab activation; a Dialog opened without its trigger; toast actions. Each is a later stdlib change on `Part`.
- **One table query per route.** Two tables on one route share `sort`, `page` and `q`.
- **Option lists hold at most 10,000 entries**, the bound of `optionsChart`'s data, and `optionsChart`'s rung is `exhaustive`, never `proven`.
- **Typeahead matches by prefix** after `toLocaleLowerCase`, without accent folding.
- **Hover does not pause a toast**; focus does.
- **The harness has no top layer.** happy-dom makes no element inert under `showModal()`; Tab containment and Alt+ArrowDown are checked only in the browser journey.
- **Literal copy in widget props** other than `label` passes E2406 until backlog 0324 lands.

## ADRs
Outlines for the orchestrator to number after ADR-0096 and write with this RFC's acceptance.
- **Stdlib widgets are built from one kernel element, `Part`, closed to app code** (K1, k.aria). A role table fixes the tag and the typed ARIA props; focus, `showModal()` and active-descendant behavior live in the element; E1822 keeps app code on the widgets, `unsafe/` excepted. Chosen over ARIA props on base elements (a second way, unchecked keyboard models), lowercase intrinsics in stdlib source (no types, no resume guarantee) and one kernel element per widget (seven frozen contracts).
- **Apps style a stdlib component by part, through the compiler** (K2, k.aria). `styles={{ part: {...} }}` is collected like base element style props; `selected`, `checked`, `expanded` and `highlighted` compile to attribute selectors. Chosen over a stdlib stylesheet (a visual opinion) and over class props (k.ui has none).
- **Named slots are props; the second component argument is `undefined`** (K3, k.component). Chosen over a `slots` argument beside `children` and the standard slots (two ways to pass a function).
- **Widget values are controlled; interaction state is a chart instance holding indexes** (std.headless, std.statecharts `instance`). Three charts serve seven widgets; `explore` proves `openChart` and `toastChart` and exhausts `optionsChart` to depth 6; no key, text or typed character enters a log. Chosen over widget signals (unexplorable), charts holding keys (privacy) and Zag.js or XState (a second runtime).
- **Focus models follow the APG per pattern, and the platform owns modality** (k.aria, std.options). Active descendant for option lists, roving `tabindex` for tabs, native `<dialog>` with `showModal()` for dialogs, popups and toasts in flow. Chosen over JavaScript focus traps, portals and the popover API (absent from the harness DOM).
- **A table's query lives in the route's search, and one pure `applyQuery` serves loaders and browsers** (std.tables, K5). Native table semantics per the APG Sortable Table; search-only pushes keep scroll. Chosen over TanStack Table (a second state model, code-defined columns), table state in a chart or signal (no URL, no server path) and the ARIA grid pattern.

## Open questions
WORKFLOW requires escalation for new hand-written user-facing API shapes and golden-app migrations; the defaults settle the rest. Recommendations:

1. **Accept the API shapes as a set.** `Part` with its role table, `KeyInput`, `focus`, `onKey`, `onDismiss`, the closure to stdlib code (E1822) and `unsafe/` as the exit; `styles` by part and the four states; slot props and the `undefined` second argument; `instance(chart, key)`; the seven widgets' props, slots and part ids; `columns`, `tableSearch`, `tablePage`, `applyQuery`, `DataTable`, `TableSearch`. Recommendation: accept. Each shape mirrors an existing one (base element props, standard slots, `chart`, route `search` schemas), and the controlled-value pattern is the in-distribution React shape (principle 9).
2. **Migrate golden-2 for the exit proof.** The catalog page, the `kitchen.catalog` api route, the `Toaster` in `BoxShell`, about 30 message keys in three locales and the `golden-2-catalog` eval with its browser journey; nothing existing changes behavior except search-only links keeping scroll. Recommendation: accept. golden-2 holds the money, date and locale values a table must format and an api deployable to page from; golden-1 has neither locales nor format types, and golden-3 (RFC 0083) does not exist until S6 builds it.
3. **Virtual rows.** Recommendation: defer to a later RFC and ship paging in S7. Evidence: a virtual body needs three more kernel changes (an `overflow` style, a `scroll` event in the harness's closed `TestEvent` union, and spacer heights that are a row count times a token, which atomic classes cannot express without a new token group), k.ctx's `FireEvent` section sits at 1,494 of 1,500 tokens after RFC 0082, happy-dom computes no layout so the window arithmetic cannot run under the harness, and a screen reader's browse mode and Tab reach only rendered rows, for which the APG has no pattern. `aria-rowcount` and `aria-rowindex` are already in place for paged tables, so a later window drops in without changing the table's ARIA. If you want virtual rows in S7, the kernel lane takes the three changes and a fourth lane owns the window; the exit page adds a 500-row client table.

**Borrow vs build, decided by defaults 1 to 3 with evidence.**
- **Borrow the APG and the platform; borrow no widget code.** Radix UI, React Aria and Downshift render through React and share state through context providers, which principle 2 forbids; none is installed (`node_modules/.pnpm` holds no `@radix-ui`, `react-aria`, `downshift` or `@zag-js` package). Their keyboard maps follow the APG, which each widget cites by pattern. The platform's `<dialog>` with `showModal()` gives modality, inertness and close requests; happy-dom 21.0.4 implements `showModal()` as setting `open` (`HTMLDialogElement.js:81-83`), so `Part` moves focus itself and the browser journey checks the rest.
- **Build charts on std.statecharts.** Zag.js would bring its own machine runtime; RFC 0082 already rejected a second state model (XState), and std.statecharts' charts get the log, sessions and `explore` with no new runtime.
- **Borrow TanStack Table's semantics, build `applyQuery`.** Not installed; its column defs, state objects and `manualPagination` duplicate the route search and the schema. Its stable sort, ascending-first cycle, row id and row count map onto `applyQuery`, `key` and `tablePage.total`.
- **Borrow axe-core through RFC 0083's harness** for every widget state, and Playwright's Chromium and WebKit for what happy-dom lacks (layout, top layer, Tab containment).
