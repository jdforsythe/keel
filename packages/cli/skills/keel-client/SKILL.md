---
name: keel-client
description: "Build Keel pages: components, routes on the page, forms (form, Form, field), widgets (Menu, Tabs, Dialog), data tables, message sets, locale formats, title, a11y; E1401, E1802, E19xx, E24xx, E28xx, E1583"
---

# Pages, forms, widgets, tables and text

Signatures: `keel docs <id>` for `k.component` `k.router` `k.forms` `k.head` `k.ui` `k.a11y` `std.headless` `std.options` `std.tables` `std.messages` `std.i18n`.

**Components.** One default export per file, named as the file; `export const Props = s.object(...)`. Props are getters: never destructure (E1401). Branch with `<If when>`, `<For each key>`, `<Match on>`; `{a && <b/>}` and `.map()` over elements are E1403. A top-level `const x = props.y` used in JSX is E1405: read `props.y` there. Give `id="area.name"` to what a test addresses (duplicates E1404). Style props take token names (`p="2"`; E1801).

**A11y.** `Heading level`, `Image alt` or `decorative`, and `label` on `Input`, `TextArea`, `Select`, `Checkbox` and on `Box as="nav"` are required (E1802). `Input` takes `autocomplete` (E1821). Text contrast is 4.5:1 (E1804); no reversed `direction` over focusable elements (E1820).

**Forms, routes, title.** `form(schema, { initial })` runs in a component; show `f.pending()` in an `<If>`. `Form` (`@keel/router`) takes `action` as an `Href` from `routes.href(id, params?, search?)`; `routes.actions` binds the route's `POST`. `title` on a path route names the document. An action answers `ok(href)` to navigate, `ok(null)` to reload the loaders, or `err({ code: 'keel.fields', data: { path: message } })` to set field errors (422); any other `err` shows in the `error` slot.
```tsx
import { form } from '@keel/forms'
import { Form, action, loader, manifest } from '@keel/router'
import { err, ok, s, type Infer } from '@keel/schema'
import { Box, Button, Heading, Input, Text } from '@keel/ui'

const NoteEdit = s.object({ address: s.object({ city: s.string({ min: 1 }) }) })
const Data = s.object({ text: s.object({ title: s.string(), city: s.string(), save: s.string() }) })
export const Props = s.object({ data: Data })

export default function NoteEditPage(props: Infer<typeof Props>) {
  const f = form(NoteEdit, { initial: { address: { city: '' } } })
  return (
    <Box as="section" id="notes.edit">
      <Heading id="notes.edit.title" level={1}>{props.data.text.title}</Heading>
      <Form method="POST" action={routes.href('notes.edit')} form={f} error={(e) => <Text>{e.message}</Text>}>
        <Input field={f.field('address.city')} label={props.data.text.city} />
        <Button id="notes.save" type="submit">{props.data.text.save}</Button>
      </Form>
    </Box>
  )
}

const load = loader({ output: Data }, async () => ok({ text: { title: 'Note', city: 'City', save: 'Save' } }))
const save = action({ input: NoteEdit }, async (input) =>
  input.address.city === 'Oz' ? err({ code: 'keel.fields', message: 'Invalid', data: { 'address.city': 'Taken' } }) : ok(null))

export const routes = manifest({ 'notes.edit': { path: '/notes', loader: load, component: NoteEditPage, title: (p) => p.data.text.title } })
routes.actions({ 'notes.edit': { POST: save } })
```
- `f.field(path)` is a typed dotted path (E1902 if absent from the schema); a handle has `values()`, `errors()`, `pending()`, `reset()`. A base input given `field` binds itself (without it, in a `Form`: E1901); a plain `input` calls `field.bind(el)`.
- Validation runs from the schema: on blur, then on each input once an error shows, all on submit; an invalid submit sends nothing and focuses the first invalid field.
- Without JS the server decodes the FormData (`schema.decodeStrings`) and re-renders with errors. `action={mount.href(...)}` posts natively to an identity mount; a file there is E1583.

