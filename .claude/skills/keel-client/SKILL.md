---
name: keel-client
description: "Build Keel pages: components, routes, forms, widgets, data tables, message sets, locale formats, title, a11y; E1304, E1401, E1407, E1403, E1406, E1703, E1802, E1809, E1810, E1814, E1826, E19xx, E24xx, E28xx, E1583"
---

# Pages, forms, widgets, tables and text

Signatures: `keel docs client` and `keel docs ui` list them; `keel docs <id>` for `k.component` `k.router` `k.contract` `k.forms` `k.head` `k.ui` `k.a11y` `std.headless` `std.options` `std.tables` `std.messages` `std.i18n`.

**Components.** One default export per file, named as the file, with `export const Props = s.object(...)`. Props are getters: never destructure (E1401). Branch with `<If when fallback>` and `<Match on>` with `<Case tag>`; repeat with `<For each key>`, whose child is `(item) => ...`. Children of `If` and `Form` are written inline; `{a && <b/>}` and `.map()` over elements are E1403, a `{() => ...}` child E1403 or E1406. A component's own state is `signal(initial)` (`@keel/reactive`): read `open.get()`, write `open.set(v)`; a signal is not callable. A top-level `const x = props.y` read in JSX is E1405. Give what a test addresses `id="area.name"` (E1404). Style props take token names `tokens.ts` declares (`p="2"`; E1801). `gap` spaces a flex element only: give `direction` at or below its smallest breakpoint (`direction="column" gap="2"`; E1809). A component reaching an effect takes `(props, ctx: Ctx)`, never optional, defaulted, destructured or followed by a parameter (E1407); one that reaches none is `(props)`. A view store starts from loader data by being created in the component with it as `initial` (`keel docs k.store`, View stores); `tx` runs in a handler, and one in a component body is E1304.

**Base and looks.** `tokens.ts` = `brandTokens` puts the brand on every page with no props: its `base` styles `body`, `Heading`, `Link`, `Button`, the controls, their labels and errors, the no-script summary and a 2px focus ring. Write style props only where a page differs; each replaces the base for its prop. A set used twice is a look: `look="secondary"` (`primary`, `secondary`, `control` ship), own props win per prop; add one as `{ ...brandTokens, look: { ...brandTokens.look, row: { direction: 'row', gap: '3' } } }`. A library's `<id>Tokens` spreads the same way, overrides after it (E1810, E1813). Dark mode: own colors as `{ light, dark }` or `schemes: ['light', 'dark']`; `<SchemeSelect id label labels={{ system, light, dark }} />` (E1814). A control's parts take `styles={{ label, error, field }}`.

**A11y.** `Heading level`, `Image alt` or `decorative`, and `label` on `Input`, `TextArea`, `Select`, `Checkbox` and on `Box as="nav"` are required (E1802). `Input` takes `autocomplete` (E1821). `Select options` is `{ value: string, label: string }[]`. A line a screen reader must hear is `Text role="status"` (`"alert"` for an error), there from the first render: `<Text id="done" role="status">{status.get()}</Text>`, `status` a signal that starts `''`; a status inserted with its text is E1826. Contrast is 4.5:1 (E1804): `keel check` judges it from `tokens.ts` where the text's `fg` and `bg` are literal in its component (a `fg` on a `Box` reaches its `Text`), `keel test` everywhere else; no reversed `direction` over focusable elements (E1820).

