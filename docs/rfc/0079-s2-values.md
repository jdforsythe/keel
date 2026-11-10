# RFC 0079: S2 Values: locales, money, dates, text and message sets

Status: draft (2026-11-10). Stage design RFC for S2 (`tasks/PROGRAM.md`, task 0307). User decisions it builds on: message catalogs are in S2 (D2), golden-2 is migrated and its eval updated (D3), every k.ui base element takes `lang` (D4), the locale is a path param `/:locale/...` (D5), and a served locale may be declared as an unprefixed default (user request, 2026-11-10). It applies WORKFLOW RFC defaults 1 (each kernel gap gets a kernel change: K1 to K6), 2 (`formatMoney(m)` is replaced, not doubled; one way to show each value), 3 (the rules run in the existing check pipeline, messages travel as loader data, the exit proof extends the existing golden-2 eval), 4 and 5 (nothing new leaves the browser; a message reaches the client only inside an island's loader data), 6 (E1106, E1509, E1758, E2301 and E2401 to E2406 enforce what prose would otherwise ask for) and 7 (`@keel/check` and `@keel/router` size budgets are re-based; no threshold is lowered). The Open questions are the new hand-written API shapes the defaults escalate; the batch proceeds on each recommendation unless the user says otherwise.

## Problem
S2 must show golden-2's prices, dates and page copy in three locales, proven by an eval. Keel has one value package, `@keel/std-money`, whose only display function, `formatMoney(m)`, writes `12.50 EUR` for everyone. Nothing says where a locale comes from, and these kernel gaps block any locale-aware value:

1. **No validated string types.** k.schema cannot say "a calendar date", "a UTC instant" or "a line of at most 80 graphemes". `s.string({ max })` counts UTF-16 units, so 40 flag emoji fill an 80-character title, and nothing refuses a bidi override (U+202E). A message template whose `{name}` is not a declared param parses as any string.
2. **Ambient locale and time zone pass the checker.** E1601 catches `Date.now()`, but `price.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)` (the host's zone), `navigator.language` and `new Date(ms).getHours()` all check clean. Each gives a server in UTC and a browser in Tokyo two strings for one value (principle 10).
3. **No way to mark the language of a part.** k.ui base elements take no `lang` (WCAG 3.1.2).
4. **Guard redirects drop params.** `runGuards` redirects to `routes.href(g.redirect)` with no params. Under `/:locale`, a denied guest lands on a route whose param is missing.
5. **Adding a locale moves every URL.** With `/:locale` on every route, an app that served one language at `/recipes` must move it to `/en-US/recipes` when it adds a second.
6. **Form messages are fixed English.** `messageFor` in forms and router writes `Required` on a German page, and has no case for a new rule.

`createApp` shares one `ctx` across requests (k.server), so a locale cannot live on `ctx`; loaders see `params`, `search`, `url` and `caller`, never headers. Platform facts, measured on Node 22.23.1 (ICU 78.2) and Node 24.19.0 (ICU 78.3), both CLDR 48.0: no `Temporal` global; `Intl.DurationFormat` exists on 24 and not on 22, which CI runs; `Intl.NumberFormat` formats exact decimal strings; `Intl.Segmenter`, `Intl.ListFormat`, `Intl.PluralRules`, `Intl.Collator` and `Intl.DisplayNames` exist on both. Both give identical strings for every literal in this RFC's conformance clauses and eval table.

## Proposal

### 1. The locale is route data
An app declares the locales it serves once, as an `s.enum` of `i18n.Locale` tags in a `*.schema.ts` file. A route that shows text for a person has the path `/:locale/...` and a params field `locale` of that enum. From there the locale is an explicit argument everywhere; nothing reads it from anywhere else.

- **Component.** A route or layout component reads `props.params.locale` (layouts get the matched route's `params`) and passes it as a prop to any child that formats. Every formatter takes it as an argument: `formatMoney(price, locale)`, `formatDate(day, locale, 'long')`, `formatMessage(text.count, { n }, locale)`. The shell's root `Box` carries `lang={locale}` (K3), so the whole page region is marked.
- **Server.** The router parses `locale` with the route's params schema; a locale the app does not serve is a 404 before any loader runs. Text is formatted with the server's `Intl` and lands in the document.
- **Resume.** `#k-state` carries the served `route.params`; resume does not re-render text (k.runtime), so the server's strings stay. An island that re-renders a value calls the same pure function with the same locale.
- **Tests and replay.** `renderRoute(id, { params: { locale: 'de-DE', ... } })` and `render(C, { props })` pin it; a session's `nav` event carries `params`. Nothing ambient needs a stub.
- **Time zone.** Also explicit. A date that belongs to a calendar day is a `PlainDate` and needs no zone to display; an `Instant` is shown with `formatInstant(i, locale, zone, style)`, where `zone` is data the app holds.
- **Links.** `routes.href('recipes.show', { locale, recipeId })` does not compile without `locale`. A locale switcher is a set of `Link`s to a route in each locale, labeled `localeName(tag)` with `lang={tag}`.

**Unprefixed default (K6).** An app may mark one served locale as the default whose URLs carry no prefix: `s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })`. Only the URL codec changes. `params.locale` stays present and typed as the enum in loaders, actions, guards and components; every typed link still passes a locale, so omitting one is still a compile error and an unknown one is still rejected. `routes.href` leaves the default's segment out (`/recipes`); a URL with no locale segment parses as the default; `/de-DE/recipes` parses as `de-DE`. The prefixed default `/en-US/recipes` answers 308 to `/recipes`: each page keeps one URL (principle 1), and the redirect is the router's existing answer to a non-canonical form (a trailing slash already gets 308), so old links and hand-typed URLs still land (default 3). A 404 there would also keep one URL but break a link someone pasted from a prefixed era. Without the opt-in, every URL carries the prefix, which is the safe default: a static first segment can never be read as a locale. The declaration sits on the enum because that is where the served locales are declared (principle 4), and it is read from the route's own params schema, so nothing outside the route's files changes how it matches (principle 2). Collisions are E1509 with a fix (Spec diff, k.prefix). The match order:

1. A first segment equal to a served locale other than the default: the rest matches the prefixed routes with that locale.
2. A first segment equal to the default: 308 to the path without it, search kept.
3. Anything else: the whole path matches unprefixed routes and prefixed routes with the default locale; static beats `:param` as today.

**Scaffold.** The scaffold `project` template should be born with `AppLocale = s.enum(['en-US'], { pathDefault: 'en-US' })` and its routes under `/:locale`, so a one-locale app's URLs carry no prefix and adding a locale is one enum member plus one locale file per message set. Every link of a new app then passes a locale from day one, which is the cost. This is a k.scaffold change with its own conformance and template tests, so it is a task after this batch (Open question 1), not a lane here.

### 2. Kernel changes
Each is the smallest change that closes its gap; ADRs are listed below. Exact text is in Spec diff.

- **K1, k.schema: format types.** `s.format(name, base, { check, gen: { from, map } })` narrows a schema by a pure predicate. `parse` runs `base`, then `check`; a refusal is the new rule `format`. The type is `Format<T, name>`, `base`'s type branded `name`. `encode`, `decodeStrings` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `doc()` is the name; `gen` maps `gen(from)` through `map`, so a stdlib package ships a generator without importing fast-check, and every generator still derives from a schema (principle 4). The node is `{ kind: 'format', name, base }`, with `check` and `gen` held beside it in memory, so nodes stay JSON and TypeScript's exhaustiveness check finds every walker that must handle the new kind. E1106 keeps `s.format` out of app code: an app-written predicate brings a generator no one tests, and apps get dates, text and messages from the stdlib (principle 1). `s.enum(values, { pathDefault })` is the K6 declaration; parse, encode and gen ignore it.
- **K2, k.check: E1758 ambient locale or time zone.** A source rule beside E1757, resolving names as E1601 does. It is its own code because its fix is an argument, not a `ctx` call (principle 5: one diagnostic, one kind of fix).
- **K3, k.ui: `lang` on every base element** (D4), a string written as the `lang` attribute.
- **K4, k.router: guard redirects carry params.** The redirect fills its route's params from the matched route's params of the same name; a `redirect` param the matched route lacks is E1508 at runtime, beside the redirect loop it already reports. The gap is any guard on a parameterized route, `/:org/...` as much as `/:locale/...` (default 1). With K6 the carried value is the typed locale and the codec writes the URL, so a guest denied at `/recipes/new` lands on `/` and one denied at `/de-DE/recipes/new` lands on `/de-DE`.
- **K5, k.forms: `issueText`.** `form(schema, { initial?, id?, issueText? })`. `issueText(issue)` gives a field's error text for a `FieldIssue` `{ rule, path, min?, max?, values?, format? }`; without it the kernel's English text applies, with `Invalid value` for rule `format`. An app passes a function over its message entry and locale, so the form's text is translated with the rest of the page and the kernel stays free of translations.
- **K6, k.prefix: implied path prefix.** A new kernel section, because k.router is at 1,496 tokens after K4 and the mechanism needs about 880. k.router's Matching paragraph points to it in one clause. Its code is E1509 in the k.router block, since every kernel block is assigned.

No change to k.ctx, k.server's spec text, k.runtime, k.module, k.compiler or k.testing. The implementation of K4 and K6 touches `packages/server` (guard redirect, 308) and `packages/testing` (the harness's guard path) without changing their sections.

### 3. Package contracts
Every package here is client-safe, takes no `std` config and ships one export per file. Each formats its own values; `@keel/std-i18n` is the small base the others import. Dependency order in `tooling/deps.json`: `std-i18n` and `std-money` move ahead of the wave-0 packages (std-money now imports std-i18n), then `std-temporal`, `std-text`, `std-messages` after `std-sessions`. Diagnostic blocks: E230x std.i18n, E240x std.messages. Packages without diagnostics get no block, as std.money and std.geo have none today; E22xx and E29xx stay unassigned because `packages/check` tests use E2234 and E29xx as fixture codes.

| Package | Purpose | Registers | Rules | Platform APIs | Size (gzip) |
| --- | --- | --- | --- | --- | --- |
| `@keel/std-i18n` | The locale as a value; numbers, plurals, locale names | `i18n.Locale` | E2301 (`./tools`) | `Intl.NumberFormat`, `PluralRules`, `DisplayNames` | 0.7 kB; `./tools` 3 kB node |
| `@keel/std-money` | Amounts in minor units, added exactly, shown for a locale | `money.Money`, `money.Currency` | none | `Intl.NumberFormat` (exact decimal strings) | 0.7 kB |
| `@keel/std-temporal` | Instants, calendar dates, zones and durations as ISO strings, shown for a locale | `temporal.Instant`, `PlainDate`, `TimeZone`, `Duration` | none | `Intl.DateTimeFormat`, `NumberFormat` units, `ListFormat`, `Date` UTC methods | 2 kB |
| `@keel/std-text` | Text a person types and reads: bounded by graphemes, free of control and bidi characters, sorted by locale | `text.Email`, `text.Slug` | none | `Intl.Segmenter`, `Intl.Collator` | 1 kB |
| `@keel/std-messages` | Message sets: declared keys and params, one file per locale, loaded per route | none | E2401 to E2406 (`./tools`) | none | 1.2 kB; `./tools` 5 kB node |

**std-i18n.** `Locale` is a closed enum of 11 left-to-right tags whose CLDR data ships in every supported runtime (principle 4: a closed vocabulary; parse is the same on every engine). `formatNumber`, `plural` and `localeName` take the locale as an argument. `plural` is the one plural path: std-messages calls it, and `#` becomes `formatNumber(n, locale)`. E2301 asks a module that lists the package to call the stdlib formatter instead of building an `Intl` formatter itself, which is how a float path such as `new Intl.NumberFormat(l, { style: 'currency' }).format(m.amount / 100)` stays out (default 2).

**std-money.** `formatMoney(m)` becomes `formatMoney(m, locale)`: `Intl.NumberFormat` currency style over the exact decimal string of the amount. The machine form of a `Money` stays `Money.encode`.

**std-temporal.** Values are canonical ISO strings branded by type, so they serialize as themselves, compare with `<`, read well in logs and sessions, and equal what `<input type="date">` gives. No export reads the clock: the current instant is `instantOf(ctx.clock.now())`, which keeps `clock` visible to E1156 in the module that asks. Calendar math uses `Date.UTC` and the `getUTC*` methods; formatting uses `Intl`. `formatDuration` is built from `Intl.NumberFormat` unit style and `Intl.ListFormat`, because Node 22 has no `Intl.DurationFormat`; its strings match on Node 22 and 24. Moving onto `Temporal` later changes no API, since the types are strings.

**std-text.** `line` and `para` are format types named by their bounds, so a title of 80 is not assignable to a field of 120 without a check. `compareText` takes a locale; `truncate` cuts on grapheme boundaries.

### 4. Message sets
`@keel/std-messages` holds the translated page text. Its section is std.messages; the summary:

1. **Declaration.** A module declares each message set once in `<Set>.schema.ts`: ``messages(AppLocale, keys, (locale) => import(`./<Set>/${locale}.ts`))``. `keys` is the closed key vocabulary, each with typed params (`s.string`, `line`, `s.int`, `s.number`, `s.enum`). The set is a schema of one locale's entry, so parse, gen and doc derive from it (principle 4).
2. **Files.** One file per locale, `<Set>/<locale>.ts`, default-exporting `Set.text({...})`. A key without params is a string; one with params is `{ text }`, `{ plural: p, ... }` or `{ select: p, cases }`. Adding a locale is one enum member and one file per set.
3. **Getting a message.** A loader returns `await Set.load(params.locale)` in its data; the component reads `props.data.text.title` (a string) or calls `formatMessage(props.data.text.count, { n }, props.params.locale)`. An object message is not a `Child`, so it cannot render unformatted. There is no provider, hook or ambient locale (principle 2).
4. **What ships.** Messages are server-only by default (default 5): a static route level renders text into the document and ships nothing; an island level ships the one entry in its loader data inside `#k-state`, and resume keeps the server's text. A `client` deployable's loader runs in the browser, and `load`'s dynamic import makes each locale file its own chunk, so only the active locale is fetched.
5. **Checker.** E2401 a missing locale file or a malformed `load` (fix) · E2402 a missing translation (no fix: a translation cannot be derived, and copying another locale's text would ship the wrong language) · E2403 an undeclared key in a locale file (fix) · E2404 an unused key (fix) · E2405 a placeholder, `plural` or `select` that does not match the params (fix when the rename is unambiguous) · E2406 literal copy in a component file of a module that lists the package (no fix). A key read in code but not declared is a TypeScript error on the property (E1751), since the entry type is exact.

Plurals go through std-i18n `plural`; numbers inside messages through `formatNumber`; a date or price param is passed already formatted (`{ date: formatDate(d, locale, 'long') }`), so each value type keeps one formatter. No check rule registry gap exists: the stdlib rules run in the existing pipeline (default 3), and the kernel changes the sets need are K1 (format types) and K5 (form text).

**Per-route `<title>` and `<html lang>`.** Both are page text and page language, and both fit this design without changing it: a route's title is a message read from its loader data, and its document language is `params.locale`. Writing them needs a new field on the route definition (for example `title: (props) => props.data.text.pageTitle`) and a k.server head change, both sections at the token cap, so it is Open question 4. In S2 the `<title>` stays the deployable's name (k.server) or the `index.html` title (a `client` deployable), `<html lang>` stays the template's, and the shell's `lang` marks the page content.

### 5. Exit proof and golden-2
The proof extends the existing `evals/tasks/golden-2` task (default 3): TASK.md gains the values, the locales and the copy, and the hidden `acceptance.test.ts` gains the assertions below, so `pnpm eval --task golden-2 --runner none --strict` is the exit proof and an agent build from scratch is held to the same bar.

**Fixture.** The api runs on a sim ctx with `clock.advance(1794303000000)` (2026-11-10T09:30:00.000Z). Two recipes are posted: "Pasta bake" (30 minutes, `{ amount: 1250, currency: 'EUR' }`) and "Miso soup" (90 minutes, `{ amount: 1800, currency: 'JPY' }`); Pasta bake is made a favorite. Both get `addedOn` `2026-11-10`.

**Locales.** `en-US` (the unprefixed default), `de-DE` and `ja-JP`: two Latin-script locales with opposite separators and currency placement, and one CJK locale with year-first dates and a full-width yen.

**Strings.** For each locale `L`, `renderRoute` of `recipes.index`, `recipes.show` (Miso soup) and `recipes.new` with `params.locale` `L` shows (`␣` is U+00A0):

| Element | en-US | de-DE | ja-JP |
| --- | --- | --- | --- |
| `recipes.home` | `Recipes` | `Rezepte` | `レシピ` |
| `recipes.newLink` | `New recipe` | `Neues Rezept` | `新しいレシピ` |
| `recipes.list.title` | `Recipes` | `Rezepte` | `レシピ` |
| `recipes.filter.favorites` | `Favorites` | `Favoriten` | `お気に入り` |
| `recipes.count` (all, then favorites) | `2 recipes`, `1 recipe` | `2 Rezepte`, `1 Rezept` | `2 件のレシピ`, `1 件のレシピ` |
| `recipes.price.<pasta>` | `€12.50` | `12,50␣€` | `€12.50` |
| `recipes.price.<soup>` | `¥1,800` | `1.800␣¥` | `￥1,800` |
| `recipes.added.<id>` | `November 10, 2026` | `10. November 2026` | `2026年11月10日` |
| `recipes.minutes.<pasta>` | `30 min` | `30 Min.` | `30 分` |
| `recipes.minutes.<soup>` | `1 hr, 30 min` | `1 Std., 30 Min.` | `1 時間 30 分` |
| `recipes.favorite` | `Not favorite` | `Kein Favorit` | `お気に入りではありません` |
| `recipes.toggleFavorite` | `Toggle favorite` | `Favorit umschalten` | `お気に入りを切り替え` |
| `recipes.addedOn` | `Added November 10, 2026` | `Hinzugefügt am 10. November 2026` | `2026年11月10日に追加` |
| `recipes.draft:title:error`, empty title | `1 to 80 characters on one line` | `1 bis 80 Zeichen in einer Zeile` | `1〜80文字で、1行で入力してください` |
| `recipes.draft:title:error`, duplicate | `Already in the box` | `Schon in der Sammlung` | `すでに登録されています` |

The eval also asserts:
- `recipes.shell` has `lang` equal to `L`, and the switcher Links `recipes.locale.en-US`, `recipes.locale.de-DE`, `recipes.locale.ja-JP` read `English (United States)`, `Deutsch (Deutschland)`, `日本語 (日本)`, each with its own `lang`, linking to `/`, `/de-DE` and `/ja-JP`;
- `routes.href('recipes.show', { locale, recipeId })` is `/recipes/<id>` for `en-US` and `/de-DE/recipes/<id>` for `de-DE`;
- for 20 generated `Money` values posted through the api, the index text equals `formatMoney(m, L)`;
- a guest at `recipes.new` is redirected to `recipes.index` with the same `locale` (K4), at `/` for `en-US` and `/de-DE` for `de-DE`;
- with the `recipes` module served by a `node` test topology (as `test/ssrNode.test.ts` does): the documents for `/`, `/de-DE` and `/ja-JP/recipes/<id>` hold the table's strings in those element ids; `/en-US` answers 308 to `/` and `/en-US/recipes/<id>` to `/recipes/<id>`; `/fr-FR` is 404; the `#k-state` of `/de-DE/recipes/<id>` (an island: its Form) contains `Favorit umschalten` and neither `Toggle favorite` nor `お気に入りを切り替え`.

**golden-2 changes.**
- `package.json` and `recipes/module.ts` list `@keel/std-i18n`, `@keel/std-money`, `@keel/std-temporal`, `@keel/std-text`, `@keel/std-messages`; `kitchen/module.ts` lists the value packages it uses and capability `clock`.
- New in `recipes`: `AppLocale.schema.ts` (`s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })`), `LocaleParams.schema.ts`, `RecipesText.schema.ts` and `RecipesText/{en-US,de-DE,ja-JP}.ts` (every string the screens show, including the `Keel` mark text and the tagline, so E2406 is clean), `fieldText.ts` (the `issueText` over the entry and locale), `loadShell.server.ts` and `loadNew.server.ts` (each returns `{ text }`; the shell's loader parses `params` with `LocaleParams`, since a layout declares no params).
- Routes: `recipes.index` `/:locale`, `recipes.new` `/:locale/recipes/new`, `recipes.show` `/:locale/recipes/:recipeId`; `RecipeParams` gains `locale`. With the unprefixed default, every existing en-US URL (`/`, `/recipes/new`, `/recipes/<id>`) keeps working.
- `Recipe` gains `price: Money` and `addedOn: PlainDate`; `RecipeDraft` gains `price: Money`; `title` becomes `line({ max: 80 })` in `Recipe`, `RecipeDraft` and `kitchen/NewRecipe`. `postRecipe` mints `addedOn` as `plainDateOf` of `instantOf(ctx.clock.now())`'s value in `UTC`, returning its `err` when out of range.
- `BoxShell` reads its text and locale, sets `lang` on its root, and shows the switcher. `RecipeList` shows the count, price, date and duration; `RecipePage` shows price and `addedOn`; `NewRecipePage` adds a number `Input` bound to `price.amount` and a `Select` bound to `price.currency`, and passes `issueText`. `RecipeError` shows the error's message as its heading, since an `errorElement` gets no params (Known limits); `loadRecipe`'s `keel.notFound` message comes from the entry.
- `createRecipe` replaces the api's `keel.fields` `title` message with the entry's `titleTaken` in the route's locale: the api stays language-neutral, and the web, which knows the locale, owns the copy.
- Tests and README follow the routes; `.api.storage*` (git-ignored dev data) is deleted, since stored recipes lack the new fields.

## Alternatives
- **`?locale=` search key** (draft B). No path moves, but search keys are optional by rule (E1504), so a link that omits it falls back to the default without a compile error, and the key must be threaded by hand through guard redirects and form actions. D5 chose the path param; K6 keeps the unprefixed URLs that were the search key's main benefit.
- **An `i18n(ctx)` capability with browser languages, time zone and `negotiate`** (draft B). The same URL would render differently per browser, a server would see `[]` and `UTC` while the client sees the user's settings, and tests and replay would pin the locale apart from the URL (principles 2, 3, 10). With the locale in the path nothing needs negotiating; `Accept-Language` waits until loaders see headers.
- **E1601 widened in k.ctx for locale reads** (draft B). E1601's fix is the `ctx` equivalent, and a locale has none: the fix is an argument. k.ctx has 11 tokens of headroom against k.check's 96, and both live in `packages/check`, so the size cost is the same either way.
- **`s.refine` and `Refined<T, N>`** (draft B). Same mechanics, kept here; the name `format` matches the rule and the JSON Schema keyword, so one word runs from API to diagnostic. Its generator mapping `{ from, map }` won over draft A's `gen(fc)`, which put fast-check types in every stdlib package.
- **App-written format types** (no E1106). Every app predicate would bring a generator no one tests, and property tests built on it would trust it.
- **`formatMoney` moved to std-i18n, with `toDecimal(m)` in std-money** (draft B). std-i18n would import every value package and grow with each new one; keeping each formatter beside its type lets a new value package add its own (principle 3). `toDecimal` has no S2 consumer; `Money.encode` is the machine form.
- **std-i18n as the home of every formatter, with locale-free std-temporal and std-text** (draft B). Same reason as above.
- **`PlainTime`, `inZone`, `addDuration`, `between`, `fold`, `negotiate`** (draft B). No S2 consumer; each can be added by a later RFC without changing these signatures.
- **A separate `golden-2-locales` eval** (draft B). Two evals for one app; extending golden-2 holds the agent-build eval to the S2 bar as well (default 3).
- **`Intl.DurationFormat`.** Absent on Node 22, which CI runs.
- **A k.ui formatting hook** (a text op that formats any registered type for the current locale). It needs an ambient locale (principle 2) and is a second way to show a value (principle 1).
- **Shipping CLDR data**, or a **`Temporal` polyfill**. 3 to 5 kB per locale with an update duty per CLDR release, or over 20 kB gzip in every bundle that shows a date.
- **All locales in one message file per set.** One edit per key, but a `client` deployable would ship every locale, and per-locale chunks would need a k.compiler transform in a section with no token headroom.
- **ICU MessageFormat strings.** A parser of 5 to 10 kB and a second string language TypeScript cannot check; plain templates plus `plural` and `select` objects cover S2.
- **Messages imported directly by components.** Every locale would ship in every island bundle, and the text would not be loader data that tests and replay already pin.
- **A context provider or a request-scoped store for the locale.** Action at a distance (principle 2); a store read makes every formatted value an island.
- **Form messages carried by each format type** (draft A's `message`). English only; `issueText` translates every rule, `format` among them.
- **The prefixed default answering 404.** Keeps one URL too, but breaks links made before the opt-in; the router already redirects a trailing slash.
- **`pathDefault` as a manifest option** (`manifest(routes, { prefix })`). Declared once per module, so two modules could disagree, and away from where the locales are declared (principle 4).
- **Splitting k.router for K6.** Moving clauses would change the quoted header of every moved conformance file; a new section changes none.
- **Reserving diagnostic blocks for packages with no rules** (both drafts). Map tokens spent on nothing (principle 12).

## Spec diff
Token counts are `ceil(length / 4)`, the rule `tooling/budgets.mjs` uses, measured by applying these edits to copies of the sections. Appended clauses keep every existing clause number; k.router clause 5 and std.money clause 7 change in place. Trims remove citations and restatements only, which CLAUDE.md rule 11 asks for anyway.

### k.schema (1,239 to 1,474)
- Primitives: `enum` becomes "`enum` (`{ pathDefault }`: the value a leading path param leaves out of the URL, k.prefix)".
- After the Primitives paragraph, a new paragraph:
  "**Format types.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false) and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; false fails with rule `format` at that path. `encode`, `decodeStrings` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name."
- `Rule` list: after `secret-missing` add "· `format` (a format type's `check` refused the value)".
- Rules: append "· E1106 `s.format` in app code (format types are stdlib's)".
- Conformance, appended: "For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106."
- Trims: the five `rfc:` citations.

### k.check (1,404 to 1,499)
- Rules: after E1757 add "· E1758 ambient locale or time zone in app code: `navigator.language` or `languages`; an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale; an `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`; a local-time getter (`getHours`, ...) on a `new Date(...)` expression. Names resolve as for E1601; no fix."
- Conformance, appended: "`n.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(0).getHours()` are each one E1758; `a.localeCompare(b, 'de-DE')` and `new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC' })` none."
- Trims: the citations `rfc:0023`, `rfc:0070`, `rfc:0065`; "are `keel test`, k.testing" becomes "are k.testing"; the Budgets sentence "In the Keel repo: ... spec map <= 1,200." (`tooling/budgets.json` holds the numbers and a conformance clause holds the first); the Registry example's `explain` becomes `'Amounts are Money values, not numbers.'` (it named an `s.money()` that does not exist). No conformance clause changes.
- k.check is then at its cap: the next change to it needs a split.

### k.ui (1,499 to 1,497)
- Base elements, before "`Box as` and `Text as` take closed sets": "Every base element takes `lang`, a string written as its `lang` attribute."
- Conformance, appended: "A base element given `lang="ja-JP"` has `lang="ja-JP"` in server and client output; without it, none."
- Trims: "(RFC 0009)", "rfc:0062", "(rfc:0064)", "rfc:0067", "(rfc:0043)", "(k.compiler URL policy)", "(`check`)" after E1801; the `disabled` rationale becomes ", so `disabled` stays the boolean attribute."; the tokens example drops `space 0`, `radius` and `font` (no clause reads them). No conformance clause changes.

### k.router (1,498 to 1,496)
- Matching: "static beats `:param`; no wildcards." gains "; k.prefix elides a leading param."
- Guards: "on `err` the request redirects to `redirect` with search `{ next: url }`" becomes "on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }`".
- Rules: E1508's "or (runtime) a guard redirect loop." becomes "or (runtime) a guard redirect loop or a missing `redirect` param."
- Conformance clause 5, in place: "A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params (one missing: E1508); no loader or route component runs."
- Trims: the example's `search: OrderSearch` and `errorElement: OrderError` (the text describes both); "a statement after the manifest,"; "(client navigation fetches results)"; Artifacts becomes "In `routes.json` (k.compiler), `actions` lists methods; ..." (k.compiler gives its shape).

### k.forms (1,154 to 1,279)
- API: "`form(schema, { initial?, id? })`" becomes "`form(schema, { initial?, id?, issueText? })`".
- Validation: "Messages derive from `schema.invalid` issues (rule plus constraint)." becomes "Messages derive from `schema.invalid` issues. `issueText(issue): string` gives a field's text for each issue `{ rule, path, min?, max?, values?, format? }` (`FieldIssue`: the constraint from the schema node at the path; `format` is the format type's name); without it the text is English from the rule and constraint, `Invalid value` for `format`."
- Conformance, appended: "With `issueText`, an invalid field's error text is exactly its return value for that field's issue, whose `rule`, `path` and constraint match the schema; without it, a `format` issue shows `Invalid value`."

### spec/kernel/k.prefix.md (new, 878)
~~~md
# k.prefix: Implied path prefix
status: proposed

**Purpose.** An app serves a second value of a leading path param (a second locale) without moving the first value's URLs. Only the URL codec changes: the param is present and typed in `params` on every URL.

**Declaration.** Once, in the param's schema: `s.enum(values, { pathDefault: d })` (k.schema), `d` one of `values` (else it throws).
```ts
export const AppLocale = s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })  // AppLocale.schema.ts
'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams, ... }       // routes.ts
routes.href('recipes.show', { locale: 'en-US', recipeId })   // '/recipes/<id>'
routes.href('recipes.show', { locale: 'de-DE', recipeId })   // '/de-DE/recipes/<id>'
```
A route is prefixed when its path's first segment is `:p` and its params field `p` has a `pathDefault`; `p` is the prefix param. Without `pathDefault` a leading param is ordinary, and every URL carries it.

**Write.** `routes.href`, guard redirects and everything built on them leave out the segment of `d` (`/:locale` with `d` is `/`) and write any other value as usual.

**Parse.** After the trailing-slash redirect (k.router), in order:
1. A first segment equal to a value of `p` other than `d`: the rest of the path matches the prefixed routes, with `p` that value.
2. A first segment equal to `d`: a 308 redirect to the path without it, search kept, as a trailing slash is; the client router replaces the history entry. Each page has one URL.
3. Otherwise the whole path matches the unprefixed routes and the prefixed routes with `p` set to `d`; static beats `:param` as in k.router. No route left is 404.

`params`, the served route in `#k-state`, the `nav` event (k.ctx) and the harness carry `p` on every URL, so resume, session replay and tests pin it through params. `matchHref` of a step-2 href gives its target's match.

**Rules.** E1509 (k.router block), from `manifest` and from `keel check` over a deployable's route table: a static first segment equal to a value of a prefix param; a route whose first segment is another param; a route whose path is a prefixed route's path without the prefix; two prefix params in one table; a `pathDefault` param that is not first in its path. Fix: prepend `/:<p>` to the route's `path` (its params then need the field, E1503).

**Conformance.**
- With `p` of `s.enum(['en-US', 'de-DE'], { pathDefault: 'en-US' })` and route `x.show` at `/:p/items/:id`, `routes.href('x.show', { p: 'en-US', id: '7' })` is `/items/7` and with `de-DE` `/de-DE/items/7`; for every generated params value, `navigate(routes.href('x.show', v))` makes `route().params` equal `v`.
- `/items/7` matches `x.show` with `p` `en-US` and `/de-DE/items/7` with `de-DE`; `/fr-FR/items/7` is 404; without `pathDefault`, `/items/7` is 404 and `/en-US/items/7` matches.
- A GET of `/en-US/items/7?q=1` answers 308 with `Location: /items/7?q=1`; a client navigation to it ends at `/items/7` with `p` `en-US` and adds one history entry.
- `routes.href('x.show', { id: '7' })` and `routes.href('x.show', { p: 'fr-FR', id: '7' })` do not compile.
- A guard on a prefixed route that redirects to a prefixed route keeps `p`: `/de-DE/...` redirects under `/de-DE/`, an unprefixed URL to an unprefixed one.
- Beside `x.show`, each of `/de-DE/about`, `/:slug` and `/items/:id` is E1509, the fix applied leaves no E1509, and without `pathDefault` none of them is E1509.
- `s.enum(['en-US'], { pathDefault: 'fr-FR' })` throws.
~~~

### spec/std/std.i18n.md (new, 1,096)
~~~md
# std.i18n: Locales
status: proposed

**Extension points.** Schema type registry (k.schema `s.register`): importing `@keel/std-i18n` registers `i18n.Locale`. Check rule registry (k.check `defineRule`): `@keel/std-i18n/tools`, which `keel check` imports for a module whose `deps` list the package (k.module), registers E2301.

**API** (`@keel/std-i18n`; client-safe, no config).
```ts
import { formatNumber, plural, localeName } from '@keel/std-i18n'
export const AppLocale = s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })  // AppLocale.schema.ts
formatNumber(1234.5, props.params.locale)                                  // de-DE: '1.234,5'
plural(2, props.params.locale, { one: '# recipe', other: '# recipes' })    // en-US: '2 recipes'
```
- `Locale` is `s.enum(['de-DE', 'en-GB', 'en-US', 'es-ES', 'fr-FR', 'it-IT', 'ja-JP', 'ko-KR', 'nl-NL', 'pt-BR', 'zh-CN'])`, registered as `i18n.Locale`; `type Locale = s.infer<typeof Locale>`. Each tag is a left-to-right language whose CLDR data ships in every supported runtime, so no formatter falls back to the host's locale.
- The locale is route data. An app declares the locales it serves once, as an `s.enum` of `Locale` tags in a `*.schema.ts` file, optionally with a `pathDefault` (k.prefix). A route that shows text for a person has the path `/:locale/...` and a params field `locale` of that enum, so a locale the app does not serve is a 404 (k.router). A component reads `props.params.locale` and passes it to children as a prop; a loader or action reads `params.locale`. A test pins it through `renderRoute` `params` or `render` `props`; a session replays it from the `nav` event's `params`.
- Every `@keel/std-*` function that writes text for a person takes a `Locale` argument and reads no default, host locale or host time zone.
- `formatNumber(n: number, locale: Locale): string` is `new Intl.NumberFormat(locale).format(n)`.
- `PluralForms` is `{ other: string; zero?: string; one?: string; two?: string; few?: string; many?: string }`. `plural(n: number, locale: Locale, forms: PluralForms): string` takes the form `new Intl.PluralRules(locale).select(n)` names, else `other`, and replaces each `#` in it with `formatNumber(n, locale)`. It is the one plural path; std.messages uses it.
- `localeName(locale: Locale): string` is the locale's name in its own language, `new Intl.DisplayNames([locale], { type: 'language', languageDisplay: 'standard' }).of(locale)`, the text of a locale switcher's link.

**Rules.** E2301, in a module whose `deps` list `@keel/std-i18n`: an `Intl` formatter constructed, or `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` or `localeCompare` called, with a locale argument. The message names the stdlib function to call: `formatNumber`, `formatMoney`, `formatDate`, `formatInstant`, `formatDuration`, `compareText`, `plural` or `localeName`. No fix: the function and its arguments depend on the value. Without a locale the same calls are E1758 (k.check).

**Conformance.**
- After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw.
- `Locale.parse` accepts each of the 11 tags and rejects `en`, `de-de`, `en_US` and `fr-CA`, each with rule `enum`.
- For every generated finite `n` and every `Locale` `l`, `formatNumber(n, l)` equals `new Intl.NumberFormat(l).format(n)`; `formatNumber(1234.5, l)` is `1,234.5` for `en-US`, `1.234,5` for `de-DE` and `1,234.5` for `ja-JP`.
- `plural(n, 'en-US', { one: '# recipe', other: '# recipes' })` is `1 recipe` for 1 and `2 recipes` for 2; with the same forms, `ja-JP` gives `1 recipes` for 1 and `de-DE` gives `1.234 recipes` for 1234. For every generated `n` and `Locale` `l`, the result is the form `Intl.PluralRules` selects, else `other`, with `#` replaced.
- `localeName` is `English (United States)`, `Deutsch (Deutschland)` and `日本語 (日本)` for `en-US`, `de-DE` and `ja-JP`.
- With `@keel/std-i18n` in a module's `deps`, `keel check` reports one E2301 each for `new Intl.NumberFormat('de-DE')` and `a.localeCompare(b, 'de-DE')` in its files and none for them in a module without it; `n.toLocaleString()` reports E1758 and no E2301.
- With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.
- The package root imports neither `@keel/check` nor `typescript`; `@keel/std-i18n/tools` exports the E2301 rule.
~~~

### spec/std/std.money.md (710 to 817)
- Extension point, appended: "It depends on `@keel/std-i18n` for `Locale` (std.i18n)."
- API example, appended line: `formatMoney(price, props.params.locale)                  // de-DE: '19,99 $'`.
- The `formatMoney` bullet becomes: "`formatMoney(m: Money, locale: Locale): string` is `new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(d)`, where `d` is the exact decimal string of `amount` at the currency's exponent (`{ amount: -5, currency: 'USD' }` gives `d` `'-0.05'`), so no amount passes through a float. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE`, with U+00A0 before `€`."
- Conformance clause 7, in place: "For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`."

### spec/std/std.temporal.md (new, 1,474)
~~~md
# std.temporal: Dates, instants and durations
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-temporal` registers `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone` and `temporal.Duration`, format types (k.schema `s.format`) over `s.string()`: one canonical ISO 8601 text per value, so `encode` is the identity and equal values are equal strings. It depends on `@keel/std-i18n` for `Locale`.

**API** (`@keel/std-temporal`; client-safe, no config).
```ts
import { instantOf, plainDateOf, formatDate, UTC } from '@keel/std-temporal'
const at = instantOf(ctx.clock.now())                     // ok('2026-11-10T09:30:00.000Z')
if (at.ok) addedOn = plainDateOf(at.value, UTC)           // '2026-11-10'
formatDate(addedOn, props.params.locale, 'long')          // de-DE: '10. November 2026'
```
- `Instant` is `YYYY-MM-DDTHH:mm:ss.sssZ`, a UTC instant to the millisecond in years 0001 to 9999, as `Date.prototype.toISOString` writes it; string order is time order.
- `PlainDate` is `YYYY-MM-DD`, a proleptic Gregorian date in years 0001 to 9999 (the value of `<input type="date">`); string order is date order.
- `TimeZone` is `UTC` or an IANA name that `Intl.DateTimeFormat` accepts as `timeZone` and reports back unchanged in `resolvedOptions().timeZone`. `UTC` is exported as a `TimeZone`.
- `Duration` is elapsed time in whole milliseconds, at most 1e15 either way: `PT0S`, or an optional `-`, `PT`, then `<h>H` if at least an hour, `<m>M` if the minutes (1 to 59) are nonzero, and `<s>S` or `<s>.<mmm>S` if the seconds or milliseconds are nonzero (`PT1H30M`, `-PT0.500S`). No days, months or years.
- `DateStyle` is `s.enum(['short', 'medium', 'long', 'full'])`; `UnitStyle` is `s.enum(['long', 'short', 'narrow'])`.
- `TemporalError` is `KeelError<'temporal.outOfRange', { value: number }>`.
- `instantOf(ms: number): Result<Instant, TemporalError>` is the instant `Math.floor(ms)` milliseconds after 1970-01-01T00:00:00.000Z; a value that is not finite or falls outside years 0001 to 9999 is `temporal.outOfRange` with `value` `ms`. No export reads the clock: the current instant is `instantOf(ctx.clock.now())`. `epochMs(i: Instant): number` is its inverse.
- `plainDateOf(i: Instant, zone: TimeZone): PlainDate` is the calendar date at `i` in `zone`.
- `addDays(d: PlainDate, days: number): Result<PlainDate, TemporalError>`: a non-integer `days`, or a result outside years 0001 to 9999, is `temporal.outOfRange` with `value` `days`.
- `durationOf(ms: number): Duration` for an integer within the bounds (any other `ms` throws, as `encode` of an invalid value does); `durationMs(d: Duration): number` is its inverse.
- `formatDate(d: PlainDate, locale: Locale, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' })` applied to `d` at 00:00 UTC.
- `formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style, timeZone: zone })` applied to `i`.
- `formatDuration(d: Duration, locale: Locale, style: UnitStyle): string` writes the nonzero hours, minutes and seconds of `d` (seconds with the millisecond fraction; `PT0S` as zero seconds), each as `new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: style })`, joined by `new Intl.ListFormat(locale, { type: 'unit', style })`; a negative `d` signs its first unit. `Intl.DurationFormat` is not used: Node 22 lacks it.

**Rules.** None. An ambient locale or time zone in app code is E1758 (k.check); `temporal.outOfRange` is a KeelError code (k.errors).

**Conformance.**
- After importing `@keel/std-temporal`, the registry maps the four names to the exports; importing it again does not throw.
- For every value `gen` produces for each of the four, `parse` accepts it, `encode` returns it unchanged and `doc()` is its name; generated dates reach 0001-01-01, 9999-12-31 and February 29.
- `Instant.parse` rejects `2026-11-10T09:30:00Z`, `2026-02-30T00:00:00.000Z` and `2026-11-10T09:30:00.000+01:00`; `PlainDate.parse` rejects `2023-02-29`, `2026-1-05` and `0000-01-01` and accepts `2024-02-29`; `TimeZone.parse` rejects `Mars/Olympus` and `utc`; `Duration.parse` rejects `PT90M`, `PT0.5S`, `P1D` and `-PT0S`. Each rejection has rule `format` at the value's path.
- For every generated in-range integer `ms`, `epochMs` of `instantOf(ms)`'s value is `ms` and `instantOf(ms + 0.5)` gives the same instant; `instantOf(253402300800000)` is `err` `temporal.outOfRange`.
- For every generated instant `i`, `plainDateOf(i, UTC)` is the first 10 characters of `i`; for `2026-11-10T23:30:00.000Z` it is `2026-11-11` in `Asia/Tokyo` and `2026-11-10` in `America/New_York`.
- For generated `d` and `n` whose results are in range, `addDays` of `addDays(d, n)`'s value and `-n` is `d`; `addDays('2024-02-28', 1)` is `2024-02-29`; `addDays('9999-12-31', 1)` is `err` with `value` 1.
- For every generated integer `ms` within the bounds, `durationMs(durationOf(ms))` is `ms`; `durationOf` of 0, 5400000 and -500 is `PT0S`, `PT1H30M` and `-PT0.500S`; `durationOf(0.5)` throws.
- For every `Locale`, style and generated value, `formatDate` and `formatInstant` equal the `Intl` expressions above. `formatDate('2026-11-10', l, 'long')` is `November 10, 2026`, `10. November 2026` and `2026年11月10日` for `en-US`, `de-DE` and `ja-JP`; `formatInstant('2026-11-10T23:30:00.000Z', 'de-DE', 'Asia/Tokyo', 'medium')` is `11.11.2026, 08:30:00`.
- `formatDuration` with `short` is `5 min`, `5 Min.` and `5 分` for `PT5M`, and `1 hr, 30 min`, `1 Std., 30 Min.` and `1 時間 30 分` for `PT1H30M`, in `en-US`, `de-DE` and `ja-JP`; in `en-US`, `-PT1H30M` is `-1 hr, 30 min`, `PT0S` is `0 sec` and `PT1.500S` is `1.5 sec`.
- With `process.env.TZ` set to `Pacific/Kiritimati` and then `America/Adak`, every export returns equal results for equal arguments.
~~~

### spec/std/std.text.md (new, 1,029)
~~~md
# std.text: Text
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-text` registers `text.Email` and `text.Slug`, format types (k.schema `s.format`) over `s.string()`. It depends on `@keel/std-i18n` for `Locale`. A grapheme is an extended grapheme cluster (Unicode UAX #29), what a reader counts as one character.

**API** (`@keel/std-text`; client-safe, no config).
```ts
import { line, para, Email, compareText } from '@keel/std-text'
export const Recipe = s.object({ title: line({ max: 80 }), notes: para({ max: 2000 }).optional(), by: Email })
props.data.recipes.toSorted((a, b) => compareText(a.title, b.title, props.params.locale))
```
- Text a person writes and reads (titles, names, notes) is `line` or `para`; `s.string` holds machine strings (codes, tokens, keys).
- `line({ min = 1, max })` is a format type over `s.string()` named `line(<min>..<max>)`, not registered: the value is NFC (`v.normalize('NFC') === v`) and has no control character (Unicode `Cc`), no U+2028 or U+2029, no bidi embedding, override or isolate (U+202A to U+202E, U+2066 to U+2069), and `min` to `max` graphemes. `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`; other bounds throw. Its type is `Format<string, 'line(<min>..<max>)'>`, so a value of one bound is not assignable to another.
- `para({ min = 1, max })` is `line` that also allows U+000A, named `para(<min>..<max>)`.
- `Email` (`text.Email`) is ASCII `local@domain` of at most 254 characters: `local` is 1 to 64 characters of dot-separated atoms of letters, digits and ``!#$%&'*+/=?^_`{|}~-``; `domain` is two or more dot-separated labels of 1 to 63 letters, digits and inner hyphens, the last all letters. It is kept as written, with no case folding.
- `Slug` (`text.Slug`) is 1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs.
- `graphemes(s: string): number` counts graphemes with `Intl.Segmenter` (`granularity: 'grapheme'`).
- `truncate(s: string, max: number): string` is `s` when it has at most `max` graphemes; otherwise its first `max - 1` graphemes with trailing white space removed, then `…` (U+2026). `max` is an integer of at least 1; any other throws.
- `compareText(a: string, b: string, locale: Locale): -1 | 0 | 1` is the sign of `new Intl.Collator(locale).compare(a, b)`.

**Rules.** None. `localeCompare` without a locale is E1758 (k.check).

**Conformance.**
- After importing `@keel/std-text`, the registry maps `text.Email` and `text.Slug` to the exports; importing it again does not throw.
- For every value `gen` produces for `line({ max: 80 })`, `line({ min: 0, max: 3 })`, `para({ max: 2000 })`, `Email` and `Slug`, `parse` accepts it and `parse(encode(v))` returns it; each `line({ max: 80 })` value has 1 to 80 graphemes, and `line({ max: 80 }).doc()` is `line(1..80)`.
- `line({ max: 3 })` accepts three `👨‍👩‍👧` (24 code units) and rejects four; it rejects `''`, `'a\nb'`, `'a‮b'`, `'a\u0007'` and `'é'` (not NFC), each with rule `format`. `para({ max: 3 })` accepts `'a\nb'` and rejects `'a\r\nb'`.
- `line({ max: 0 })`, `line({ min: 2, max: 1 })` and `line({ max: 1.5 })` throw.
- `Email` accepts `a.b+c@example.co` and rejects `a@b`, `a..b@example.com`, `é@example.com`, `@example.com` and a 255-character address; `Slug` accepts `pasta-bake-2` and rejects `Pasta`, `-a`, `a--b` and `''`. Each rejection has rule `format`.
- `graphemes` is 1 for `👨‍👩‍👧` and for `'é'`, 0 for `''`, and `s.length` for every generated ASCII string.
- For every generated string `s` and `max` from 1 to 20, `graphemes(truncate(s, max)) <= max`; `truncate(s, max) === s` exactly when `graphemes(s) <= max`; otherwise the result ends with `…` and the graphemes before it begin `s`, none split. `truncate('Crème brûlée', 6)` is `Crème…`.
- For generated `a`, `b` and every `Locale` `l`, `compareText(a, b, l)` is the sign of `new Intl.Collator(l).compare(a, b)` and equals `-compareText(b, a, l)`; `compareText('ä', 'b', 'de-DE')` is `-1`.
- With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.
~~~

### spec/std/std.messages.md (new, 1,436)
~~~md
# std.messages: Message sets
status: proposed

**Extension points.** Schema type registry (k.schema `s.format`; message types are not registered, each depends on its key's params). Check rule registry (k.check `defineRule`): `@keel/std-messages/tools`, which `keel check` imports for a module whose `deps` list the package, registers E2401 to E2406. It depends on `@keel/std-i18n` for `Locale`, `formatNumber` and `plural`.

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
- An entry gives every key a message. A key without params takes text: 1 to 2,000 characters with no `{` or `}`. A key with params takes an object: `{ text }`, one template; `{ plural: p, other, zero?, one?, two?, few?, many? }`, templates chosen by the number param `p`; or `{ select: p, cases }`, a template for each value of the enum param `p`. A template writes a param as `{name}`, a name its key declares; in a plural form `#` is `p`. Each message is a format type (rule `format` when it breaks this), so `parse`, `gen` and `doc()` derive from the set.
- `Set.text(entry)` returns `entry` typed as the set's entry; it is a locale file's default export. `Set.load(locale): Promise<Entry>` imports that locale's file through `load` and parses its default export with the set; a failing entry throws (unexpected).
- `formatMessage(message, params, locale): string` renders an object message, `params` typed by its key: `{name}` becomes the param, a number through `formatNumber`; `plural` goes through `plural` (std.i18n) with `params[p]`; `select` takes `cases[params[p]]`. A text message is a string and renders as itself; an object is not a `Child` (k.ui), so an object message renders only through `formatMessage`.
- Text reaches a component as loader data: a loader returns `await Set.load(params.locale)` in its output (the set is a schema) and the component reads `props.data`. A route level with no island ships no message; an island level ships the one entry in its props in `#k-state` (k.runtime), and resume keeps the server's text. In a `client` deployable `load` fetches only the active locale's file, a chunk of its own. A test pins text through `renderRoute` `params`, or passes `await Set.load(l)` in `render` props; a session replays the `nav` and its loaders.

**Rules** (in a module whose `deps` list `@keel/std-messages`). E2401 a locale of the set without `<Set>/<locale>.ts`, or `load` not that exact import (fix: the file with `Set.text({})`, or the exact `load`) · E2402 a locale file without a declared key (no fix: a translation cannot be derived) · E2403 a locale file key the set does not declare (fix: removes it) · E2404 a declared key no other project file reads as `.<key>` (fix: removes it from the declaration) · E2405 a template's `{name}`, `plural` or `select` that does not match its key's params (fix: renames the placeholder when exactly one declared param is absent from that template) · E2406 a JSX text child, or a string literal `label` or `alt`, containing a letter, in a component file (no fix).

**Conformance.**
- For a fixture set with keys `title` (no params), `count` (`n: s.int()`) and `kind` (`k: s.enum(['a', 'b'])`), every `gen` entry parses and round-trips; `title: 'a{b'`, a template naming `{x}`, a `plural` on `k` and a `select` without case `b` each fail with rule `format` at the key's path; a missing key fails with `required`, an extra one with `unknown-key`.
- `messages` throws for a param schema `s.object({})`.
- `formatMessage({ plural: 'n', one: '# recipe', other: '# recipes' }, { n: 2 }, 'en-US')` is `2 recipes`; `{ text: 'Added {date}' }` with `{ date: 'November 10, 2026' }` is `Added November 10, 2026`; `{ text: '{n} items' }` with `{ n: 1234 }` in `de-DE` is `1.234 items`; a `select` gives the case of the param's value.
- For every generated entry and params, `formatMessage` of each object message returns a string with no `{`.
- `Set.load('de-DE')` resolves to the fixture's `de-DE` entry; for a locale file failing the set it rejects.
- A `client` build of a fixture route whose loader loads a set holds each locale's entry in its own chunk, and no other chunk holds an entry's text.
- A node document holds a static level's message text and no `#k-state` entry for it; an island level's `#k-state` holds the served locale's entry and no other locale's text.
- E2401 to E2406 each have a triggering fixture and a clean one; the fixes of E2401, E2403, E2404 and E2405 apply with `git apply`, and re-checking reports no diagnostic of that code.
- The package root imports neither `@keel/check` nor `typescript`; `@keel/std-messages/tools` exports the six rules.
~~~

### spec/00-map.md (orchestrator; 895 to about 1,010)
- Code ranges: the E150x owner becomes "k.router, k.prefix"; add the row "| E230x | std.i18n | E240x | std.messages |".
- Kernel table, after k.router: "| k.prefix | Implied path prefix | proposed | a leading enum param with `pathDefault` left out of the URL |".
- Stdlib table: std.i18n ("schema type registry and check rule registry: `i18n.Locale`, numbers, plurals, E2301"), std.temporal ("schema type registry: instants, dates, zones, durations; format"), std.text ("schema type registry: `text.Email`, `Slug`, `line`, `para`, collation"), std.messages ("check rule registry: message sets, one file per locale, E2401-E2406"); std.money's line becomes "schema type registry: `money.Money`, add, format for a locale".
- `spec/std/README.md`: "S2 (RFC 0079) adds std.i18n, std.temporal, std.text and std.messages and changes std.money."

## Conformance diff
The conformance-writer of each lane writes these from the accepted spec text, skipped until implementation; each clause is cited verbatim by exactly one file. k.schema, k.check, k.ui, k.router and k.forms stay `conformance-covered`, so `keel ledger --diff` reports E1707 for each appended clause until its file lands in the kernel lane's commits.

- **Kernel, added.** `packages/schema/conformance/format-type.test.ts`; `packages/check/conformance/E1106-format-in-app.test.ts`; `packages/check/conformance/E1758-ambient-locale.test.ts`; `packages/ui/conformance/lang-attribute.test.ts`; `packages/forms/conformance/issue-text.test.ts`; `packages/router/conformance/prefix-{write,parse,canonical-308,types,guard,e1509,path-default-throws}.test.ts` (k.prefix, one per clause).
- **Kernel, edited (header gains rfc:0079).** `packages/router/conformance/guard-denied-redirect.test.ts` (clause 5: params carried, a missing one is E1508). No other existing kernel header quotes a changed clause; the trims touch no clause text.
- **std-i18n, added.** `registry`, `locale-parse`, `format-number`, `plural`, `locale-name`, `e2301`, `host-independent`, `tools-split` (`.test.ts` in `packages/std-i18n/conformance/`).
- **std-money, edited (rfc:0079).** `packages/std-money/conformance/format.test.ts` (clause 7). The other five files are unchanged.
- **std-temporal, added.** `registry`, `gen-roundtrip`, `parse-rejects`, `instant-of`, `plain-date-of`, `add-days`, `duration`, `format-date-instant`, `format-duration`, `host-independent`.
- **std-text, added.** `registry`, `gen-roundtrip`, `line-para`, `line-bounds-throw`, `email-slug`, `graphemes`, `truncate`, `compare-text`, `host-independent`.
- **std-messages, added.** `entry-schema`, `declare-throws`, `format-message`, `format-message-property`, `load`, `client-chunks`, `server-only`, `rules-e2401-e2406`, `tools-split`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): `formatMoney`, `formatDate` and `formatDuration` injective per locale over generated inputs; `addDays` additive; `compareText` transitive on generated triples; `plainDateOf` monotonic in `i` for a fixed zone; `formatMessage` total over generated entries; `routes.href` then match is the identity with and without `pathDefault`.

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (the new files, the kernel and std.money edits, `spec/00-map.md`, `spec/std/README.md`); write ADR-0068 to ADR-0071; create `packages/std-i18n`, `std-temporal`, `std-text` and `std-messages` (`package.json` with dependencies and, for std-i18n and std-messages, the `./tools` export; `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, empty `src/index.ts`, `conformance/`, `unsafe/`, all in the std-money shape); add `@keel/std-i18n` to `packages/std-money/package.json`; set the `tooling/deps.json` order; add the `tooling/budgets.json` entries and re-bases (Token impact); add the five packages to `apps/golden-2/package.json`; run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel | `packages/schema/**`; `packages/check/**`; `packages/ui/src/**`; `packages/router/src/**`; `packages/forms/src/**`; `packages/server/src/**`; `packages/testing/src/**`; `packages/cli/src/internal/{toJsonSchema,fieldsOf}.ts`; `packages/std-sessions/src/redact.ts` and `src/internal/fake.ts` (the `format` node case); `packages/store/src/internal/persisted.ts`; the kernel conformance files above; kernel changesets | nothing; lands K1 (`s.format`, `Format`, rule `format`, `pathDefault`) as its first commit | `pnpm --filter @keel/schema --filter @keel/check --filter @keel/ui --filter @keel/router --filter @keel/forms --filter @keel/server --filter @keel/testing --filter @keel/cli --filter @keel/std-sessions --filter @keel/store run check`, the same with `run test` |
| i18n-money | `packages/std-i18n/**`, `packages/std-money/**` | nothing; lands `Locale`, `formatNumber` and `plural` as its first commit | `pnpm --filter @keel/std-i18n --filter @keel/std-money run check && pnpm --filter @keel/std-i18n --filter @keel/std-money run test` |
| std-temporal | `packages/std-temporal/**` | K1; `Locale` | `pnpm --filter @keel/std-temporal run check && pnpm --filter @keel/std-temporal run test` |
| std-text | `packages/std-text/**` | K1; `Locale` | `pnpm --filter @keel/std-text run check && pnpm --filter @keel/std-text run test` |
| std-messages | `packages/std-messages/**` | K1; `Locale`, `formatNumber`, `plural` | `pnpm --filter @keel/std-messages run check && pnpm --filter @keel/std-messages run test` |
| golden-2 | `apps/golden-2/**`, `evals/tasks/golden-2/**` (TASK.md, `acceptance.test.ts`, `pass.ts`, `spec-slice.txt` gains the five std sections and k.prefix) | every lane | `pnpm --filter golden-2 run check && pnpm --filter golden-2 run test && pnpm eval --task golden-2 --runner none --strict` |

Order: kernel and i18n-money start at once. std-temporal, std-text and std-messages write code against the spec text at once and run their tests once K1 and `Locale` are on the branch. std-messages proves its `client` chunk clause first, since the golden-2 design rests on it. golden-2 starts with schemas, message files and the eval task, and finishes last. That is five implementation agents and one kernel agent, the program's batch budget. Mutation runs (kernel packages, then std packages) go alone after the batch. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, ledger diff, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0292 (golden-2 lane: golden-2's `check` script runs `keel check`); 0306 (kernel lane, `packages/server`: silence the happy-dom module-load stack in server tests); 0291 (kernel lane, `packages/check`: the type pass's Node declarations cost, as its last step if K1 to K6 are green). 0296 needs a rule design of its own and waits; 0302 to 0304 are in packages no lane owns.

## Migration
- **Kernel callers.** `s.format`, `Format`, rule `format`, `pathDefault`, `lang`, `issueText`, E1106, E1509 and E1758 are additions. A `switch` over `Rule` or schema node kinds outside the kernel stops compiling until it handles `format`; inside the repository those are `packages/std-sessions` (kernel lane) and none in `apps/`. No app calls a locale API (`grep` of `apps/` for `toLocale`, `localeCompare`, `Intl.` and `navigator.language` is empty), so E1758 reports nothing on upgrade. A guard whose `redirect` route has no params behaves as before; one whose route has params threw at redirect time and now redirects or reports E1508. Without `pathDefault`, matching is unchanged.
- **`formatMoney`.** `formatMoney(m)` becomes `formatMoney(m, locale)`. No caller exists outside `packages/std-money`; its clause 7 and `test/money.property.test.ts` change with it.
- **golden-2.** As Proposal 5 lists; en-US URLs keep working through the unprefixed default; `.api.storage*` is deleted.
- **Docs.** `docs/ARCHITECTURE.md` names the new packages and gains the Borrow vs build row "Dates, zones, locale data: borrow platform `Intl`; build ISO values; no `Temporal` polyfill". Each new package gets a README in the std-money shape. The `keel` skill gains two lines: values are shown with `formatMoney`, `formatDate`, `formatDuration` or `formatNumber` and the route's `locale`; page text comes from a message set through the route's loader.

## Token impact
Sections after the change (measured): k.schema 1,474, k.check 1,499, k.ui 1,497, k.router 1,496, k.forms 1,279, k.prefix 878 (new), std.i18n 1,096, std.temporal 1,474, std.text 1,029, std.messages 1,436, std.money 817; spec map about 1,010 of 1,200. k.check, k.ui and k.router are within 4 tokens of the cap: their next change needs a split. A golden-2 task reading std.i18n, std.money, std.temporal and std.messages reads about 4,800 tokens of stdlib spec, so the eval's spec slice keeps key lines only, as it does for the kernel. The `keel` skill grows by about 50 tokens.

Package sizes (gzip; `tooling/budgets.mjs` rule):

| Package | Today | Estimate | `budgets.json` |
| --- | --- | --- | --- |
| `@keel/std-i18n` / `./tools` | new | 0.7 kB / 3 kB | `"1kb"` / `{ "max": "4kb", "platform": "node" }` |
| `@keel/std-money` | 539 B | 0.7 kB | `"1kb"` (no entry today) |
| `@keel/std-temporal` | new | 2 kB | `"2.5kb"` |
| `@keel/std-text` | new | 1 kB | `"1.5kb"` |
| `@keel/std-messages` / `./tools` | new | 1.2 kB / 5 kB | `"1.5kb"` / `{ "max": "6kb", "platform": "node" }` |
| `@keel/schema` | 4,402 B | +0.35 kB | `5kb` holds |
| `@keel/check` | 33,538 B | +0.8 kB (E1106, E1758, E1509 over routes.json) | `33kb` (33,792 B) is crossed; re-base to `34.5kb` with the measured bytes in the commit (default 7) |
| `@keel/router` | 8,376 B | +0.4 kB (K4, K6) | `8.5kb` (8,704 B) is crossed; re-base to `9kb` |
| `@keel/ui`, `@keel/forms`, `@keel/server` | 3,104 B, 4,115 B, 14,390 B | +20 B, +60 B, +80 B | hold |

An app that formats money, dates and messages adds about 5 kB gzip and no locale data, since `Intl` ships with the engine; a `client` deployable fetches one locale file per message set.

## Known limits
- **Cross-engine bytes.** A browser on another CLDR version can write a value with a different space character than the server. Resume keeps the server's text; only an island that re-renders a value shows the browser's form. Conformance pins literals only where Node 22 and 24 agree and compares with the named `Intl` expression elsewhere.
- **`errorElement` copy.** An `errorElement` receives `{ error }` and no params, so its text comes from the error's message, which the loader writes from its entry. A router-made 404 for a bad param has no locale. Passing params to `errorElement` waits for the k.router split.
- **Server field messages without JS.** The router's own 422 messages for a no-JS post come from its English `messageFor`; with the runtime loaded, `issueText` covers every client-side issue.
- **Document head.** `<title>` and `<html lang>` are per deployable until Open question 4 is decided.
- **Message text.** Templates have no markup and no literal braces; a sentence with a link is split into messages around a `Link`.
- **Money input.** golden-2 takes a price in minor units. Parsing `12,50 €` typed in a locale is a later std-money function.
- **Locale choice.** With no headers in loaders, nothing picks a locale from `Accept-Language`; the switcher and the unprefixed default cover S2.
- **New time zones.** A zone newer than a runtime's tzdata parses only where the runtime knows it.
- **Right-to-left.** No right-to-left tag is in `i18n.Locale` until k.ui has a `dir` story.

## ADRs
Numbers from the next free in `docs/adr/` (0067 is the last). The orchestrator writes them at acceptance.
- **ADR-0068 Format types in k.schema.** Context: stdlib values (dates, zones, bounded text, message templates) need validation a primitive cannot express, and every derivation must still come from the schema. Decision: `s.format(name, base, { check, gen: { from, map } })`, a `format` node kind holding `check` and `gen` beside the JSON node, rule `format`, `Format<T, N>`, JSON Schema `format`, and E1106 keeping it in the stdlib. Alternatives: a pluggable primitive kind, `s.string({ pattern })`, stdlib-private validation, app-written format types. Consequences: one new node kind every walker handles; a serialized node loses its predicate.
- **ADR-0069 Ambient locale and time zone are E1758.** Context: host locale and zone reads make server and client text differ. Decision: a k.check source rule with E1601's name resolution and no fix, since the fix is an argument. Alternatives: widening E1601 in k.ctx, a stdlib rule that only runs where the stdlib is installed. Consequences: k.check reaches its cap; `@keel/check` re-based.
- **ADR-0070 The locale is a path param, with an optional unprefixed default.** Context: the locale must be addressable, typed and pinned by tests and replay. Decision: `/:locale/...` typed by an app enum of `i18n.Locale` tags; `pathDefault` on that enum and the k.prefix codec (elide on write, fill on parse, 308 for the prefixed default, E1509 for collisions); guard redirects carry same-name params (K4); `lang` on every base element (K3). Alternatives: `?locale=`, a ctx capability, a request store, `Accept-Language`, a manifest-level prefix option, 404 for the prefixed default. Consequences: every link passes a locale; the scaffold template follows in its own task.
- **ADR-0071 Message sets are schemas loaded per route.** Context: translated page text with typed params, a closed key vocabulary and only the active locale shipped. Decision: `@keel/std-messages` (`messages`, one file per locale, `load` through a dynamic import, `formatMessage` through std-i18n `plural`), text delivered as loader data, E2401 to E2406, and `form(schema, { issueText })` (K5) for form text. Alternatives: one file per set with all locales, ICU MessageFormat, component imports, a provider, per-format-type English messages. Consequences: each route that shows text has a loader; layouts parse their params; `errorElement` copy comes from the error.

## Open questions
Each is a new hand-written user-facing API shape, which the defaults escalate. The batch proceeds on each recommendation unless the user says otherwise.

1. **The unprefixed default's declaration.** Recommended: `s.enum(values, { pathDefault })` on the app's locale enum, read by the router through the k.prefix section, with the prefixed default answering 308; the scaffold `project` template is born with `AppLocale = s.enum(['en-US'], { pathDefault: 'en-US' })` and its routes under `/:locale`, in a scaffold task after this batch. Alternatives: a `prefix` option on each `manifest` (declared per module, not where the locales live), a std-i18n wrapper `locales(values, { unprefixed })` (needs the same kernel marker underneath), 404 for the prefixed default, or a scaffold without the locale param (a one-locale app then hand-threads `locale` through every link when it adds a second; the template choice changes only new apps).
2. **Message sets.** Recommended: Proposal 4 as written: `messages(locales, keys, load)` in `*.schema.ts`, `<Set>/<locale>.ts` files, `Set.load` in loaders, `formatMessage(message, params, locale)`, and E2406 refusing literal copy in a component file of a module that lists the package (proper names such as `Keel` go in the set too). Alternative: one file per set holding every locale (one edit per key, every locale shipped to a `client` deployable).
3. **`form(schema, { issueText })`** (K5). Recommended: accept, so form errors are translated with the page. Alternative: kernel English for every form error in S2, with golden-2's German form showing `Required`.
4. **Per-route `<title>` and `<html lang>`.** Recommended: an optional `title: (props) => string` on the route definition, reading a message from loader data, written as `<title>{title} · {deployable}</title>` and set as `document.title` on client navigation, with `<html lang>` taken from `params.locale` when the route has one; in its own RFC after S2, because k.router and k.server are at the token cap and each needs a split. Alternative: one title per deployable in `topology.ts`, with no per-page text and no page language.
