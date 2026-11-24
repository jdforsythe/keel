# RFC 0203: k.ui: a scroll region for a wide table, and `textAlign`

Status: implemented (ADR-0225), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.ui (Base elements, Style props, new **Scroll regions**, Base, Conformance), k.a11y (Required props, Order and focus, Conformance), std.tables (DataTable, Parts, `styles`, Rules, Conformance; status `implemented`) and the std map row. From backlog 1052.

## Decisions
- D1: `Box scroll="x"` is the one scroll container. It renders a `div` with `role="region"`, `tabindex="0"`, class `k-scroll` and a name from `label` or `labelledBy`, exactly one (E1802). It is a structural prop read at build, not a style prop: it changes the element's role and Tab order, which a look, a `base` set, a state or a breakpoint must not do.
- D2: `textAlign` is a new keyword style prop: `start`, `center`, `end`, logical only. It is responsive, takes `states`, and works in looks and `base` sets like every other style prop.
- D3: the `keel.base` layer gains `th{text-align:inherit}` and `.k-scroll{overflow-x:auto;min-width:0}`, emitted with any tokens.
- D4: `DataTable` gains `scroll?: "x"`, which wraps its `table` (not its pager) in a `Box scroll="x"` named as the table is; and a `styles` key `column.<col>` whose style props go on that column's header and cells.
- D5: no new diagnostic code. A missing or doubled name is E1802, an unknown `textAlign` keyword is E1801, a `column.<col>` key naming no shown column is E2851.

## Problem
golden-2's catalog (`apps/golden-2/modules/recipes/CatalogPage.tsx`) renders a `DataTable` of five shown columns plus a selection column and an actions column. At a 390px viewport the table is 569px wide (582px in de-DE, whose headers are longer), so the page scrolls sideways and every other block on it scrolls with the table (WCAG 1.4.10 Reflow asks a page to fit 320 CSS px without two-dimensional scrolling, a data table excepted, and the exception covers the table alone, not the page). The table cannot get narrower: the `keel.base` layer gives `table` `overflow-wrap: break-word`, so a column is as wide as its longest word, which is what makes a table readable.

Nothing in Keel can contain it:
- The style vocabulary (`p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap`) has no overflow. `w="full"` on a wrapper limits the wrapper; the table still spills out of it.
- A plain `overflow-x: auto` wrapper would not be enough either. A scroll container a keyboard cannot reach fails WCAG 2.1.1 in browsers that do not make scrollers focusable (Safari), and axe-core's `scrollable-region-focusable` reports it; once it is focusable it needs a role and a name, or a screen reader announces an unnamed focus stop.
- `DataTable`'s root is a `generic` `Part` holding the `table` and the pager. An app can only wrap the whole component, so the pager would scroll away with the table.

The second fault is alignment. Every `th` is centred: the browser's own stylesheet gives `th` `text-align: -internal-center` (Chromium; Firefox and Safari do the same), and no Keel rule overrides it. So the title, price and date headers sit centred over cells that start at the left. The style props cannot fix it, and cannot right-align a numeric column either: there is no text alignment in the vocabulary (`align` is the flex `align-items`). In an `rtl` locale a hand-written `right` would be wrong, so the value must be logical.

The fix must cost an app that does not use it nothing it can notice, and must not add a second way to style.

## Proposal
### Scroll regions (k.ui)
```tsx
<Box scroll="x" label="Prices">
  {() => <PriceTable />}
</Box>
```
- `scroll` takes `"x"` alone; a later `"y"` would need `h` and a rule for it, and nothing asks for it now. The value form leaves room without a rename.
- The element is a `div` with `role="region"`, `tabindex="0"`, class `k-scroll`, and `aria-label` from `label` or `aria-labelledby` from `labelledBy`. The types require exactly one; `keel check` without types reports E1802 for neither, both, or a blank literal `label`, as it does for `Host` (k.host-element). `as` is refused with `scroll` (a type error): the region role is the element's role.
- The region is in the Tab order. A keyboard user reaches it, the `base.focus` ring shows on it, and the arrow keys scroll it. This is the pattern WAI's table guidance and axe-core expect (`role="region"`, a name, `tabindex="0"`).
- `scroll` is read at build, with `as` and `level`: a role and a tab stop do not change after the first render.