**Widgets** (`@keel/std-headless`): `Listbox`, `Combobox`, `Menu`, `Tabs`, `Dialog`, `Disclosure`, `Toaster`. Write each as a JSX tag; a call `{Menu({...})}` binds as text and renders nothing (E1406). Parts get ids `<id>.<part>` (`m.trigger`, `m.item.a`). Every word a widget shows is a prop. Name it with exactly one of `label` or `labelledBy`. Option, tab and toast keys are 1 to 64 of `[A-Za-z0-9_-]`, unique (E2801). Values live in your store, field or signal: read through a function, changed through `onChange` or `onSelect`. Style a part: `styles={{ option: { px: '3', states: { highlighted: { bg: 'text' } } } }}`.

**Tables** (`@keel/std-tables`). `columns(Row, spec)` in a shared file (E2851 for a bad entry); the route's `search` is `tableSearch(cols)`; the loader returns `applyQuery(cols, rows, search, { pageSize, locale })` (E2853) shaped by `tablePage(Row)`. Sort, page and filter are links built by `href`, so they work without JS. A `.pii()` column in `search` or `filter` is E2852. `boolean` and `value` columns need a `cells` entry.
```tsx
import { manifest, navigate } from '@keel/router'
import { type Infer, s } from '@keel/schema'
import { Menu } from '@keel/std-headless'
import { Locale } from '@keel/std-i18n'
import { DataTable, TableSearch, columns, tablePage, tableSearch } from '@keel/std-tables'
import { Box, Text } from '@keel/ui'

const Row = s.object({ id: s.string(), title: s.string(), favorite: s.boolean() })
const cols = columns(Row, { key: 'id', show: ['title', 'favorite'], sort: ['title'], search: ['title'], filter: ['favorite'] })
const Search = tableSearch(cols)
const Params = s.object({ locale: Locale })
const Table = s.object({
  label: s.string(), pager: s.string(), previous: s.string(), next: s.string(), actions: s.string(), open: s.string(),
  headers: s.object({ title: s.string(), favorite: s.string() }),
})
export const Props = s.object({ params: Params, search: Search, data: s.object({ page: tablePage(Row), t: Table }) })

export default function Recipes(props: Infer<typeof Props>) {
  const { locale } = props.params
  const href = (q: Infer<typeof Search>) => routes.href('recipes', { locale }, q)
  return (
    <Box id="r.page">
      <TableSearch id="r.search" label={props.data.t.label} search={props.search} href={href} />
      <DataTable id="r.table" label={props.data.t.label} columns={cols} search={props.search} href={href}
        locale={locale} page={props.data.page} text={{ ...props.data.t, pageOf: (p, n) => `${p}/${n}` }}
        cells={{ favorite: (row) => <Text id={`r.fav.${row.id}`}>{row.favorite ? '★' : '☆'}</Text> }}
        actions={(row) => (
          <Menu id={`r.menu.${row.id}`} trigger={() => row.title} items={() => [{ key: 'open', text: props.data.t.open }]}
            onSelect={() => void navigate(routes.href('recipes', { locale }, { q: row.title }))} />
        )} />
    </Box>
  )
}

export const routes = manifest({ recipes: { path: '/:locale/recipes', params: Params, search: Search, component: Recipes } })
```

**Text.** All copy comes from a message set, never a literal in JSX text, `label`, `placeholder`, `alt`, `title` or a route `title` (E2406). A set is keys and params in `*.schema.ts`, one file per locale (E2401):
```ts fragment
import { s } from '@keel/schema'
import { messages, formatMessage } from '@keel/std-messages'
export const RecipesText = messages(AppLocale, { title: {}, count: { n: s.int({ min: 0 }) } },
  (locale) => import(`./RecipesText/${locale}.ts`))
// RecipesText/de-DE.ts
export default RecipesText.text({ title: 'Rezepte', count: { plural: 'n', one: '# Rezept', other: '# Rezepte' } })
// loader: ok({ text: await RecipesText.load(params.locale) })
// page: formatMessage(props.data.text.count, { n }, props.params.locale)
```
A key without params is a string. Format with `formatNumber`, `formatMoney`, `formatDate`, `formatDuration` and `plural(n, locale, { one, other })`, passing `props.params.locale`. `toLocaleString` is E1758, an `Intl` formatter with a locale E2301.

**Test.** `renderRoute`, `fire(id, { type: 'input', value })`, `find(id).state`, `focusOrder()`; it runs the a11y checks. See skill keel-testing.