**Forms, routes, title.** `form(schema, { initial })` runs in a component; show `f.pending()` in an `<If>`. `Form` (`@keel/router`) takes `action` as an `Href` from `<contract>.href(id, params?, search?)`, its module's contract; `Link` (`@keel/ui`) takes it as `to`, never `href`. The page's binding holds its verbs: `POST: save`; client-only, the action still lives in `*.server.ts` and runs in the browser. `title` names the document, else the deployable's name does. An action answers `ok(href)` to navigate, `ok(null)` to reload the loaders, or `err({ code: 'keel.fields', data: { path: message } })` to set field errors (422); any other `err` goes to `Form`'s `error` render prop. `initial` is a partial value: leave a key out for an empty field (a `line` has no empty value, so `shop: ''` fails `tsc`). An action's args carry `routes`; `pageHref(routes, new URL(url).searchParams.get('next') ?? '')` (`@keel/router/match`) turns a guard's `next` into an `Href` or an `err`: `ok(back.ok ? back.value : null)`. With `identity.ts`, a `client` or shell page's guard gets `user` from one `GET /__keel/user` per document; the API still guards.
```ts
// modules/notes/notes.contract.ts imports schemas and packages only (E1514)
import { contract } from '@keel/router/contract'
export const notes = contract('notes', { 'notes.edit': { path: '/notes' } })
```
```tsx
import { form } from '@keel/forms'
import { Form, action, loader, manifest } from '@keel/router'
import { err, ok, s, type Infer } from '@keel/schema'
import { Box, Button, Heading, Input } from '@keel/ui'
import { notes } from './notes.contract.ts'

const NoteEdit = s.object({ address: s.object({ city: s.string({ min: 1 }) }) })
const Data = s.object({ title: s.string(), city: s.string(), save: s.string() })
export const Props = s.object({ data: Data })

export default function NoteEditPage(props: Infer<typeof Props>) {
  const f = form(NoteEdit, { initial: { address: { city: '' } } })
  return (
    <Box as="section" id="notes.edit">
      <Heading id="notes.edit.title" level={1}>{props.data.title}</Heading>
      <Form method="POST" action={notes.href('notes.edit')} form={f}>
        <Input field={f.field('address.city')} label={props.data.city} />
        <Button id="notes.save" type="submit">{props.data.save}</Button>
      </Form>
    </Box>
  )
}

const load = loader(notes, 'notes.edit', { output: Data }, async () => ok({ title: 'Note', city: 'City', save: 'Save' }))
const save = action(notes, 'notes.edit', { input: NoteEdit }, async (input) =>
  input.address.city === 'Oz' ? err({ code: 'keel.fields', message: 'Invalid', data: { 'address.city': 'Taken' } }) : ok(null))

export const routes = manifest(notes, {
  'notes.edit': { component: NoteEditPage, loader: load, POST: save, title: (p) => p.data.title },
})
```
- `f.field(path)` is a typed dotted path (E1902 if absent from the schema); a handle has `values()`, `errors()`, `pending()`. A base input given `field` binds itself (without it, in a `Form`: E1901).
- `action={mount.href(...)}` posts natively to an identity mount; a file there is E1583.

**Layouts.** A layout is a contract entry `{ layout: true }` whose binding's `component` renders `props.children()`; a page names it in its binding, `layout: 'app.frame'`, and the layout's loader and guard run first. One frame for every module (masthead, navigation, sign-out) lives in the module that lists the feature modules in `deps` (`modules/app`): it makes each link from that module's contract, and every feature page names the frame without listing `app`. A `layout` needs the two modules related by `deps` in either direction (E1152 when neither) and adds no `deps` edge.

**Widgets** (`@keel/std-headless`): `Listbox`, `Combobox`, `Menu`, `Tabs`, `Dialog`, `Disclosure`, `Toaster`. Write each as a JSX tag; a call `{Menu({...})}` renders nothing (E1406). Parts get ids `<id>.<part>`; every word a widget shows is a prop. Name it with exactly one of `label` or `labelledBy` (`Dialog` takes `title`). `Dialog`'s `trigger` is content only: the widget renders it inside its own button, so a `Button` there is E1703. Option, tab and toast keys are 1 to 64 of `[A-Za-z0-9_-]`, unique (E2801). Values live in your store, field or signal: read through a function, changed through `onChange` or `onSelect`. Style a part: `styles={{ option: { px: '3', states: { highlighted: { bg: 'accent' } } } }}`.

**Host** (`@keel/ui`): the one element whose node outside code (d3, a custom element) owns. `<Host id role="img" label={...} input={Schema} value={...} code={() => import("./chart.ts").then((m) => m.chart)} />`: `code` is exactly that arrow with a relative path and a named export, `input` is required (E1824 otherwise), and `label` or `labelledBy` names it (E1802). The file makes its export with `hostCode<I, E, S>({ mount(node, value, out) { return state }, update?, dispose? })`: `I` is the value type, `Infer<typeof Input>`, not the schema; `E` the events (`never` for none); `S` what `mount` returns. `out.emit(e)` reaches `onEvent` as a transaction. A `.css` import is allowed only in that file (E1825). In a library each id builds on the component's `id` prop, `` id={`${props.id}.chart`} `` (E1161). `keel docs k.host-element`, `k.host-code`, `k.library-pack`.

