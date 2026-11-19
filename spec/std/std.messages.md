# std.messages: Message sets
status: conformance-covered

**Extension points.** Schema type registry (k.formats `s.format`; message types are not registered, each depends on its key's params). Check rule registry (k.check `defineRule`): `@keel/std-messages/tools`, which `keel check` imports for a module whose `deps` list the package, registers E2401 to E2406. It depends on `@keel/std-i18n` for `Locale`, `formatNumber` and `plural`.

**API** (`@keel/std-messages`; client-safe, no config).
```ts
// RecipesText.schema.ts: keys and params, declared once
export const RecipesText = messages(AppLocale, { title: {}, count: { n: s.int({ min: 0 }) } },
  (locale) => import(`./RecipesText/${locale}.ts`))
// RecipesText/de-DE.ts: one file per locale
export default RecipesText.text({ title: 'Rezepte', count: { plural: 'n', one: '# Rezept', other: '# Rezepte' } })
// loadIndex.server.ts
return ok({ recipes, text: await RecipesText.load(params.locale) })
// RecipeList.tsx
<Heading id="recipes.list.title" level={1}>{props.data.text.title}</Heading>
<Text id="recipes.count">{formatMessage(props.data.text.count, { n }, props.params.locale)}</Text>
```
- `messages(locales, keys, load)` declares a message set in a `*.schema.ts` file. `locales` is the app's `s.enum` of `Locale` tags. `keys` maps each key (an identifier) to its params: schemas that are `s.string()`, a `line` or `para`, `s.int()`, `s.number()` or `s.enum()`; any other throws. `load` is ``(locale) => import(`./<Set>/${locale}.ts`)``, `<Set>` the export's name. The set is a closed object schema of one locale's entry, with `text` and `load`.
- An entry gives every key a message. A key without params takes text: 1 to 2,000 characters, one outside `White_Space`, with no `{` or `}`. A key with params takes an object: `{ text }`, one template; `{ plural: p, other, zero?, one?, two?, few?, many? }`, templates chosen by the number param `p`; or `{ select: p, cases }`, a template for each value of the enum param `p`. A template writes a param as `{name}`, a name its key declares; in a plural form `#` is `p`. Each message is a format type (rule `format` when it breaks this), so `parse`, `gen` and `doc()` derive from the set.
- `Set.text(entry)` returns `entry` typed as the set's entry; it is a locale file's default export. `Set.load(locale): Promise<Entry>` imports that locale's file through `load` and parses its default export with the set; a failing entry throws (unexpected).
- `formatMessage(message, params, locale): string` renders an object message, `params` typed by its key: `{name}` becomes the param, a number through `formatNumber`; `plural` goes through `plural` (std.i18n) with `params[p]`; `select` takes `cases[params[p]]`. A text message is a string and renders as itself; an object is not a `Child` (k.ui), so an object message renders only through `formatMessage`.
- Text reaches a component as loader data: a loader returns `await Set.load(params.locale)` in its output (the set is a schema) and the component reads `props.data`. A route level with no island ships no message; an island level ships the one entry in its props in `#k-state` (k.runtime), and resume keeps the server's text. In a `client` deployable `load` fetches only the active locale's file, a chunk of its own. A test pins text through `renderRoute` `params`, or passes `await Set.load(l)` in `render` props; a session replays the `nav` and its loaders.

**Rules** (in a module whose `deps` list `@keel/std-messages`). E2401 a locale of the set without `<Set>/<locale>.ts`, or `load` not that exact import (fix: the exact `load`, for the `load` form only; a missing locale file reports E2401 with no fix, because a rule's fix edits only the checked file) · E2402 a locale file without a declared key (no fix: a translation cannot be derived) · E2403 a locale file key the set does not declare (fix: removes it) · E2404 a declared key no other project file reads as `.<key>` (fix: removes it from the declaration) · E2405 a template's `{name}`, `plural` or `select` that does not match its key's params (fix: renames the placeholder when exactly one declared param is absent from that template) · E2406 a JSX text child, a string literal `label` or `alt`, or a string literal a route `title` returns (k.head), containing a letter, in a component or `routes.ts` file (no fix).

**Conformance.**
- For a fixture set with keys `title` (no params), `count` (`n: s.int()`) and `kind` (`k: s.enum(['a', 'b'])`), every `gen` entry parses and round-trips; `title: 'a{b'`, a template naming `{x}`, a `plural` on `k` and a `select` without case `b` each fail with rule `format` at the key's path; a missing key fails with `required`, an extra one with `unknown-key`.
- `messages` throws for a param schema `s.object({})`.
- `formatMessage({ plural: 'n', one: '# recipe', other: '# recipes' }, { n: 2 }, 'en-US')` is `2 recipes`; `{ text: 'Added {date}' }` with `{ date: 'November 10, 2026' }` is `Added November 10, 2026`; `{ text: '{n} items' }` with `{ n: 1234 }` in `de-DE` is `1.234 items`; a `select` gives the case of the param's value.
- For every generated entry and params, `formatMessage` of each object message returns a string with no `{`.
- `Set.load('de-DE')` resolves to the fixture's `de-DE` entry; for a locale file failing the set it rejects.
- A `client` build of a fixture route whose loader loads a set holds each locale's entry in its own chunk, and no other chunk holds an entry's text.
- A node document holds a static level's message text and no `#k-state` entry for it; an island level's `#k-state` holds the served locale's entry and no other locale's text.
- E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401 (`load` form), E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code.
- The package root imports neither `@keel/check` nor `typescript`; `@keel/std-messages/tools` exports the six rules.