### `textAlign` (k.ui)
```tsx
<Part role="cell" textAlign="end">{() => price}</Part>
```
A keyword style prop beside `direction align justify wrap`, mapped to `text-align` with no flex lead: `start`, `center`, `end`. `end` is the right edge in `ltr` text and the left in `rtl`, so a numeric column aligned `end` is right in every locale. There is no `left` or `right`; `textAlign="right"` is E1801 (`one of start center end`), as an unknown `direction` keyword is today. It is a style prop in every sense: responsive, under `states`, in a look, in a `base` set, and compiled to one atomic class per value.

### Base rules (k.ui)
The `keel.base` layer, after `table{overflow-wrap:break-word}`, gains:
```css
th{text-align:inherit}
.k-scroll{overflow-x:auto;min-width:0}
```
- `th{text-align:inherit}`: a header cell aligns as the cells of its row, at the start by default. A `textAlign` on the `table` or `row` reaches the headers too. Atomic rules are unlayered, so a `textAlign` on the `th` itself wins.
- `.k-scroll`: the overflow, and `min-width: 0` so a region that is a flex item in a row shrinks to its container instead of growing to its content. In a flex column (golden-2's panel) a stretched item already has the container's width.
- Both are written with any tokens, as `[hidden]` and the `table` rule are: they fix browser defaults, not a theme.

### DataTable (std.tables)
```tsx
<DataTable
  id="recipes.table"
  scroll="x"
  label={props.data.text.tableLabel}
  styles={{
    cell: { px: "2", py: "2" },
    "column.price": { textAlign: "end" },
    "column.minutes": { textAlign: "end" },
  }}
  ...
/>
```
- `scroll="x"` renders part `scroll`, a `Box scroll="x"` from `@keel/ui` with id `<id>.scroll`, holding `<id>.table` alone; the pager stays outside it, at the page's width. The region is named as the table is: the same `label`, or `labelledBy` the same id. Without `scroll` no element wraps the table and the DOM is what it is today. `scroll` is read once.
- `styles` takes `column.<col>` for each shown column. Its style props go on `header.<col>` and every `cell.<key>.<col>`, spread after `header` and `cell`, so they win per prop. It is the one place to style a column. The key is a literal property of the `styles` literal, so the compiler collects its style props as it collects every part's (k.aria Part styles); a computed key is E1823 as today.
- The `columns` call is untouched: alignment is style, and the compiler only sees style props written in the app's own `styles` literal, so a `DataTable` cannot choose a class itself. That is also why a `number` column is not aligned `end` by default: a default would need a class the app never wrote. The keel-client skill tells an author to align numeric columns `end`.
- `TableStyles` is typed over the shown columns (`` `column.${C}` ``), so a misspelt key is a type error; without types, `DataTable` throws E2851 naming the key.

### golden-2
`CatalogPage.tsx` sets `scroll="x"` on `recipes.table` and `"column.price"` and `"column.minutes"` to `textAlign: "end"`. At 390px, in en-US and de-DE, the document is 390px wide; the table scrolls inside `recipes.table.scroll`, and every header starts where its cells start.

### Cost for an app that does not use it
- No JavaScript runs for a `Box` without `scroll` beyond one `undefined` test; no element, attribute or class is added to any existing DOM, `DataTable` included.
- The CSS file gains the two base rules, 60 bytes before compression, in every app. They are constant and correct browser defaults (the `th` rule fixes every table, used or not); emitting `.k-scroll` only when used would need the compiler to see inside `@keel/std-tables`, which it does not.

## Alternatives
- **An `overflow` style prop** (`overflow="auto"`). Rejected: a style prop can sit in a look, a state or a breakpoint, so the region role, the tab stop and the name would have to follow a class the element may or may not have. A scroll container's semantics are structural; the prop is too.
- **`DataTable` always wrapping its table in a region.** Rejected: every table gains a Tab stop and a landmark whether it overflows or not, and an existing app's DOM changes.
- **An app wrapping the whole `DataTable` in `Box scroll="x"`.** It works and is not forbidden, but the pager scrolls away with the table; `DataTable scroll` is the spelling that keeps it, and both use the one `scroll` prop.
- **Alignment in `columns`** (`align: { price: 'end' }`), with a `number` default. Rejected: `DataTable` would have to emit a class the compiler never saw, so it needs either a fixed rule per value in every app or a data attribute styled outside the style props, a second way to style.
- **`left` and `right` values.** Rejected: wrong in `rtl` locales, and one logical set is the one way.
- **Reusing `align` for text.** Rejected: `align` is `align-items` and makes an element flex; one name for two properties breaks E1809's reading of flex props.
- **`th{text-align:start}`** instead of `inherit`. Rejected: a `textAlign` on the table or a row would reach the `td`s but not the `th`s.

## Spec diff
Applied in this commit.
- **k.ui** (stays `implemented`). Base elements: `scroll` read at build. Style props: `textAlign` in the list and its sentence. New paragraph **Scroll regions**. Base: the `th` and `.k-scroll` rules, role class `k-scroll`. Conformance clauses 24 to 27. About 2,832 tokens.
- **k.a11y** (stays `implemented`). Required props: `label` or `labelledBy` on `Box scroll`. Order and focus: a `Box scroll` writes `tabindex="0"`. Conformance clause 16.
- **std.tables** (`conformance-covered` to `implemented`, in the section and `spec/std/README.md`). DataTable: `scroll?`; read once: `scroll`; Parts: `scroll`; `styles` `column.<col>`; Rules: E2851 for an unknown `column.<col>` key. Conformance clauses 10 and 11.
- No new code; no glossary term; no map change but the std.tables row.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/ui/conformance/text-align.test.ts`: k.ui#24 (the `end` rule, no `display`, the media block, E1801 for `right`).
- `packages/ui/conformance/scroll-region.test.ts`: k.ui#25 (the two base rules with any tokens), k.ui#26 (the region's attributes in server and client output, axe, `labelledBy`, none without `scroll`), k.ui#27 (the type errors, as `rules-e1801-e1802-types.test.ts` asserts types).
- `packages/check/conformance/E1802-scroll-region.test.ts`: k.a11y#16.
- `packages/std-tables/conformance/scroll-and-columns.test.ts`: std.tables#10 (the region, its name, the pager outside, no wrapper without `scroll`) and #11 (`column.<col>` classes, precedence, E2851).

No existing case contradicts the new text: no conformance test asserts a `th`'s alignment, and the base-layer tests (`hidden-over-display.test.ts`, `unbroken-string-wrap.test.ts`) read rules this change keeps in place.

## Migration
None. An app that sets neither `scroll` nor `textAlign` keeps its markup; its headers move from centred to the start of their cells.

## Token impact
- Spec: k.ui about 2,832 tokens (from 2,374), k.a11y 2,153 (from 2,053), std.tables 1,776 (from 1,499); each under the 3,100 section budget. The map is unchanged; `spec/std/README.md` changes one status word.
- `keel docs`: no new section, no map row. The keel-client skill gains a sentence on wide tables and numeric columns, to measure against its target in the build.
- CSS: 60 bytes in every app's stylesheet. `@keel/ui` and `@keel/std-tables` bundle sizes to measure in the build.
- MCP: none.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the five clauses. 3. Build:
- `packages/ui`: `types/StyleValues.ts` and `internal/vocabulary.ts` (`textAlign`, no lead), `internal/styleProps.ts` (append `textAlign`), `elements/Box.ts` (the `scroll` union, `role`, `tabindex`, `aria-labelledby`, `k-scroll`), `css/compileStyles.ts` (the two base rules), the README.
- `packages/compiler/src/internal/collectStyles.ts` (`STYLE_PROPS` gains `textAlign`), and the check rule for E1802 in `packages/check` (the `Box scroll` name, beside the `Host` one).
- `packages/std-tables`: `DataTableProps.ts` (`scroll`), `TableStyles.ts` (typed `column.<col>` keys), `DataTable.ts` (the region, the column spread, E2851), the README.
- `apps/golden-2/modules/recipes/CatalogPage.tsx`, with a test that the 390px document is 390px wide in en-US and de-DE in the browser smoke that measured 569px.
- The keel-client skill (data tables), a changeset, `tasks/BACKLOG.md` 1052.

## For the operator
1. **Headers in every app move from centred to the start.** Recommended: accept; centred headers over start-aligned cells are a browser default nobody chose, and `textAlign` on the header restores centring where wanted.
2. **A numeric `DataTable` column is not aligned `end` by default.** Recommended: accept for now; a default needs `DataTable` to emit a class the app did not write. If the compiler later collects style usages from std packages, a `number` default becomes one line.
3. **60 bytes of CSS in every app.** Recommended: accept; constant, and smaller than one `look`.