**Tables** (`@keel/std-tables`). `columns(Row, spec)` in a shared file (E2851 for a bad entry); the route's `search` is `tableSearch(cols)`; the loader returns `applyQuery(cols, rows, search, { pageSize, locale })` (E2853) shaped by `tablePage(Row)`. A `.pii()` column in `search` or `filter` is E2852. `boolean` and `value` columns need a `cells` entry. A wide table: `scroll="x"` wraps it, not its pager, in a named scroll region (`Box scroll="x"` takes one of `label` or `labelledBy`, E1802); align a number column with `styles={{ 'column.price': { textAlign: 'end' } }}` (`start`, `center`, `end` only, E1801; a key naming no shown column is E2851).
```ts
// modules/recipes/recipes.schema.ts
import { s } from '@keel/schema'
import { columns, tableSearch } from '@keel/std-tables'

export const Row = s.object({ id: s.string(), title: s.string(), favorite: s.boolean() })
export const cols = columns(Row, { key: 'id', show: ['title', 'favorite'], sort: ['title'], search: ['title'], filter: ['favorite'] })
export const Search = tableSearch(cols)
```
```ts
// modules/recipes/recipes.contract.ts
import { contract } from '@keel/router/contract'
import { Search } from './recipes.schema.ts'
export const recipes = contract('recipes', { 'recipes.list': { path: '/recipes', search: Search } })
```
```tsx
import { manifest } from '@keel/router'
import { type Infer, s } from '@keel/schema'
import { DataTable, TableSearch, tablePage } from '@keel/std-tables'
import { Box, Text } from '@keel/ui'
import { recipes } from './recipes.contract.ts'
import { Row, Search, cols } from './recipes.schema.ts'

const Table = s.object({ label: s.string(), pager: s.string(), previous: s.string(), next: s.string(), actions: s.string(),
  headers: s.object({ title: s.string(), favorite: s.string() }) })
export const Props = s.object({ search: Search, data: s.object({ page: tablePage(Row), t: Table }) })

export default function Recipes(props: Infer<typeof Props>) {
  const href = (q: Infer<typeof Search>) => recipes.href('recipes.list', {}, q)
  return (
    <Box id="r.page">
      <TableSearch id="r.search" label={props.data.t.label} search={props.search} href={href} />
      <DataTable id="r.table" label={props.data.t.label} columns={cols} search={props.search} href={href}
        locale="en-US" page={props.data.page} text={{ ...props.data.t, pageOf: (p, n) => `${p}/${n}` }}
        cells={{ favorite: (row) => <Text id={`r.fav.${row.id}`}>{row.favorite ? '★' : '☆'}</Text> }} />
    </Box>
  )
}

export const routes = manifest(recipes, { 'recipes.list': { component: Recipes } })
```

**Text.** In a module whose `deps` list `@keel/std-messages`, all copy comes from a message set, never a literal in JSX text, `label`, `placeholder`, `alt`, `title` or a route `title` (E2406). A set is keys and params in `*.schema.ts`, one file per locale (E2401):
```ts fragment
export const RecipesText = messages(AppLocale, { title: {}, count: { n: s.int({ min: 0 }) } },
  (locale) => import(`./RecipesText/${locale}.ts`))
// RecipesText/de-DE.ts
export default RecipesText.text({ title: 'Rezepte', count: { plural: 'n', one: '# Rezept', other: '# Rezepte' } })
// loader: ok({ text: await RecipesText.load(params.locale) })  // page: formatMessage(props.data.text.count, { n }, locale)
```
Format with `formatNumber` and `plural(n, locale, { one, other })` (`@keel/std-i18n`; every count line: `1 cost`, `2 costs`), `formatMoney` (`@keel/std-money`), `formatDate` and `formatDuration` (`@keel/std-temporal`), passing `props.params.locale`, a `Locale` such as `'en-US'`. `toLocaleString` is E1758, an `Intl` formatter with a locale E2301. A plural form applies where the locale selects its category or the number is its exact key: `{ plural: 'n', '=0': 'No receipts yet', one: '# receipt', other: '# receipts' }`; `zero`, or a category the file's locale never selects, is E2407 (fix: `zero` becomes `'=0'`). Money typed in a form is an `s.string()` field read in the action by `parseMoney(input.amount, input.currency, params.locale)` (`12,50 €` in `de-DE`; `12,50` in `en-US` is an error, never rounded), answering `keel.fields` from the error's `code`.
