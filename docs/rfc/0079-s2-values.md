# RFC 0079: S2 Values: locales, money, dates and text

Status: draft (2026-11-10). Stage design RFC for S2 (`tasks/PROGRAM.md`, backlog 0307). Applies WORKFLOW RFC defaults 1 (kernel gaps get kernel changes: K1 to K5), 2 (`formatMoney` is replaced, not doubled), 3 (the new rules run in the existing check pipeline; the exit proof extends the existing golden-2 eval task), 4 and 5 (nothing new leaves the browser or reaches it; no package takes config), 6 (E1106, E1758 and E2501 enforce what prose would otherwise ask for) and 7 (new size entries only; no threshold lowered). The Open questions need the user.

## Problem
S2 must show golden-2's prices and dates in 3 locales, proven by an eval. Keel has one value package, `@keel/std-money`, and its only display function, `formatMoney(m)`, writes `12.50 EUR` for everyone. Nothing in the kernel or stdlib says where a locale comes from, and the gaps below block any locale-aware value.

1. **No validated string types.** k.schema primitives cannot say "a calendar date", "a UTC instant" or "a line of at most 80 graphemes". `s.string({ max })` counts UTF-16 units, so 40 flag emoji fill an 80-character title, and nothing refuses a bidi override (U+202E) that reverses the text around it. The type registry names composite types only.
2. **Ambient locale and time zone pass the checker.** E1601 catches `Date.now()` and a no-argument `Intl.DateTimeFormat().format()`, but `price.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)` (the host's time zone), `navigator.language` and `new Date(ms).getHours()` all check clean. Each gives a server in UTC and a browser in Tokyo two different strings for one value, against principle 10.
3. **No way to mark the language of a part.** A Japanese date inside an English page is read by an English voice. k.ui base elements take no `lang`, so WCAG 3.1.2 cannot be met.
4. **Guard redirects drop params.** A guard redirects to a route id with no params (`routes.href(g.redirect)` in `runGuards`). Once routes carry `/:locale`, a denied guest lands on a route whose param is missing, and the server throws.
5. **Forms have no message for a refused format.** `messageFor` in forms and router switches over every `Rule`; a new rule needs a message a person can read.

`createApp` shares one `ctx` across requests (k.server), so the locale cannot live on `ctx`; loaders see `params`, `search`, `url` and `caller`, never headers. Node 22 (the `engines` floor and CI) and Node 24 (local, ICU 78.3, CLDR 48.0) have no `Temporal` global.

## Proposal

### 1. How the locale reaches rendering
The locale is route data. An app declares the locales it serves once, as an `s.enum` of `i18n.Locale` tags in a `*.schema.ts` file, and every route that shows a value carries it as a path param: `/:locale/...`. From there it is an explicit argument everywhere.

- **Component.** A route or layout component reads `props.params.locale` (layouts receive the matched route's `params`, k.router) and passes it as a prop to any child that formats. A formatter takes it as an argument: `formatMoney(price, props.params.locale)`, `formatDate(day, props.params.locale, 'long')`. The element showing the value carries `lang={props.params.locale}` (K3).
- **Server.** The router parses `locale` with the route's params schema; a locale the app does not serve is a 404 before any loader runs. The component formats with the server's `Intl`, and the text is in the document.
- **Resume.** `#k-state` carries the served `route.params`, so the island props and the route the client resumes with hold the same `locale`. Resume does not re-render text (k.runtime), so the server's string stays. An island that later re-renders a value calls the same pure function with the same locale.
- **Client-only deployables.** The client router parses the same param from the URL; nothing differs.
- **Tests.** `renderRoute(id, { params: { locale: 'de-DE', ... } })` and `render(C, { props: { locale: 'de-DE', ... } })` pin it. Nothing ambient needs a stub.
- **Session replay.** A `nav` event carries `href` and `params`; replaying it replays the locale. No capability seed or store snapshot is involved.
- **Time zone.** Also explicit. A date that belongs to a calendar day is a `PlainDate` and needs no zone to display; an `Instant` is shown with `formatInstant(i, locale, zone, style)`, where `zone` is data the app holds (golden-2 uses `UTC`).

Links stay typed: `routes.href('recipes.show', { locale, recipeId })` does not compile without `locale`, so no link drops it. A locale switcher is a set of `Link`s to the same route id with another `locale`.

**Alternatives that lost.**
- **A `locale` capability on `ctx`.** `createApp` shares one `ctx` across requests, so a per-request locale needs a per-request ctx (a k.server change). A component's output would depend on something outside its props (principle 2), a link could not carry it (principle 3), and tests and replay would have to pin it apart from the URL.
- **A request-scope store `i18n.locale` set from a cookie or `Accept-Language`.** A component that reads store state is an island (k.runtime), so every formatted price would ship JS. The URL would not say which locale a page is in, so a shared link renders differently for the next reader, and replay needs a store snapshot to reproduce it.
- **An optional search key `?locale=de-DE`.** No path changes, but search keys are optional by rule (E1504 forbids required ones), so `routes.href` compiles without it and every link that forgets it falls back to the default.
- **`Accept-Language` negotiation per request.** Loaders and guards see no headers, and the same URL would render differently per client, which a test or a replay cannot pin from the URL.

### 2. Kernel changes
Each change is the smallest one that closes its gap; each gets ADR-0068 with this RFC. Exact spec text is in Spec diff.

- **K1, k.schema: format types.** `s.format(name, base, { check, gen, message })` narrows an `s.string` or `s.int` schema by a predicate. `parse` fails a refused value with a new rule, `format`. The type is branded with `name` as `s.id` brands, so a function taking `PlainDate` gets a parsed one. E1106 keeps `s.format` out of app code: an app-written predicate would come with a generator nobody tests, and every property test built on it would trust it. Closes gap 1 for std-temporal and std-text.
- **K2, k.check: E1758 ambient locale or time zone.** A source rule in the check pipeline, resolved the way E1601 resolves names. It lives in k.check because it has no `ctx` equivalent to fix toward (the fix is an argument) and because k.ctx is at its token limit. Closes gap 2.
- **K3, k.ui: `lang` on base elements.** Every base element takes `lang`, written as the attribute. Closes gap 3. This is the k.ui touch PROGRAM.md expected; a formatting hook in k.ui lost (Alternatives).
- **K4, k.router: guard redirects carry params.** The redirect fills its route's params from the matched route's params of the same name; a `redirect` param the matched route lacks is E1508 at runtime, beside the redirect loop it already reports. Closes gap 4. A static check for the missing param does not fit k.router's budget (Spec diff).
- **K5, k.forms: the `format` message.** A `format` issue shows the format type's `message`. Closes gap 5. The exhaustive switches in `packages/forms`, `packages/router` and `packages/store` gain the case.

No change to k.ctx, k.server, k.runtime, k.module or k.testing. The document's `<html lang>` stays `en` in S2: page copy stays English until message catalogs exist (Open question 2).

### 3. Package contracts
Every package here is client-safe, takes no `std` config and ships one export per file. Dependency order in `tooling/deps.json`: `std-i18n`, `std-money`, `std-temporal`, `std-text`, then the wave-0 packages after them. Code ranges: E230x std.temporal, E240x std.text, E250x std.i18n, E260x std.money. E22xx and E29xx are skipped: `packages/check` tests use E2234 and E29xx as fixture codes.

| Package | Purpose | Registers | Rules | Platform APIs | Size (gzip) |
| --- | --- | --- | --- | --- | --- |
| `@keel/std-i18n` | The locale as a value, numbers written for one, and the one-way rule for formatting | `i18n.Locale` | E2501 (`./tools`) | `Intl.NumberFormat` | 0.6 kB root; `./tools` 3 kB, node |
| `@keel/std-money` | Amounts in minor units, added exactly, shown for a locale | `money.Money`, `money.Currency` | none | `Intl.NumberFormat` (exact decimal strings) | 1 kB |
| `@keel/std-temporal` | Instants, calendar dates and time zones as strings, shown for a locale | `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone` | none | `Intl.DateTimeFormat` (`dateStyle`, `timeStyle`, `timeZone`), `Date` UTC methods | 2 kB |
| `@keel/std-text` | Text a person types and reads: bounded by graphemes, free of control and bidi characters, sorted by locale | `text.Email`, `text.Slug` | none | `Intl.Segmenter`, `Intl.Collator` | 1.5 kB |

**`@keel/std-i18n`.** Exports:
```ts
export const Locale: Schema<'de-DE' | 'en-GB' | 'en-US' | 'es-ES' | 'fr-FR' | 'it-IT' | 'ja-JP' | 'ko-KR' | 'nl-NL' | 'pt-BR' | 'zh-CN'>
export type Locale = s.infer<typeof Locale>
export function formatNumber(n: number, locale: Locale): string
// @keel/std-i18n/tools (node only): registers E2501 through defineRule
export const intlInI18nModule: RuleDef
```
The 11 tags are left-to-right languages whose CLDR data ships in Node 22 and later and in current Chrome, Firefox and Safari. Right-to-left tags wait for a k.ui `dir` story. `Intl.NumberFormat` is in every supported runtime; there is no fallback. Errors: none. App code:
```ts
// modules/shop/ShopLocale.schema.ts
export const ShopLocale = s.enum(['en-US', 'de-DE', 'ja-JP'])
// modules/shop/Basket.tsx
<Text id="shop.count" lang={props.params.locale}>{formatNumber(props.data.count, props.params.locale)}</Text>
```

**`@keel/std-money`.** Changes: `formatMoney(m)` becomes `formatMoney(m, locale)`, and the package depends on `@keel/std-i18n`. Exports after the change:
```ts
export const Currency: Schema<'EUR' | 'GBP' | 'JPY' | 'USD'>
export const Money: Schema<{ amount: number; currency: Currency }>   // closed, amount int in ±1e15
export function addMoney(a: Money, b: Money): Result<Money, MoneyError>
export function formatMoney(m: Money, locale: Locale): string
export type MoneyError = KeelError<'money.currencyMismatch', { left: Currency; right: Currency }> | KeelError<'money.overflow', { amount: number }>
```
`formatMoney` hands `Intl.NumberFormat` the exact decimal string (`'-0.05'`), which Node 22 and current browsers format exactly (ECMA-402 NumberFormat v3). Where a runtime coerces the string to a number instead, every in-bounds amount still prints exactly: at 1e13 major units a double's spacing is under 0.002, below half a cent. Errors: unchanged. App code: `<Text id="shop.total" lang={props.params.locale}>{formatMoney(props.data.total, props.params.locale)}</Text>`.

**`@keel/std-temporal`.** Exports:
```ts
export const Instant: Schema<string & Format<'temporal.Instant'>>     // '2026-11-10T09:30:00.000Z'
export const PlainDate: Schema<string & Format<'temporal.PlainDate'>> // '2026-11-10'
export const TimeZone: Schema<string & Format<'temporal.TimeZone'>>   // 'UTC', 'Europe/Berlin'
export const UTC: TimeZone
export const DateStyle: Schema<'short' | 'medium' | 'long' | 'full'>
export type TemporalError = KeelError<'temporal.outOfRange', { value: number }>
export function instantOf(ms: number): Result<Instant, TemporalError>
export function epochMs(i: Instant): number
export function plainDateOf(i: Instant, zone: TimeZone): PlainDate
export function addDays(d: PlainDate, days: number): Result<PlainDate, TemporalError>
export function formatDate(d: PlainDate, locale: Locale, style: DateStyle): string
export function formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string
```
No export reads the clock: the current instant is `instantOf(ctx.clock.now())`, so E1156 still sees `clock` in the module that asks. The TC39 `Temporal` global is absent from Node 22 and 24, and a polyfill costs over 20 kB, so the package does calendar arithmetic with `Date.UTC` and the `getUTC*` methods (years 0001 to 0099 through `setUTCFullYear`, since `Date.UTC` maps them to the 1900s) and formats with `Intl.DateTimeFormat`. The types are strings, so moving the implementation onto `Temporal` later changes no API. `TimeZone` validity asks `Intl.DateTimeFormat`, so a zone newer than a runtime's tzdata parses only where the runtime knows it (Known limits). App code:
```ts
// modules/kitchen/postRecipe.server.ts
const at = instantOf(ctx.clock.now())
if (!at.ok) return err(at.error)
const addedOn = plainDateOf(at.value, UTC)
// modules/recipes/RecipePage.tsx
<Text id="recipes.addedOn" lang={props.params.locale}>{formatDate(props.data.addedOn, props.params.locale, 'long')}</Text>
```

**`@keel/std-text`.** Exports:
```ts
export function line<Max extends number, Min extends number = 1>(o: { max: Max; min?: Min }): Schema<string & Format<`line(${Min}..${Max})`>>
export function para<Max extends number, Min extends number = 1>(o: { max: Max; min?: Min }): Schema<string & Format<`para(${Min}..${Max})`>>
export const Email: Schema<string & Format<'text.Email'>>
export const Slug: Schema<string & Format<'text.Slug'>>
export function graphemes(s: string): number
export function compareText(a: string, b: string, locale: Locale): -1 | 0 | 1
```
`line` and `para` are format types named by their bounds and not registered: each bound is its own type, and the registry holds one schema per name. Where `Intl.Segmenter` is missing, `graphemes` counts code points, which is never fewer than graphemes, so a value valid there is valid everywhere. Errors: none; a refused value is the schema rule `format`. App code:
```ts
// modules/recipes/Recipe.schema.ts
export const Recipe = s.object({ id: s.id('Recipe'), title: line({ max: 80 }), price: Money, addedOn: PlainDate, ... })
// modules/recipes/RecipeList.tsx (sorted for the reader's locale)
const sorted = computed(() => props.data.recipes.toSorted((a, b) => compareText(a.title, b.title, props.params.locale)))
```

**Determinism.** Every formatter is a pure function of its arguments and the runtime's ICU data. Two runtimes with different CLDR versions can differ in a character (a narrow no-break space before `PM` is the known case), so conformance compares each formatter with the `Intl` expression it names on the same runtime and pins exact strings only for the eval's locales and values, which have been stable across CLDR releases. The eval runs server and client render in one runtime, so its comparison is exact.

### 4. Exit proof and golden-2
The exit proof extends the existing `evals/tasks/golden-2` task (default 3): its TASK.md gains the values and its hidden `acceptance.test.ts` gains the assertions below, so `pnpm eval --task golden-2 --runner none --strict` is the proof and an agent build from scratch is held to the same bar.

**Fixture.** The api runs on a sim ctx with `clock.advance(1794303000000)` (2026-11-10T09:30:00.000Z). Two recipes are posted through it: "Pasta bake" with `{ amount: 1250, currency: 'EUR' }` and "Miso soup" with `{ amount: 1800, currency: 'JPY' }`. Both get `addedOn` `2026-11-10` from the api.

**Locales.** `en-US`, `de-DE`, `ja-JP`: two Latin-script locales with opposite separators and currency placement, and one CJK locale with its own date order and full-width yen.

**Screens and strings.** For each locale `L`, `renderRoute('recipes.index', { params: { locale: L } })` and `renderRoute('recipes.show', { params: { locale: L, recipeId } })` show these texts (` ` is a no-break space):

| Element | en-US | de-DE | ja-JP |
| --- | --- | --- | --- |
| `recipes.price.<pasta>`, `recipes.price` | `€12.50` | `12,50 €` | `€12.50` |
| `recipes.price.<soup>`, `recipes.price` | `¥1,800` | `1.800 ¥` | `￥1,800` |
| `recipes.added.<id>`, `recipes.addedOn` | `November 10, 2026` | `10. November 2026` | `2026年11月10日` |

The eval also asserts:
- each of those elements has `lang` equal to `L`;
- the node document for `/<L>` and `/<L>/recipes/<id>` (the `recipes` module served by a `node` test topology, as `test/ssrNode.test.ts` does) holds the same strings in the elements with those ids, so server and client output agree;
- for 20 generated `Money` values posted through the api, the index text equals `formatMoney(m, L)`;
- `/fr-FR` is a 404, and `/` (`recipes.home`) has Links `recipes.locale.en-US`, `recipes.locale.de-DE`, `recipes.locale.ja-JP` with text `English`, `Deutsch`, `日本語`, each with its own `lang`;
- a guest at `/de-DE/recipes/new` is redirected to `/de-DE` with `next` (K4).

**golden-2 changes** (Open question 3 decides whether they land):
- `package.json` and both `module.ts` files list `@keel/std-i18n`, `@keel/std-money`, `@keel/std-temporal`, `@keel/std-text`; `kitchen` adds capability `clock`.
- New: `recipes/AppLocale.schema.ts` (`s.enum(['en-US', 'de-DE', 'ja-JP'])`), `recipes/LocaleParams.schema.ts` (`{ locale: AppLocale }`), `recipes/LocalePicker.tsx` (route `recipes.home` at `/`, no layout).
- Routes move under the locale: `recipes.index` `/:locale`, `recipes.new` `/:locale/recipes/new`, `recipes.show` `/:locale/recipes/:recipeId`; `RecipeParams` gains `locale`; `BoxShell` reads `props.params.locale` for its links and shows a switcher to the same route in each locale.
- `Recipe` gains `price: Money` and `addedOn: PlainDate`; `RecipeDraft` gains `price: Money`; `kitchen/NewRecipe` gains both; `title` becomes `line({ max: 80 })` in all three.
- `postRecipe` mints `addedOn` as `plainDateOf` of `instantOf(ctx.clock.now())`'s value in `UTC`, returning its `err` if the clock is out of range; `addRecipe` copies both fields.
- `RecipeList` and `RecipePage` show the price and date elements above; `NewRecipePage` adds a number `Input` bound to `price.amount` (label `Price in cents or yen`) and a `Select` bound to `price.currency`.
- Tests and README move to the new paths; `.api.storage*` (git-ignored dev data) is deleted, since stored recipes lack the new fields.

## Alternatives
- **A formatting hook in k.ui** (the text op formats any registered type for the current locale). The hook needs a current locale, which is ambient (principle 2); a `Money` is a plain object, so the runtime cannot tell its type; and a second way to show a value would sit beside the function call (principle 1). The `Child` type already refuses an object as a child, so `{price}` is a type error today; `formatMoney(price, locale)` is the one path.
- **Values as integers with no kernel change** (`Instant` as epoch milliseconds, `PlainDate` as days since 1970). Exact and cheap, but every API body, store snapshot and session reads `20402` where a person or an agent expects `2026-11-10` (principle 9), and text types still need a predicate.
- **`s.string({ pattern })`.** A regex cannot check a calendar date or count graphemes, and an app-level pattern option is a second validation path beside stdlib types.
- **Ship CLDR data in std-i18n** instead of calling `Intl`. Identical bytes on every engine, at about 3 to 5 kB per locale and a data update duty per CLDR release. `Intl` is in every supported runtime at no bundle cost; the cost is the cross-engine character differences named under Determinism.
- **A `Temporal` polyfill.** Over 20 kB gzip in every bundle that shows a date, for an API the platform will ship.
- **`TimeZone` as a closed enum of IANA names.** Deterministic, but about 400 names: its `doc()` alone would exceed a spec section's token budget.
- **Keep `formatMoney(m)` and add `formatMoneyIn(m, locale)`.** Two ways to show an amount (default 2). The machine form of a `Money` is `Money.encode`.
- **E1758 as a std-i18n rule.** It would run only in modules that list the package, and an app with no stdlib would format with the host's locale unchecked. Principle 10 is a kernel promise.
- **A rule for untranslated copy** (JSX text in a module that lists std-i18n). No static test separates copy from a proper name such as `Keel` without a new marker; it belongs with message catalogs.
- **Fill guard redirect params in app code** (one guard per locale). The gap is any guard on a parameterized route, `/:org/...` as much as `/:locale/...`; default 1 asks for the kernel change.

## Spec diff
Measured as `ceil(chars / 4)`, the rule `tooling/budgets.mjs` uses. New conformance clauses are appended, so no clause number moves in the ledger; K4 and std.money edit one clause each in place. Citations such as `(rfc:0026)` are removed where a section needs room, which CLAUDE.md rule 11 asks for anyway.

### k.schema (1,239 to about 1,440)
- Primitives paragraph, after "Registry: `s.register(name, type)` for stdlib types." add: "**Format types.** `s.format(name, base, { check, gen, message })` narrows `base` (an `s.string` or `s.int`) by `check(v): boolean`: `parse` fails a value `base` accepts and `check` refuses with rule `format`. `s.infer` is `base`'s type branded `name`, as `s.id` brands. `encode` and `decodeStrings` are `base`'s; `gen` is `gen(fc)`, given fast-check; `doc()` is `name`; JSON Schema adds `format: name`; `message` is the one-line text forms show (k.forms). A package registers the types it names (`s.register`)."
- `Rule` list: after "`secret-missing` (the marker where a secret is required)" add "· `format` (a format type's `check` refused the value)".
- Rules: append "· E1106 `s.format` in app code (format types are stdlib's)".
- Conformance, appended: "For a fixture format type, every generated value parses, passes `check` and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; `s.format` in an app file is E1106."
- Trims: the five `rfc:` citations.

### k.check (1,404 to 1,486)
- Rules: E1757's entry ends with "outside `unsafe/`" and gains "· E1758 ambient locale or time zone in app code: `navigator.language` or `languages`; an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale; an `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`; a local-time getter (`getHours`, `getTimezoneOffset`, ...) on a `new Date(...)` value. Names resolve as for E1601."
- Conformance, appended: "`n.toLocaleString()`, `new Intl.DateTimeFormat('de-DE').format(d)`, `navigator.language` and `new Date(0).getHours()` are each one E1758; `a.localeCompare(b, 'de-DE')` is none."
- Trims: "; rfc:0023", "(rfc:0070)", "; rfc:0065", "RFC 0035 lists why the others cannot." (the clause names the fixtures that carry a fix), and the Budgets sentence "In the Keel repo: `keel check` on golden app 1 with 10 injected errors <= 600 tokens; `keel spec <id>` <= 1,500; spec map <= 1,200." (`tooling/budgets.json` and OUTPUT.md hold those numbers, and a conformance clause holds the first).

### k.ui (1,499 to 1,497)
- Base elements paragraph, before "`Box as` and `Text as` take closed sets" add: "Every base element takes `lang`, written as its `lang` attribute."
- Conformance, appended: "A base element with `lang="ja-JP"` has that attribute in server and client output."
- Trims: "(RFC 0009)", "; rfc:0062", "(rfc:0064)", "; rfc:0067", "(rfc:0043)", "(k.compiler URL policy)" after `Image src`, and "; this keeps `disabled` free as the boolean attribute on form controls and `Button`".

### k.router (1,498 to 1,497)
- Guards: "on `err` the request redirects to `redirect` with search `{ next: url }`" becomes "on `err` the request redirects to `redirect`, with the matched route's same-name params and search `{ next: url }`".
- Rules: E1508's "or (runtime) a guard redirect loop." becomes "or (runtime) a guard redirect loop or a missing `redirect` param."
- Conformance clause 5, in place: "A guard returning `err` redirects to its `redirect` route with `next` and the matched route's same-name params; no loader or route component runs."
- Trims: the example's `search: OrderSearch` and `errorElement: OrderError` (the text describes both fields), "(client navigation fetches results)" (k.server's Request flow says it), and "a statement after the manifest," after `routes.actions`.
- The static half of the check (a `redirect` route needing a param that a route holding the guard lacks) does not fit this section; it is backlog for the k.router split that the next k.router change forces.

### k.forms (1,154 to about 1,190)
- Validation: "Messages derive from `schema.invalid` issues (rule plus constraint)." gains "; a `format` issue shows its type's `message`".
- Conformance, appended: "A field of a format type whose `check` refuses the value shows that type's `message`."

### spec/std/std.i18n.md (new, 711 tokens)
~~~md
# std.i18n: Locales
status: proposed

**Extension points.** Schema type registry (k.schema `s.register`): importing `@keel/std-i18n` registers `i18n.Locale`. Check rule registry (k.check `defineRule`): `@keel/std-i18n/tools`, which `keel check` imports for a module whose `deps` list the package (k.module), registers E2501.

**API** (`@keel/std-i18n`; client-safe, no config).
```ts
import { Locale, formatNumber } from '@keel/std-i18n'
export const ShopLocale = s.enum(['en-US', 'de-DE', 'ja-JP'])   // ShopLocale.schema.ts: the locales the app serves
formatNumber(1234.5, props.params.locale)                         // de-DE: '1.234,5'
```
- `Locale` is `s.enum(['de-DE', 'en-GB', 'en-US', 'es-ES', 'fr-FR', 'it-IT', 'ja-JP', 'ko-KR', 'nl-NL', 'pt-BR', 'zh-CN'])`, registered as `i18n.Locale`; `type Locale = s.infer<typeof Locale>`. Each tag is a left-to-right language.
- Every `@keel/std-*` function that writes text for a person takes a `Locale` argument and reads no default.
- The locale is route data. An app declares the locales it serves once, as an `s.enum` of `Locale` tags in a `*.schema.ts` file, and a route that shows values carries it as a path param, `/:locale/...`; a locale the app does not serve is a 404 (k.router). Components read `props.params.locale` and pass it to children as a prop; loaders read `params.locale`. A test pins it through `renderRoute` `params` or `render` `props`; a session replays it from the `nav` event's `params`.
- `formatNumber(n: number, locale: Locale): string` is `new Intl.NumberFormat(locale).format(n)`: locale grouping and decimal sign, at most 3 fraction digits.

**Rules.** E2501 in a module whose `deps` list `@keel/std-i18n`: an `Intl` formatter constructed, or `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` or `localeCompare` called, with a locale argument (without one it is E1758, k.check). The message names the stdlib function to call: `formatNumber`, `formatMoney`, `formatDate`, `formatInstant` or `compareText`. No fix.

**Conformance.**
- After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw.
- `Locale.parse` accepts each of the 11 tags and rejects `en`, `de-de` and `fr-CA`, each with rule `enum`.
- For every generated finite `n` and every `Locale` `l`, `formatNumber(n, l)` equals `new Intl.NumberFormat(l).format(n)`; `formatNumber(1234.5, l)` is `1,234.5` for `en-US`, `1.234,5` for `de-DE` and `1,234.5` for `ja-JP`.
- With `@keel/std-i18n` in a module's `deps`, `keel check` reports one E2501 each for `new Intl.NumberFormat('de-DE')` and `a.localeCompare(b, 'de-DE')` in its files and none for them in a module without it; `n.toLocaleString()` reports E1758 and no E2501.
- The package root imports neither `@keel/check` nor `typescript`; `@keel/std-i18n/tools` exports the E2501 rule.
~~~

### spec/std/std.money.md (710 to about 790)
- Extension point: append "It depends on `@keel/std-i18n` for `Locale` (std.i18n)."
- API example: `formatMoney(price, props.params.locale)   // de-DE: '19,99 $'` replaces the import-only line's comment.
- The `formatMoney` bullet becomes: "`formatMoney(m, locale: Locale): string` is `new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(d)`, where `d` is the exact decimal string of `amount` at the currency's exponent (`{ amount: -5, currency: 'USD' }` gives `d` `'-0.05'`). `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE`, with U+00A0 before `€`."
- Conformance clause 7, in place: "For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`."

### spec/std/std.temporal.md (new, 1,050 tokens)
~~~md
# std.temporal: Dates and instants
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-temporal` registers `temporal.Instant`, `temporal.PlainDate` and `temporal.TimeZone`, format types (k.schema `s.format`) branded with those names. It depends on `@keel/std-i18n` for `Locale`.

**API** (`@keel/std-temporal`; client-safe, no config).
```ts
import { instantOf, plainDateOf, formatDate, UTC } from '@keel/std-temporal'
const at = instantOf(ctx.clock.now())                     // ok('2026-11-10T09:30:00.000Z')
if (at.ok) addedOn = plainDateOf(at.value, UTC)           // '2026-11-10'
formatDate(addedOn, props.params.locale, 'long')          // de-DE: '10. November 2026'
```
- `Instant` is `YYYY-MM-DDTHH:mm:ss.sssZ`, a UTC instant to the millisecond in years 0001 to 9999, as `Date.prototype.toISOString` writes it. One string per instant: `===` is equality and string order is time order.
- `PlainDate` is `YYYY-MM-DD`, a proleptic Gregorian date in years 0001 to 9999; string order is date order.
- `TimeZone` is `UTC` or an IANA name that `Intl.DateTimeFormat` accepts as `timeZone` and reports back unchanged in `resolvedOptions().timeZone`. `UTC` is exported as a `TimeZone`.
- `TemporalError` is `KeelError<'temporal.outOfRange', { value: number }>`.
- `instantOf(ms: number): Result<Instant, TemporalError>`: the instant `ms` milliseconds after 1970-01-01T00:00:00.000Z; a non-integer or a value outside years 0001 to 9999 is `temporal.outOfRange` with `value` `ms`. No function reads the clock: the current instant is `instantOf(ctx.clock.now())`.
- `epochMs(i: Instant): number` is the inverse of `instantOf`.
- `plainDateOf(i: Instant, zone: TimeZone): PlainDate` is the calendar date at `i` in `zone`.
- `addDays(d: PlainDate, days: number): Result<PlainDate, TemporalError>`: a non-integer `days`, or a result outside years 0001 to 9999, is `temporal.outOfRange` with `value` `days`.
- `DateStyle` is `s.enum(['short', 'medium', 'long', 'full'])`.
- `formatDate(d: PlainDate, locale: Locale, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' })` applied to `d` at 00:00 UTC.
- `formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style, timeZone: zone })` applied to `i`.
- Messages (k.forms): `Instant` "Must be a time like 2026-11-10T09:30:00.000Z", `PlainDate` "Must be a date like 2026-11-10", `TimeZone` "Must be a time zone like Europe/Berlin".

**Rules.** None. An ambient locale or time zone in app code is E1758 (k.check); `temporal.outOfRange` is a KeelError code (k.errors).

**Conformance.**
- After importing `@keel/std-temporal`, the registry maps `temporal.Instant`, `temporal.PlainDate` and `temporal.TimeZone` to the exports; importing it again does not throw.
- For every value `gen` produces for each of the three, `parse` accepts it and `parse(encode(v))` returns it; generated dates reach 0001-01-01, 9999-12-31 and February 29.
- `Instant.parse` rejects `2026-11-10T09:30:00Z`, `2026-02-30T00:00:00.000Z` and `2026-11-10T09:30:00.000+01:00`; `PlainDate.parse` rejects `2026-02-29`, `2026-1-5` and `0000-01-01` and accepts `2024-02-29`; `TimeZone.parse` rejects `Mars/Olympus` and `utc`. Each rejection has rule `format` at the value's path.
- For every generated integer `ms` in range, `instantOf(ms)` is `ok` and `epochMs` of its value is `ms`; `instantOf(1.5)` and `instantOf(253402300800000)` are `err` `temporal.outOfRange`.
- For every generated instant `i`, `plainDateOf(i, UTC)` is the first 10 characters of `i`; for `2026-11-10T23:30:00.000Z` it is `2026-11-11` in `Asia/Tokyo` and `2026-11-10` in `America/New_York`.
- For generated `d` and `n` whose results are in range, `addDays` of `addDays(d, n)`'s value and `-n` is `d`, and `addDays(d, 1)`'s value sorts after `d`.
- For every `Locale`, `DateStyle` and generated date, instant and zone, `formatDate` and `formatInstant` equal the `Intl` expressions above; `formatDate` of `2026-11-10` with `long` is `November 10, 2026` in `en-US`, `10. November 2026` in `de-DE` and `2026年11月10日` in `ja-JP`.
~~~

### spec/std/std.text.md (new, 899 tokens)
~~~md
# std.text: Text
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-text` registers `text.Email` and `text.Slug`, format types (k.schema `s.format`) branded with those names. It depends on `@keel/std-i18n` for `Locale`.

**API** (`@keel/std-text`; client-safe, no config).
```ts
import { line, para, Email, compareText } from '@keel/std-text'
export const Recipe = s.object({ title: line({ max: 80 }), notes: para({ max: 2000 }).optional(), by: Email })
props.data.recipes.toSorted((a, b) => compareText(a.title, b.title, props.params.locale))
```
- Text a person writes and reads (titles, names, notes) is `line` or `para`; `s.string` holds machine strings (codes, tokens, keys).
- `line({ min = 1, max })` is a format type over `s.string({ min })` named `line(<min>..<max>)`, not registered: the value is NFC (`v.normalize('NFC') === v`) and has no control character (Unicode `Cc`), no U+2028 or U+2029, no bidi embedding, override or isolate (U+202A to U+202E, U+2066 to U+2069), and `min` to `max` graphemes. `min` and `max` are integers with `0 <= min <= max` and `1 <= max <= 10000`; others throw. Message: "Must be `min` to `max` characters on one line".
- `para({ min = 1, max })` is `line` that also allows U+000A, named `para(<min>..<max>)`. Message: "Must be `min` to `max` characters".
- `Email` (`text.Email`) is ASCII `local@domain` of at most 254 characters: `local` is 1 to 64 characters of dot-separated atoms of letters, digits and ``!#$%&'*+/=?^_`{|}~-``; `domain` is two or more dot-separated labels of 1 to 63 letters, digits and inner hyphens, the last all letters. It is kept as written, with no case folding. Message: "Must be an email address".
- `Slug` (`text.Slug`) is 1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs. Message: "Must be lowercase letters and digits joined by hyphens".
- `graphemes(s: string): number` counts extended grapheme clusters with `Intl.Segmenter` (`granularity: 'grapheme'`); where `Intl.Segmenter` is missing it counts code points, never fewer than graphemes.
- `compareText(a: string, b: string, locale: Locale): -1 | 0 | 1` is the sign of `new Intl.Collator(locale).compare(a, b)`.

**Rules.** None. `localeCompare` without a locale is E1758 (k.check).

**Conformance.**
- After importing `@keel/std-text`, the registry maps `text.Email` and `text.Slug` to the exports; importing it again does not throw.
- For every value `gen` produces for `line({ max: 80 })`, `para({ max: 2000 })`, `Email` and `Slug`, `parse` accepts it and `parse(encode(v))` returns it; each `line({ max: 80 })` value has 1 to 80 graphemes, and `line({ max: 80 }).doc()` is `line(1..80)`.
- `line({ max: 3 })` accepts three `👨‍👩‍👧` (24 code units) and rejects four; it rejects `'a\nb'`, `'a‮b'`, `'a\u0007'` and `'é'` (not NFC) with rule `format` and `''` with rule `min`. `para({ max: 3 })` accepts `'a\nb'` and rejects `'a\r\nb'`.
- `line({ max: 0 })` and `line({ min: 2, max: 1 })` throw.
- `Email` accepts `a.b+c@example.co` and rejects `a@b`, `a..b@example.com`, `é@example.com`, `@example.com` and a 255-character address; `Slug` accepts `pasta-bake-2` and rejects `Pasta`, `-a`, `a--b` and `''`. Each rejection has rule `format`, or `min` for `''`.
- `graphemes('👨‍👩‍👧')` and `graphemes('é')` are 1; for generated strings `graphemes` equals the `Intl.Segmenter` segment count.
- For generated `a`, `b` and every `Locale` `l`, `compareText(a, b, l)` is the sign of `new Intl.Collator(l).compare(a, b)` and equals `-compareText(b, a, l)`; `compareText('ä', 'b', 'de-DE')` is `-1`.
~~~

### spec/00-map.md (orchestrator)
- Code ranges: add rows "| E230x | std.temporal | E240x | std.text |" and "| E250x | std.i18n | E260x | std.money |".
- Stdlib table: rows for std.i18n ("schema type registry and check rule registry: `i18n.Locale`, numbers, E2501"), std.temporal ("schema type registry: `temporal.Instant`, `PlainDate`, `TimeZone`, format"), std.text ("schema type registry: `text.Email`, `Slug`, `line`, `para`, collation"); std.money's line becomes "schema type registry: `money.Money`, add, format for a locale".
- spec/std/README.md gains "S2 (RFC 0079) adds std.i18n, std.temporal and std.text and changes std.money."

## Conformance diff
The conformance-writer for each lane writes these from the accepted spec text, skipped until implementation; the orchestrator writes the accepted text into `spec/` first.

- **Kernel.** Added: `packages/schema/conformance/format-type.test.ts`; `packages/check/conformance/E1106-format-in-app.test.ts`; `packages/check/conformance/E1758-ambient-locale.test.ts`; `packages/ui/conformance/lang-attribute.test.ts`; `packages/forms/conformance/format-message.test.ts`. Edited (rfc:0079): `packages/router/conformance/guard-denied-redirect.test.ts` (clause 5: params carried) and `packages/router/conformance/guard-redirect-loop-e1508.test.ts` (a missing `redirect` param is E1508).
- **std-i18n.** Added: `packages/std-i18n/conformance/registry.test.ts`, `locale-parse.test.ts`, `format-number.test.ts`, `e2501.test.ts`, `tools-split.test.ts`.
- **std-money.** Edited (rfc:0079): `packages/std-money/conformance/format.test.ts` (clause 7). The other five files are unchanged.
- **std-temporal.** Added: `packages/std-temporal/conformance/registry.test.ts`, `roundtrip.test.ts`, `parse-rejects.test.ts`, `instant-of.test.ts`, `plain-date-of.test.ts`, `add-days.test.ts`, `format.test.ts`.
- **std-text.** Added: `packages/std-text/conformance/registry.test.ts`, `roundtrip.test.ts`, `line-para.test.ts`, `email-slug.test.ts`, `graphemes.test.ts`, `compare-text.test.ts`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): `formatMoney` and `formatDate` injective per locale over generated inputs, `addDays` additive, `compareText` transitive on generated triples, `plainDateOf` monotonic in `i` for a fixed zone.

## Lanes
The orchestrator runs step 0 before the batch: it creates `packages/std-i18n`, `packages/std-temporal` and `packages/std-text` with a `package.json` each, sets the `tooling/deps.json` order, runs `pnpm install` at the root (the lockfile is orchestrator-owned), and writes the accepted spec text into `spec/`. Shared files stay with the orchestrator: `spec/00-map.md`, `spec/std/README.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `pnpm-lock.yaml`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`, `docs/ARCHITECTURE.md`.

| Lane | Owns | Needs from another lane | Verify |
| --- | --- | --- | --- |
| kernel | `packages/schema/**`, `packages/check/src/**`, `packages/check/conformance/**` (rfc:0079 files), `packages/ui/src/**`, `packages/router/src/**`, `packages/forms/src/internal/messageFor.ts`, `packages/store/src/internal/persisted.ts`, `packages/server/src/internal/runGuards.ts`, the harness guard path in `packages/testing/src/**` if it builds the redirect, `docs/adr/0068-s2-values-kernel.md`, kernel changesets | nothing; lands K1 (`s.format`, rule `format`) as its first commit, since std-temporal and std-text build on it | `pnpm --filter @keel/schema --filter @keel/check --filter @keel/ui --filter @keel/router --filter @keel/forms --filter @keel/store --filter @keel/server --filter @keel/testing run check` and the same with `run test` |
| std-i18n | `packages/std-i18n/**` | nothing; lands `Locale` as its first commit | `pnpm --filter @keel/std-i18n run check && pnpm --filter @keel/std-i18n run test` |
| std-money | `packages/std-money/**` | `Locale` from std-i18n | `pnpm --filter @keel/std-money run check && pnpm --filter @keel/std-money run test` |
| std-temporal | `packages/std-temporal/**` | K1 from kernel, `Locale` from std-i18n | `pnpm --filter @keel/std-temporal run check && pnpm --filter @keel/std-temporal run test` |
| std-text | `packages/std-text/**` | K1 from kernel, `Locale` from std-i18n | `pnpm --filter @keel/std-text run check && pnpm --filter @keel/std-text run test` |
| golden-2 | `apps/golden-2/**`, `evals/tasks/golden-2/**` | every package above, K3 (`lang`), K4 (guard params), K5 (form message) | `pnpm --filter golden-2 run check && pnpm --filter golden-2 run test && pnpm eval --task golden-2 --runner none --strict` |

Order: kernel and std-i18n start at once. std-money, std-temporal and std-text start when K1 and `Locale` are on the branch; until then a lane can write its code against the spec text, and only its tests wait. golden-2 runs last. That is five implementation agents and one kernel agent, at the top of PROGRAM.md's batch budget; std-money's change is small enough to fold into the std-i18n lane if the orchestrator wants four. Mutation runs (kernel packages) go alone after the batch. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, ledger diff, reviewer and red-team.

## Migration
- **Kernel callers.** `s.format`, rule `format`, `lang`, E1106 and E1758 are additions. A `switch` over `Rule` outside the kernel stops compiling until it handles `format`; none exists in `apps/`. No app code in this repository calls a locale API (`grep` of `apps/` for `toLocale`, `localeCompare`, `Intl.` and `navigator.language` is empty), so E1758 reports nothing on upgrade. A guard whose `redirect` route has no params behaves as before; one whose route has params threw at redirect time and now redirects or reports E1508.
- **`formatMoney`.** `formatMoney(m)` becomes `formatMoney(m, locale)`. No caller exists outside `packages/std-money`; its conformance clause 7 and `test/money.property.test.ts` change with it. A caller elsewhere passes the route's locale.
- **golden-2.** Needs the user (Open question 3). The changes are listed in Proposal 4; `.api.storage*` is deleted because stored recipes lack `price` and `addedOn`.
- **Docs.** `docs/ARCHITECTURE.md` names the stdlib packages beside wave 0; each new package gets a README in the std-money shape; the `keel` skill gains one line: values are formatted with `formatMoney`, `formatDate` or `formatNumber` and the route's `locale`.
- **ADR.** ADR-0068 records K1 to K5 when the user accepts this RFC.

## Token impact
Spec sections after the change, by the `budgets.mjs` rule, measured by applying the edits above to copies of the sections: k.schema about 1,440 (1,425 before E1106's Rules entry); k.check 1,486; k.ui 1,497; k.router 1,497; k.forms about 1,190; std.money about 790; std.i18n 711; std.temporal 1,050; std.text 899; spec map about 70 tokens more. Sections at or within 16 tokens of the 1,500 limit before this RFC: k.server 1,500, k.compiler 1,500, k.ui 1,499, k.module 1,499, std.sessions 1,498, k.router 1,498, k.store 1,495, k.runtime 1,493, k.ctx 1,489, k.cli 1,486, k.testing 1,485, k.errors 1,484. This RFC adds to two of them, k.ui and k.router, and pays for each with trims; k.check joins the list. A later change to k.ui, k.router or k.check needs a split, not a trim. The `keel` skill grows by about 40 tokens. Size budgets for `tooling/budgets.json`: `@keel/std-i18n` 1 kB, `@keel/std-i18n/tools` 3 kB node, `@keel/std-money` 1 kB, `@keel/std-temporal` 2 kB, `@keel/std-text` 1.5 kB; kernel growth estimates `@keel/schema` +0.2 kB (budget 5 kB), `@keel/check` +0.7 kB (33 kB), `@keel/ui` +0.05 kB (4 kB), `@keel/router` +0.05 kB (8.5 kB), `@keel/forms` +0.03 kB (5 kB).

## Known limits
- **Cross-engine bytes.** A browser on an older CLDR can write a value with a different space character than the server. Resume keeps the server's text; only an island that re-renders a value on the client shows the browser's form.
- **New time zones.** A zone newer than a runtime's tzdata parses only where the runtime knows it.
- **Money input.** golden-2 takes a price in minor units (cents or yen). Parsing `12,50 €` typed in a locale is a later std-money function (`parseMoney(text, currency, locale)`), not designed here.
- **Locale choice.** `/` offers the three locales as links; with no headers in loaders or guards, nothing picks one from `Accept-Language`.
- **Right-to-left.** No right-to-left locale is in `i18n.Locale` until k.ui has a `dir` story.

## Open questions
Each is a new hand-written user-facing API shape or a golden-app migration, so the user decides.

1. **Locale in the path.** Recommended: an app that serves several locales carries the locale as the first path param, `/:locale/...`, typed by an `s.enum` of `i18n.Locale` tags, and passes it as a prop and an argument. Alternative: an optional search key `?locale=` with a default. It changes every link: with the param, `routes.href` refuses a link without the locale; with the search key, no route path moves, and a link that omits the key silently shows the default locale.
2. **Message catalogs.** Recommended: not in S2. Page copy stays English, `<html lang>` stays `en`, and each formatted value carries its locale's `lang`; catalogs get their own RFC with the per-route head (backlog 0305), since both need a per-route document `lang` and catalogs also need translated server field errors. Alternative: S2 adds `messages(locales, catalog)` to std-i18n, a typed function `copy(locale, key, vars?)` with `{name}` placeholders and plural forms by `Intl.PluralRules`, and golden-2 translates its labels into German and Japanese. It changes the scope: the alternative adds about 1 kB to std-i18n, a k.router or k.server change for the document `lang`, and a translation pass over golden-2 and its eval.
3. **golden-2 migration.** Recommended: migrate golden-2 as Proposal 4 lists (routes under `/:locale`, `price` and `addedOn` on recipes, `title` as `line({ max: 80 })`, a locale picker at `/`) and update `evals/tasks/golden-2/TASK.md` and its acceptance suite to match, so the agent-build eval also covers S2. Alternative: leave golden-2's routes and data as they are and add a separate `prices` module with its own locale routes and fixture data. It changes which proof the exit runs: the alternative leaves existing tests and the build eval untouched, but the prices and dates sit in a module no other golden-2 screen uses.
4. **`lang` on every base element.** Recommended: every base element takes `lang` (one rule, matching HTML). Alternative: only `Text`, `Link` and `Box`. It changes how much of k.ui's type surface grows: the alternative is three props instead of ten, and a `Heading` or `Button` in another language would need a wrapping `Box`.

## Backlog lines that could ride along
- **0292** (golden-2 lane): add `keel check` to golden-2's own `check` script; the eval already runs it, so golden-2 is clean once the lane is.
- **0306** (kernel lane): `packages/server` tests print a happy-dom module-load stack; the kernel lane is in `packages/server` for `runGuards`.
- **0296** (kernel lane): Node globals type-check in client components; the kernel lane owns `packages/check/src` for E1758.
- **0305** (user decision, not this batch): per-route `<title>`; it pairs with the document `lang` in Open question 2.
