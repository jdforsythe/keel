# RFC 0079: S2 values: std-temporal, std-text, std-i18n, refined schema types and explicit-locale formatting

Status: proposed (stage S2 design RFC, task 0307). Applies WORKFLOW RFC default 1 (the stdlib needs a validated string type, so k.schema gains refined types instead of a workaround), default 2 (one way to show money: `formatMoney` moves to std-i18n and std-money keeps an exact decimal), default 3 (reuse the router's typed search, the capability registry and the eval harness), default 4 (the user's languages and zone stay in the browser: the capability reports no ctx event), default 6 (ambient locale and zone reads become kernel E1601, not documentation) and default 7 (the `@keel/check` size budget may need a re-base). The Open questions list what the defaults escalate: new hand-written API shapes and the golden-2 data change, each with a recommended answer the batch can proceed on.

## Problem
S2 adds dates, times, zones, durations, text and locale formatting beside `@keel/std-money`, and must show golden-2's prices and dates in three locales, proven by `pnpm eval`. Today the kernel cannot express these values honestly.

1. **No validated string type.** k.schema strings carry only `{ min, max }`. A date such as `2026-02-30`, a zone such as `Mars/Olympus` or a locale tag such as `en_US` cannot be rejected by a schema, so `parse`, `gen`, `decodeStrings` and JSON Schema would all accept garbage (principle 4). RFC 0047 kept the schema registry to named composites; a calendar date is not a composite of existing primitives.
2. **Ambient locale and zone.** `n.toLocaleString()`, `new Intl.NumberFormat()`, `a.localeCompare(b)`, `navigator.languages` and `new Intl.DateTimeFormat('de').format(d)` read the host's locale or zone. E1601 catches `Date.now` but none of these, so a server in one zone and a browser in another render the same value differently, and a test's output depends on the machine (principle 10). On Node, `new Intl.NumberFormat('xx')` silently resolves to the host default locale.
3. **One money format.** `formatMoney(m)` writes `-0.05 USD`. A locale-aware formatter beside it would be a second way to show money (default 2).
4. **No way to mark a region's language.** k.ui base elements take no `lang`, so a page that shows German prices on an English page has its numbers read by a screen reader in the wrong language (WCAG 3.1.2).
5. **golden-2 has no prices, dates or locale.** Its `Recipe` is `{ id, title, minutes, favorite }`; loaders see `{ params, search, url, caller, stores }`, not request headers.

Platform facts this RFC is built on, measured on the repository's Node (CI runs Node 22, `node-version: 22`; local Node 24.19.0; both ICU 78, CLDR 48): there is no `Temporal` global on either; `Intl.NumberFormat` formats exact decimal strings; `Intl.Segmenter`, `Intl.ListFormat`, `Intl.PluralRules`, `Intl.Collator`, `Intl.supportedValuesOf` and `Intl.Locale` exist on both; `Intl.DurationFormat` exists on Node 24 and not on Node 22. Node 22 and 24 give identical strings for every literal in this RFC's conformance clauses. Node has a `navigator` global (with the host's language) and no `window`.

## Proposal

### 1. Shape
- **Values are canonical strings.** Every temporal value is one ISO 8601 text, validated by a refined `s.string()`, so it serializes as itself, compares as a string, reads well in logs, sessions and stores, and equals what `<input type="date">` and `<input type="time">` give.
- **Formatting is a pure function of explicit arguments.** No package reads the host's locale or zone. A locale comes from the URL or from the `i18n` capability, through a loader, into props. The kernel gains no formatting hook (Alternatives).
- **Package split.** std-temporal and std-text are locale-free. std-i18n is everything that depends on a locale, including showing money and temporal values. std-money keeps value and arithmetic.
- **Dependency order** (`tooling/deps.json`, appended after `std-sessions`): `std-temporal`, `std-text`, `std-i18n`. std-i18n imports std-temporal and std-money, which come earlier. No kernel package imports any of them.

### 2. `@keel/std-temporal` (std.temporal)
One export per file under `src/`; `index.ts` re-exports only.

| file | export | kind |
| --- | --- | --- |
| `Instant.ts` | `Instant` | refined schema `temporal.Instant` and its type, registered on import |
| `PlainDate.ts` | `PlainDate` | refined schema `temporal.PlainDate`, registered |
| `PlainTime.ts` | `PlainTime` | refined schema `temporal.PlainTime`, registered |
| `TimeZone.ts` | `TimeZone` | refined schema `temporal.TimeZone`, registered |
| `Duration.ts` | `Duration` | refined schema `temporal.Duration`, registered |
| `TemporalRange.ts` | `TemporalRange` | type `KeelError<'temporal.range', { value: number }>` |
| `now.ts` | `now(ctx): Instant` | reads `ctx.clock.now()` |
| `inZone.ts` | `inZone(i, zone): { date: PlainDate; time: PlainTime }` | via `Intl.DateTimeFormat` `formatToParts` with an explicit `timeZone` and `hourCycle: 'h23'` |
| `addDays.ts` | `addDays(d, n): Result<PlainDate, TemporalRange>` | civil-day arithmetic, no `Date` |
| `addDuration.ts` | `addDuration(i, d): Result<Instant, TemporalRange>` | |
| `between.ts` | `between(a, b): Duration` | |
| `durationOf.ts` | `durationOf(ms): Duration` | throws on a non-integer or out-of-bounds `ms` |
| `durationMs.ts` | `durationMs(d): number` | |

- **Extension point.** Schema type registry (refined types, §6 K1). **Dependencies:** `@keel/schema`, `@keel/ctx`.
- **Codes.** KeelError `temporal.range` only. Diagnostic block E220x is reserved in the spec map; none is used.
- **Effects.** The clock comes only from `ctx.clock`. `inZone` passes `timeZone` explicitly; nothing reads the host zone or `Date.now`.
- **Not in S2.** Wall time to instant (DST gaps and overlaps), calendar durations (days, months), relative time ("3 days ago"), calendars other than ISO.

### 3. `@keel/std-text` (std.text)
| file | export | kind |
| --- | --- | --- |
| `line.ts` | `line({ min = 1, max }): Schema<Line>` | builder of a refined `s.string()` named `text.Line` |
| `Line.ts` | `Line` | type `Refined<string, 'text.Line'>` |
| `graphemes.ts` | `graphemes(s): number` | `Intl.Segmenter` grapheme granularity |
| `truncate.ts` | `truncate(s, max): string` | grapheme-safe, ends with `…` |
| `fold.ts` | `fold(s): string` | search key: NFKD, marks removed, lower case, NFC |

- **Extension point.** Schema type registry (refined types). `line` is a builder, so `text.Line` is a refinement name and is not registered: the registry maps a name to one schema, and each `max` is a different schema. **Dependencies:** `@keel/schema`.
- **Codes.** None; E230x is reserved.
- **Security.** `line` rejects bidirectional controls (U+202A to U+202E, U+2066 to U+2069), so a title cannot reorder the text around it.

### 4. `@keel/std-i18n` (std.i18n)
| file | export | kind |
| --- | --- | --- |
| `Locale.ts` | `Locale` | refined schema `i18n.Locale` and its type, registered on import |
| `negotiate.ts` | `negotiate(supported, wanted): L & Locale` | |
| `i18n.ts` | `i18n(ctx): Preferences` | capability `i18n` (k.ctx `register`) |
| `Preferences.ts` | `Preferences` | type `{ languages(): readonly string[]; timeZone(): TimeZone }` |
| `formatNumber.ts` | `formatNumber(n, locale)` | |
| `formatMoney.ts` | `formatMoney(m, locale)` | currency style over std-money `toDecimal(m)` |
| `formatDate.ts` | `formatDate(d, locale, style?)` | `PlainDate` |
| `formatTime.ts` | `formatTime(t, locale, style?)` | `PlainTime` |
| `formatInstant.ts` | `formatInstant(i, locale, zone, style?)` | `Instant` in a `TimeZone` |
| `formatDuration.ts` | `formatDuration(d, locale, style?)` | `Duration`, built from `Intl.NumberFormat` units and `Intl.ListFormat`, not `Intl.DurationFormat` (absent on Node 22) |
| `DateStyle.ts` | `DateStyle` | type `'short' \| 'medium' \| 'long' \| 'full'` |
| `plural.ts` | `plural(n, locale, forms)` | `Intl.PluralRules`, `#` replaced by the formatted number |
| `PluralForms.ts` | `PluralForms` | type |
| `collate.ts` | `collate(locale)` | comparator from `Intl.Collator` |

- **Extension points.** Capability registry (`i18n`) and schema type registry (`i18n.Locale`). **Dependencies:** `@keel/schema`, `@keel/ctx`, `@keel/std-temporal`, `@keel/std-money`.
- **Codes.** None; E240x is reserved. `negotiate` never fails for valid input; a `Locale` is supported by construction, so no format function has an expected failure.
- **Capability.** Real reads `navigator.languages` and the resolved zone only where `window` exists, at each call; on a server it gives `[]` and `UTC`, because the host's settings are not the user's (Node has a `navigator` with the host language, and `installServerDom` gives the server a `document`, so neither is a browser test). Shell delegates to real, as std-geo does. Sim gives `['en-US']` and `UTC` for every seed. The capability reports no ctx event and nothing it reads leaves the browser (default 4).
- **Caching.** Implementations may cache `Intl` formatters per locale and options; results are equal either way.
- **Messages.** Translated UI strings are a plain module per locale typed `Record<L, Messages>` against the negotiated `L`. std-i18n adds no catalog format (Alternatives: ICU MessageFormat).

### 5. `@keel/std-money` changes (default 2)
- `formatMoney(m)` (`-0.05 USD`) is removed. Showing money to a person is std-i18n `formatMoney(m, locale)`, the one formatter.
- `toDecimal(m): string` is added (`src/toDecimal.ts`): the exact amount in major units, `-0.05` and `1234`, with no code and no grouping. It is the exponent knowledge std-i18n needs to hand `Intl.NumberFormat` an exact decimal string, and the form a CSV or payment API takes. The exponent table moves from `formatMoney.ts` to `toDecimal.ts`.
- `Money`, `Currency`, `addMoney` and `MoneyError` are unchanged. No app imports `formatMoney` (checked across `apps/` and `packages/`), so nothing migrates. Conformance clause 7 is edited in place (same number).

### 6. Kernel changes (one kernel agent)

**K1. k.schema refined types** (default 1).
- **Change.** `s.refine(name, inner, { check, gen: { from, map } })` returns `Schema<Refined<T, N>>`. `Refined<T, N>` is a new exported type, `T & { readonly __refined: N }`, distinct from `Id<B>`. `Node` gains `{ kind: 'refine', name, inner }`; the `check` and the `gen` mapping are held beside the node in memory (keyed by node identity), so nodes stay plain JSON. `Rule` gains `format`.
- **Derivations.** `parse`: `inner`, then `check` (a throw counts as false), failing with `format` at the path. `encode`, `decodeStrings`: `inner`'s. `doc()`: the name. JSON Schema (router, cli and services each derive one): `inner`'s plus `format: name`. `gen`: `gen(from).map(map)`, filtered by `parse` as every generator already is, so a refined type never relies on rejection sampling of random strings. k.forms messages: rule `format` reads `Invalid value`.
- **Why a kernel change.** RFC 0047 rejected a pluggable primitive kind because every derivation would need a hook. A refinement has one hook (a predicate) plus a generator mapping; every other derivation is `inner`'s, and the node set stays closed with one new member. A `pattern` option cannot say "a real calendar day" or "a zone this platform knows".
- **Walkers to update.** Every exhaustive switch over `Node`: `schema` (parse, gen, doc, `fromStrings`), `forms` (`coerceText`, `unwrap`, `nodeAt`, `encodeEntries`, `messageFor`), `router` (`unwrapNode`, `fieldsOf`, `nodeAt`, `jsonSchemaOf`, `messageFor`), `cli` (`fieldsOf`, `toJsonSchema`), `services` (`openapi/internal/jsonSchemaOf`), `store` where it walks nodes. TypeScript's exhaustiveness check finds each.
- **ADR-0068** "Refined schema types": context (problem 1), decision (as above), alternatives (pluggable kind, `pattern`, stdlib-private validation), consequences (one new node kind; JSON Schema `format`; a serialized node loses its check).
- **Migration.** None for apps. Code outside the kernel that switches over `Node` (none in the repository) adds a `refine` case.

**K2. k.ctx E1601 covers the host locale and zone** (defaults 6 and 1).
- **Change.** E1601 also reports `navigator.language`/`languages`; an `Intl` constructor with no locale or `undefined`; `Intl.DateTimeFormat` with no object-literal `timeZone` option; a `toLocale*` call with no argument; `localeCompare` with one argument. There is no fix: the exact equivalent is a stdlib function, and the kernel does not name stdlib. Implemented in `packages/check/src/rules/noAmbientCapability.ts` with the existing name resolution (globals, computed keys, same-file aliases).
- **Why kernel.** A std-i18n rule (E24xx) would fire only in apps that install std-i18n, and the ambient read is a nondeterminism bug in any app (principle 10, default 6).
- **ADR-0069** "Ambient locale and zone reads are E1601".
- **Migration.** None: no file under `apps/` or the scaffold templates uses any of these forms. An app that does gets E1601 and moves to std-i18n with an explicit locale.

**K3. k.ui `lang` on `Box` and `Text`** (Open question 6).
- **Change.** `Box` and `Text` take `lang`, a BCP 47 tag string or a signal of one, written as the `lang` attribute; a signal makes the element bound, like a style prop. No validation in k.ui (it cannot import std-i18n); a `Locale` from std-i18n is the intended value.
- **Why.** WCAG 3.1.2 (language of parts). It is the only k.ui change S2 needs; the expected "formatting hook" is rejected under Alternatives.
- **ADR-0070** "A base element region carries its language".
- **Migration.** None (additive).

**Not changed.** k.router and k.server (loaders keep `{ params, search, url, caller, stores }`; Open question 8), k.component, k.forms text, k.testing.

### 7. golden-2 and the exit proof
**App changes** (golden-2 lane; Open question 7).
- `Recipe` gains `added: Instant` (required) and `price: Money.optional()`; `NewRecipe` (the api body) gains `price: Money.optional()`. `postRecipe` stamps `added` with `now(ctx)` on the api ctx. The web form is unchanged: price entry needs locale-aware decimal input, which S2 does not add.
- `modules/recipes/locales.ts` exports `locales = ['en-US', 'de-DE', 'ja-JP'] as const`. `RecipeSearch` and the `recipes.show` route's search gain `locale: Locale.optional()`.
- `loadIndex` and `loadRecipe` return `locale: negotiate(locales, [search.locale, ...i18n(ctx).languages()])` and `zone: i18n(ctx).timeZone()` with their data. Links between recipe pages carry `locale`.
- `RecipeList` renders its list in `Box id="recipes.list" lang={data.locale}`; per recipe `recipes.price.<id>` (`formatMoney`, only when `price` is set), `recipes.added.<id>` (`formatInstant(r.added, locale, zone, { date: 'medium' })`) and `recipes.minutes.<id>` (`formatDuration(durationOf(r.minutes * 60000), locale)`, which is `5 min` in `en-US`, the text the golden-2 eval already asserts). It also shows links `recipes.locale.<tag>` to `recipes.index` with each `locale`.
- `RecipePage` shows `recipes.price` and `recipes.added` the same way.

**Locales.** `en-US`, `de-DE`, `ja-JP`: decimal point and prefix symbol; decimal comma, `.` grouping and a suffix symbol after a no-break space; CJK with a full-width yen sign and year-first dates. Every price and date string differs between `en-US` and `de-DE`, and every date and the yen price differ for `ja-JP`.

**Choosing the locale.** Per request from the URL (`?locale=de-DE`), which is addressable and testable (principle 3, default 3: the router's typed search). Without it, the browser's languages through `i18n(ctx)`; under sim, `en-US`. `de-AT` negotiates to `de-DE`. The zone is the browser's (sim and server: `UTC`).

**Server and client.** `web` is a client deployable, so a browser renders the strings. The proof renders the same routes both ways: through `renderRoute` with a client sim ctx, and server-side through a test topology with `web` as a `node` deployable, as `test/ssrNode.test.ts` already does. Both must give the same strings, which holds because formatting reads only its arguments.

**Eval.** New task `evals/tasks/golden-2-locales/` (`TASK.md`, `spec-slice.txt` naming std.i18n, std.temporal, std.money, k.ui, k.ctx, `task.json` `{ "skill": "keel" }`, `pass.ts`, hidden `acceptance.test.ts`), graded like `golden-2`: the files exist, no banned patterns, `pnpm --filter golden-2 check`, `keel check`, the app's tests, the ledger diff for scope `golden-2:`, then the hidden suite. The hidden suite:
1. Builds the api over a sim ctx (seed 7), calls `advance(1794319380000)` (2026-11-10T14:03:00.000Z), and posts Soup (30 minutes, EUR 1250), Ramen (90 minutes, JPY 1200) and Toast (5 minutes, no price).
2. For each locale renders `recipes.index` with `search: { locale }` and asserts:

| id | `en-US` | `de-DE` | `ja-JP` |
| --- | --- | --- | --- |
| `recipes.price.<soup>` | `€12.50` | `12,50 €` | `€12.50` |
| `recipes.price.<ramen>` | `¥1,200` | `1.200 ¥` | `￥1,200` |
| `recipes.added.<soup>` | `Nov 10, 2026` | `10.11.2026` | `2026/11/10` |
| `recipes.minutes.<ramen>` | `1 hr, 30 min` | `1 Std., 30 Min.` | `1 時間 30 分` |
| `recipes.minutes.<toast>` | `5 min` | `5 Min.` | `5 分` |

3. Without `locale` the strings are the `en-US` column; with `locale: 'de-AT'` they are the `de-DE` column; Toast has no `recipes.price.<toast>`.
4. Server-side, `GET /?locale=de-DE` with `accept: text/html` returns HTML containing `lang="de-DE"` on `recipes.list` and the `de-DE` strings above.
5. The existing `golden-2` eval still converges.

`pnpm eval --task golden-2-locales` with `converged=true` (runner `none`) is the S2 exit. The orchestrator commits the result file under `evals/results/`.

### 8. Lanes
**Before the batch (orchestrator).** Apply the spec diff below, write ADR-0068 to ADR-0070, add the three `tooling/deps.json` entries and the `tooling/budgets.json` size entries, create the three package skeletons (`package.json` with the dependencies in §2 to §4, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, empty `src/index.ts`, `conformance/`, `unsafe/` copied from std-money), add `@keel/std-money`, `@keel/std-temporal` and `@keel/std-i18n` to `apps/golden-2/package.json`, and run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Then one `conformance-writer` per lane writes its suite from the spec text, skipped until implementation.

**Order inside the batch.** K1 lands first as its own commit (`@keel/schema` only: `s.refine`, `Refined`, rule `format`, `gen`); std-temporal, std-text and std-i18n need it to run their tests. std-money is independent. std-i18n needs std-temporal's five schemas and `toDecimal`, which those lanes land as their first commits. golden-2 starts with its schemas, kitchen changes and the eval task, and finishes last.

| lane | owns (exclusive) | depends on | verification |
| --- | --- | --- | --- |
| kernel | `packages/schema`, `forms`, `router`, `cli`, `services`, `store` (node walks only), `check` (E1601), `ui` (`lang`), and `compiler` if bound-element detection needs `lang`; kernel conformance files below | none | `pnpm --filter @keel/schema --filter @keel/forms --filter @keel/router --filter @keel/cli --filter @keel/services --filter @keel/store --filter @keel/check --filter @keel/ui test`; root `pnpm check`; mutation on `@keel/schema` alone |
| std-temporal | `packages/std-temporal/**` | K1 | `pnpm --filter @keel/std-temporal check && pnpm --filter @keel/std-temporal test` |
| std-text | `packages/std-text/**` | K1 | `pnpm --filter @keel/std-text check && pnpm --filter @keel/std-text test` |
| std-money | `packages/std-money/**` | none | `pnpm --filter @keel/std-money check && pnpm --filter @keel/std-money test` |
| std-i18n | `packages/std-i18n/**` | K1, std-temporal schemas, `toDecimal` | `pnpm --filter @keel/std-i18n check && pnpm --filter @keel/std-i18n test` |
| golden-2 | `apps/golden-2/**`, `evals/tasks/golden-2-locales/**` | every lane | `pnpm --filter golden-2 check && pnpm --filter golden-2 test && pnpm eval --task golden-2 && pnpm eval --task golden-2-locales` |

Orchestrator-only: `spec/00-map.md` status lines, `spec/**` text after the acceptance commit, `docs/ARCHITECTURE.md`, `docs/adr/**`, `tooling/deps.json`, `tooling/budgets.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec section reports it; it does not edit `spec/`. That is five lanes and one kernel agent, one over the program's per-batch budget; std-money and std-i18n can run as one agent, since `formatMoney` moves between them.

### 9. S1 leftovers (plan decision D1)
- **0291** (check: the type pass's Node declarations slow fresh programs): the kernel lane touches `packages/check`, so it takes 0291 as its last step, after K1 to K3 are green; if it does not fit, it stays in the backlog.
- **0292** (no app's `check` runs `keel check`): the golden-2 lane makes golden-2's `check` script run `keel check`; the apps/sessions findings stay in 0292.
- **0296** (Node globals in client components): needs a new rule with its own spec text and code, a design decision this RFC does not make; it waits.
- **0281, 0282, 0287 to 0290** (runtime-dom, reactive, store leads), **0302, 0303** (std-sessions), **0304, 0306** (server, compiler): no S2 lane touches those packages; they wait.

## Alternatives
- **Platform `Temporal` or a polyfill.** Neither Node 22 nor Node 24 has `Temporal`, Safari does not ship it, and a polyfill costs 20 to 50 kB gzip per app. Canonical strings plus `Intl` cover the S2 contract in about 2 kB.
- **Temporal values as objects (`{ year, month, day }`) or epoch numbers.** Objects are verbose in JSON, sessions and logs, do not compare with `<`, and differ from the form inputs' values. A number cannot tell an instant from a duration and reads as noise in a session.
- **A k.ui formatting hook** (`<Text value={price} format="money" />`, or a formatter registry that k.ui consults). It is a second way to render text beside a string child (default 2), and a registered formatter would change what a component renders from another file (principle 2). A function call returning a string needs no hook.
- **The locale on `ctx` (`ctx.locale`) or a locale provider.** A ctx belongs to an app, not to a request, so a per-request locale on it is a kernel redesign; a provider is action at a distance (principle 2). Explicit arguments keep every format call pure and testable.
- **A pluggable schema kind** (RFC 0047's rejected option). Refinement keeps one closed node set and takes every derivation from `inner`; only `check` and the generator mapping are supplied.
- **`s.string({ pattern })`.** A regular expression cannot express a real calendar day or a platform's zone list, and an author-supplied pattern is a ReDoS risk at `parse`.
- **ICU MessageFormat catalogs.** A parser costs 5 to 10 kB and adds a second string language that TypeScript cannot check. Typed modules per locale plus `plural` cover S2.
- **A std-i18n check rule for ambient locale reads.** It would only run in apps that install std-i18n (default 6).
- **`formatMoney(m, locale)` staying in std-money.** std-money would import std-i18n's `Locale`, and money would be the one value formatted outside std-i18n.
- **Locale from `Accept-Language` now.** Needs a new loader argument in k.router and k.server, both at the 1,500-token section limit, and the exit proof does not need it (Open question 8).
- **`Intl.DurationFormat`.** Absent on Node 22, which CI runs.
- **Locale in `ctx.storage` or a cookie.** Not addressable: a link cannot carry it, and the eval would need a write before every render.

## Open questions
The defaults escalate these: each is a new hand-written API shape or a golden-app data change. Each has a recommendation the batch proceeds on unless the user says otherwise.
1. **`s.refine`, `Refined<T, N>` and rule `format` in k.schema** (K1). Recommended: accept as written. Alternative: keep refinement private to stdlib packages, which leaves app schemas unable to validate a date.
2. **std-temporal's surface** (§2): canonical ISO strings branded by type; `now`, `inZone`, `addDays`, `addDuration`, `between`, `durationOf`, `durationMs`. Recommended: accept. Alternative: objects, rejected above.
3. **std-i18n's surface** (§4): explicit `locale` and `zone` on every format function, `negotiate` over a `const` tuple, the `i18n` capability, `plural` with `#`, no catalog type. Recommended: accept.
4. **std-text's surface** (§3): `line`, `graphemes`, `truncate`, `fold`. Recommended: accept.
5. **std-money `formatMoney(m)` replaced by `toDecimal(m)`**, with locale formatting in std-i18n (§5). Recommended: accept (default 2); nothing migrates.
6. **k.ui `lang` on `Box` and `Text`** (K3). Recommended: accept. Alternative: no `lang`, and golden-2's localized regions are read in the page's language.
7. **golden-2 data change** (§7): `Recipe` gains required `added` and optional `price`; a developer's `.api.storage` from before the change no longer parses and is deleted. Recommended: accept; the golden-2 eval's api body stays `{ title, minutes }`.
8. **Server-side locale negotiation** (`Accept-Language` as a loader argument, k.router and k.server). Recommended: not in S2; a backlog line for a later stage. Node-rendered pages take the locale from the URL until then.

## Spec diff
Measured as `ceil(chars / 4)`, the rule `tooling/budgets.mjs` uses, on the full proposed files. New kernel clauses are appended, so no clause renumbers. Kernel trims are non-normative: citations, rationale, example tokens and restatements of a clause.

### New sections
std.temporal (1,209), std.text (691), std.i18n (1,403). Status `proposed`; the orchestrator flips them as conformance lands.

````md
# std.temporal: Dates and times
status: proposed

**Extension point.** Schema type registry (k.schema `s.refine`, `s.register`). Importing `@keel/std-temporal` registers `temporal.Instant`, `temporal.PlainDate`, `temporal.PlainTime`, `temporal.TimeZone` and `temporal.Duration`. Each is a refined `s.string()` whose value is one canonical ISO 8601 text: `encode` is the identity, equal values are equal strings, and two `Instant`s or two `PlainDate`s compare in time order as strings (`a < b`). The clock is read only through `ctx.clock` (k.ctx); no export reads the host time zone.

**API** (`@keel/std-temporal`).
```ts
import { Instant, PlainDate, TimeZone, now, inZone, addDays, between, durationOf } from '@keel/std-temporal'
const at = now(ctx)                         // '2026-11-10T14:03:00.000Z'
const { date, time } = inZone(at, zone)     // '2026-11-10', '15:03' in 'Europe/Berlin'
```
- `Instant`: `YYYY-MM-DDTHH:MM:SS.sssZ` (the form `Date.prototype.toISOString` gives), UTC, years 0001 to 9999.
- `PlainDate`: `YYYY-MM-DD`, a proleptic Gregorian date, years 0001 to 9999 (the value of `<input type="date">`).
- `PlainTime`: `HH:MM`, `00:00` to `23:59` (the value of `<input type="time">`).
- `TimeZone`: a name the platform's `Intl.DateTimeFormat` accepts as `timeZone` (`UTC`, `Europe/Berlin`).
- `Duration`: exact elapsed time in whole milliseconds, at most 1e15 either way. Zero is `PT0S`; any other value is an optional `-`, `PT`, then `<h>H` if at least an hour, `<m>M` if the minutes (1 to 59) are nonzero, and `<s>S` or `<s>.<mmm>S` if the seconds (0 to 59) or milliseconds are nonzero: `PT1H30M`, `-PT0.500S`. No days, months or years.
- `now(ctx): Instant`: `ctx.clock.now()`, rounded down to the millisecond.
- `inZone(i, zone): { date: PlainDate; time: PlainTime }`: the wall date and minute of `i` in `zone`.
- `addDays(d, n): Result<PlainDate, TemporalRange>` for a safe integer `n`.
- `addDuration(i, d): Result<Instant, TemporalRange>`; `between(a, b): Duration` is `b` minus `a`.
- `durationOf(ms): Duration` for an integer within the bounds, and `durationMs(d): number`, its inverse. Any other `ms` throws (unexpected), as `encode` of an invalid value does.
- `TemporalRange` is `KeelError<'temporal.range', { value: number }>`: a result past year 9999 or before year 0001, or a non-integer `n`; `value` is `n` for `addDays` and the result in epoch milliseconds for `addDuration`.

**Rules.** None (no diagnostics; codes E220x are reserved). `temporal.range` is a KeelError code (k.errors). Locale formatting of these values is std.i18n.

**Conformance.**
- After importing `@keel/std-temporal`, `s.registry().get('temporal.<T>')` is the exported `<T>` for the five types; importing it again does not throw.
- For each of the five types, every value `gen` produces parses, `encode` returns it unchanged, and `doc()` is its registered name.
- `Instant.parse(v)` is `ok` exactly when `v` is a string, `new Date(v).toISOString() === v` and the year is 0001 to 9999; `2026-11-10T14:03:00Z`, `2026-11-10T14:03:00.000+01:00` and `2026-02-30T00:00:00.000Z` fail with rule `format`, `0` with rule `type`.
- `PlainDate` accepts `2024-02-29` and `9999-12-31`, and fails `2023-02-29`, `2026-1-05`, `0000-01-01` and `2026-13-01` with rule `format`; `PlainTime` accepts `00:00` and `23:59`, and fails `24:00`, `9:05`, `12:60` and `12:00:00`.
- `TimeZone` accepts `UTC`, `Europe/Berlin`, `Asia/Tokyo` and `America/St_Johns`, and fails `Mars/Olympus` and `""` with rule `format`.
- For every integer `ms` within 1e15 either way, `durationOf(ms)` parses and `durationMs(durationOf(ms))` is `ms`; `durationOf(0)` is `PT0S`, `5400000` is `PT1H30M`, `-500` is `-PT0.500S`; `Duration` fails `PT90M`, `PT0.5S`, `P1D` and `-PT0S`; `durationOf(0.5)` throws.
- For generated `Instant`s `a`, `b`, `a < b` exactly when `Date.parse(a) < Date.parse(b)`; the same holds for generated `PlainDate`s.
- Under a sim ctx, `now(ctx)` is `1970-01-01T00:00:00.000Z`, and after `advance(1794319380000.7)` it is `2026-11-10T14:03:00.000Z`.
- `inZone(i, 'UTC')` is `{ date: i.slice(0, 10), time: i.slice(11, 16) }` for every generated `i`; in `Europe/Berlin`, `2026-03-29T00:59:59.999Z` gives `2026-03-29`, `01:59` and `2026-03-29T01:00:00.000Z` gives `03:00`; in `Asia/Tokyo`, `2026-11-10T23:30:00.000Z` gives `2026-11-11`, `08:30`.
- `addDays(d, n)` then `addDays(_, -n)` gives back `d` whenever both are `ok`; `addDays('2024-02-28', 1)` is `2024-02-29`; `addDays('9999-12-31', 1)` is `err` `temporal.range` with `value` 1.
- For generated `a`, `b`, `addDuration(a, between(a, b))` is `ok` `b`, and `durationMs(between(a, b))` is `Date.parse(b) - Date.parse(a)`; a result past 9999 is `err` `temporal.range`.
- With `process.env.TZ` set to `Pacific/Kiritimati` and then `America/Adak`, every export returns equal results for equal arguments.
````

````md
# std.text: Text values
status: proposed

**Extension point.** Schema type registry (k.schema `s.refine`): `line(opts)` builds a refined `s.string()` named `text.Line`. Every export is independent of locale and host; what depends on a locale (collation, plurals) is std.i18n. A grapheme is an extended grapheme cluster (Unicode UAX #29), what a reader counts as one character.

**API** (`@keel/std-text`).
```ts
import { line, graphemes, truncate, fold } from '@keel/std-text'
export const Title = line({ max: 80 })       // in a *.schema.ts file
truncate('Crème brûlée', 6)                  // 'Crème…'
```
- `line({ min = 1, max }): Schema<Line>`: one line of text in Unicode NFC, with no control character (category Cc), no line or paragraph separator (Zl, Zp), no bidirectional control (U+202A to U+202E, U+2066 to U+2069), no leading or trailing white space, and `min` to `max` graphemes. `min` and `max` are integers with `0 <= min <= max` and `max >= 1`; other bounds throw when `line` is called. `type Line = Refined<string, 'text.Line'>`.
- `graphemes(s): number`: the number of graphemes in `s`.
- `truncate(s, max): string`: `s` when it has at most `max` graphemes; otherwise its first `max - 1` graphemes with trailing white space removed, then `…` (U+2026). `max` is an integer >= 1; any other throws.
- `fold(s): string`: the search key of `s`: NFKD, combining marks (Mn) removed, `toLowerCase()`, then NFC. Two texts that differ only in case, accents or compatibility forms fold to the same key.

**Rules.** None (no diagnostics; codes E230x are reserved).

**Conformance.**
- For `line({ max: 1 })`, `line({ max: 80 })` and `line({ min: 0, max: 3 })`, every value `gen` produces parses, round-trips and has `min` to `max` graphemes; `doc()` is `text.Line`.
- `line({ max: 80 })` fails each of `" a"`, `"a "`, `"a\nb"`, `"a\tb"`, `"a b"`, `"é"` (not NFC), `"a‮b"` and 81 `x`s with rule `format`, and accepts `"é"` and `"👩‍👩‍👧"`; `line({ max: 1 })` accepts `"👩‍👩‍👧"`; `line({ max: 0 })` and `line({ min: 2, max: 1 })` throw.
- `graphemes` is 1 for `"👩‍👩‍👧"` and for `"é"`, 0 for `""`, and `s.length` for every generated ASCII string.
- For every generated string `s` and `max` from 1 to 20: `graphemes(truncate(s, max)) <= max`; `truncate(s, max) === s` exactly when `graphemes(s) <= max`; otherwise the result ends with `…` and the graphemes before it are the first graphemes of `s`, none split.
- For every generated string `s` of ASCII letters, digits, spaces and `àÀéÉüÜçÇñÑåÅ`, `fold(fold(s))` is `fold(s)` and `fold(s.toUpperCase())` is `fold(s)`; `fold('Crème Brûlée')` is `creme brulee` and `fold('ÅNGSTRÖM')` is `angstrom`.
- With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.
````

````md
# std.i18n: Locales and formatting
status: proposed

**Extension points.** Capability registry (k.ctx `register`): `i18n`, the user's languages and time zone. Schema type registry (k.schema `s.refine`): importing `@keel/std-i18n` registers `i18n.Locale`. Every format function is pure: the locale and, for an instant, the zone are arguments, never read from the host, so a server and a browser given equal arguments render equal text on equal Unicode CLDR data.

**API** (`@keel/std-i18n`).
```ts
import { negotiate, i18n, formatMoney, formatInstant } from '@keel/std-i18n'
const locale = negotiate(['en-US', 'de-DE', 'ja-JP'], [search.locale, ...i18n(ctx).languages()])
formatMoney({ amount: 125000, currency: 'EUR' }, locale)    // de-DE: '1.250,00 €'
formatInstant(recipe.added, locale, i18n(ctx).timeZone(), { date: 'medium' })
```
- `Locale`: a canonical BCP 47 tag (`Intl.getCanonicalLocales(v)` is `[v]`) that `Intl.DateTimeFormat`, `Intl.NumberFormat` and `Intl.PluralRules` each support (`supportedLocalesOf(v)` keeps it), so formatting never falls back to the host's locale. `type Locale = Refined<string, 'i18n.Locale'>`.
- `negotiate(supported, wanted): L & Locale`: `supported` is a non-empty tuple of `Locale` tags `L` (any other tag throws). For each `wanted` entry in order, skipping `undefined` and non-`Locale` entries: the supported tag equal to it, else the first supported tag with its language subtag (`de-AT` picks `de-DE`). When no entry matches, `supported[0]`.
- `i18n(ctx): Preferences`, `{ languages(): readonly string[]; timeZone(): TimeZone }`. Real where `window` exists (a browser), read at each call: `navigator.languages` and the zone `Intl.DateTimeFormat` resolves (`UTC` if that is not a `TimeZone`). Real elsewhere (a server): `[]` and `UTC`. Shell: real. Sim, for every seed: `['en-US']` and `UTC`.
- `formatNumber(n, locale)`: `Intl.NumberFormat` decimal style.
- `formatMoney(m, locale)`: `Intl.NumberFormat` currency style for `m.currency`, formatting the exact decimal string std.money `toDecimal(m)` gives, so no amount passes through a float.
- `formatDate(d, locale, style = 'medium')`, `formatTime(t, locale, style = 'short')`: `dateStyle` or `timeStyle` with zone `UTC`, so the value is shown as written. `DateStyle` is `'short' | 'medium' | 'long' | 'full'`.
- `formatInstant(i, locale, zone, { date?, time? } = { date: 'medium', time: 'short' })`: `dateStyle` and `timeStyle` in `zone`.
- `formatDuration(d, locale, style = 'short')`: the nonzero hours, minutes and seconds (with the millisecond fraction) of `d`, each `Intl.NumberFormat` unit style with `unitDisplay` `style` (`'long' | 'short' | 'narrow'`), joined by `Intl.ListFormat` `type: 'unit'`; a negative `d` signs its first unit; `PT0S` is zero seconds.
- `plural(n, locale, forms)`: `forms` is `PluralForms`, `{ other: string }` plus optional `zero`, `one`, `two`, `few`, `many`. It returns the form `Intl.PluralRules(locale).select(n)` names, else `other`, with each `#` replaced by `formatNumber(n, locale)`.
- `collate(locale): (a: string, b: string) => number`: `Intl.Collator(locale).compare`, for `sort`.

An app's translated strings are a plain module per locale, typed `Record<L, Messages>` against the `L` it negotiates; std-i18n adds no catalog format.

**Rules.** None (no diagnostics; codes E240x are reserved). Reading the host's locale or zone in app code is E1601 (k.ctx).

**Conformance.** Literal strings hold for the CLDR data of the repository's Node version.
- After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw.
- `Locale` accepts `en-US`, `de`, `de-DE`, `ja-JP` and `zh-Hant-TW`, and fails `EN-us`, `en_US`, `xx` and `""` with rule `format`; every `gen` value parses and round-trips.
- With `S = ['en-US', 'de-DE', 'ja-JP']`: `negotiate(S, ['de-AT'])` is `de-DE`, `['fr-FR', 'ja']` gives `ja-JP`, `[]` gives `en-US`, `[undefined, 'x_y', 'de-DE']` gives `de-DE`; for every generated `wanted`, the result is a member of `S`; `negotiate(['en-US', 'EN-gb'], [])` throws.
- `i18n` has real, shell and sim implementations; under sim with seeds 0 to 9 it gives `['en-US']` and `UTC`; real with no `window` gives `[]` and `UTC`.
- `formatMoney` of EUR 125000, JPY 1200 and USD 1999 is `€1,250.00`, `¥1,200`, `$19.99` in `en-US`; `1.250,00 €`, `1.200 ¥`, `19,99 $` in `de-DE`; `€1,250.00`, `￥1,200`, `$19.99` in `ja-JP`. USD 1e15 in `en-US` is `$10,000,000,000,000.00`. For every generated `Money` and those locales it equals `Intl.NumberFormat` currency style of `toDecimal(m)`.
- `formatDate('2026-11-10', l)` is `Nov 10, 2026`, `10.11.2026`, `2026/11/10` for `en-US`, `de-DE`, `ja-JP`; `formatTime('14:30', 'de-DE')` is `14:30`; `formatInstant('2026-11-10T23:30:00.000Z', 'en-US', 'Asia/Tokyo', { date: 'medium' })` is `Nov 11, 2026`. For every generated `PlainDate` `d`, `formatDate(d, l)` equals `Intl.DateTimeFormat(l, { dateStyle: 'medium', timeZone: 'UTC' }).format(Date.parse(d))`.
- `formatDuration` of `PT5M` is `5 min`, `5 Min.`, `5 分` in `en-US`, `de-DE`, `ja-JP`; `PT1H30M` in `en-US` is `1 hr, 30 min`, `-PT1H30M` is `-1 hr, 30 min`, `PT0S` is `0 sec` and `PT1.500S` is `1.5 sec`.
- `plural(n, 'en-US', { one: '# recipe', other: '# recipes' })` is `1 recipe` for 1 and `2 recipes` for 2; in `ja-JP`, 1 gives `1 recipes`; in `de-DE`, 1234 gives `1.234 recipes`.
- `['Zebra', 'Äpfel', 'Apfel'].sort(collate(l))` is `Apfel, Äpfel, Zebra` for `de-DE` and `Apfel, Zebra, Äpfel` for `sv-SE`.
- With `process.env.TZ` and `process.env.LANG` changed, every format function returns equal results for equal arguments.
````

### std.money (710 -> 722)
The `import` line names `toDecimal` in place of `formatMoney`. The `formatMoney` bullet and conformance clause 7 become:

````md
import { Money, Currency, addMoney, toDecimal } from '@keel/std-money'

- `toDecimal(m): string`: the exact amount in major units, an optional `-` and the absolute amount with exactly the currency's exponent of decimals (`.` separator, no grouping, no code). `{ amount: -5, currency: 'USD' }` is `-0.05`; `{ amount: 1234, currency: 'JPY' }` is `1234`. Showing money to a person is std.i18n `formatMoney(m, locale)`.

- For every generated `Money`, `toDecimal` matches `^-?\d+(\.\d{e})?$` with `e` the currency's exponent (no fraction when 0), and parsing it times `10^e` gives back `amount`.
````

### k.schema (1,239 -> 1,476)
The registry sentence ends the Primitives paragraph; a Refined types paragraph precedes SchemaError; `format` joins `Rule`; one clause is appended.

````md
Primitives: `string`, `number` (finite, `{ min, max }`), `int` (`{ min, max }`), `boolean`, `literal`, `enum`, `id(brand)`, `object` (`{ closed: true }`), `array`, `union(key, variants)` (discriminated) or `union(members)`, `record`, `json` (any `JsonValue`; non-JSON values fail with rule `type`; rfc:0018). Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. Registry: `s.register(name, type)` names a stdlib type; `s.registry()` lists them.

**Refined types.** `s.refine(name, inner, { check, gen: { from, map } })` is `inner` narrowed by a pure `check(v): boolean` (a throw counts as false), typed `Refined<T, name>` (a branded `T`, not assignable across names). `parse` runs `inner`, then `check`; a false `check` fails with rule `format` at that path. `encode`, `decodeStrings` and JSON Schema are `inner`'s (JSON Schema adds `format: name`); `doc()` is `name`; `gen` is `gen(from)` mapped through `map`, keeping values `parse` accepts. Its node is `{ kind: 'refine', name, inner }`; `check` and `gen` are held beside it in memory, so a serialized node keeps only the name.

**SchemaError** is the KeelError `schema.invalid` (k.errors): a plain value `{ code: 'schema.invalid', message, data: { issues: { path: (string | number)[], rule: Rule }[] } }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant` · `unknown-key` (an undeclared key of a closed object) · `secret-missing` (the marker where a secret is required) · `format` (a refined type's `check` is false). Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

- For a refined type, `parse` fails with rule `format` exactly when `inner` accepts and `check` is false; every `gen` value parses and round-trips; `encode` and `decodeStrings` equal `inner`'s on accepted values; `doc()` is the name.
````

### k.ctx (1,489 -> 1,498)
The API, Observers and Rules paragraphs are replaced, clause 10 gains the locale cases, and clauses 1 and 13 are reworded to fit. No clause is added, so the files citing clauses 1, 10 and 13 (`packages/ctx/conformance/clock-after.test.ts`, `packages/check/conformance/ambient-string-code-0058.test.ts`, `packages/check/conformance/string-code-origin-0065.test.ts`) update their quoted header under rfc:0079, and the clause 10 file gains the new cases. The Observers trim drops "(the first 16)" and "with `at`, their report time", which clauses 15 and 16 state.

````md
**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?)` (sim: `advance` resolves waiters in deadline order), `ctx.random.float()`, `ctx.random.id(brand): Id<B>` (a v4 uuid typed `s.id(brand)`; the one way to mint an id or token), `ctx.net.fetch(req)`, `ctx.storage.get/set`. Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns the only access path, a typed accessor `(ctx) => Impl`, resolved lazily (`createCtx` and `register` run in either order); each factory's seed derives from the ctx seed and the name; `capabilities()` lists names; re-registering the identical implementations object returns the same accessor, any other duplicate is E1602.

**Observers.** `observe(ctx, fn): () => void` calls `fn` synchronously with each event the kernel reports on `ctx`, in order, until the returned stop function runs; a throw in `fn` is dropped. Events (`CtxEvent`): `{ kind: 'nav', href, route: { id, path, params, search, schemas } }` when the router starts a navigation, before guards, or `resume` restores the served route (`params`, `search` encoded; no `schemas`); a new observer first gets the current one, then the `error` events since it, replayed; `{ kind: 'fire', id, event }` when runtime-dom dispatches a `FireEvent` to element `id`, before its handlers (for the rest of the ctx, on a field ever `type="password"` or `autocomplete` `current-password`/`new-password`, an `input` value and a one-character `keydown` key are `x` repeated); `{ kind: 'resource', id, state }` when `Match` renders a resource state (`id`: its `inspect()` node id); `{ kind: 'error', error }` when a `Boundary` catches or a loader or action returns `err`. `seedOf(ctx)` is the `createCtx` seed or `undefined`.

**Rules.** E1601, an ambient effect in app code: `Date.now`, `new Date()`, `Date()`, `Temporal.Now`, `performance.now`/`timeOrigin`, `Math.random`, `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`, `navigator.sendBeacon`, `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`; the host locale and zone: `navigator.language`/`languages`, an `Intl` constructor with no locale or `undefined`, `Intl.DateTimeFormat` with no object-literal `timeZone` option, its `format()`/`formatToParts()` with no date, a `toLocale*` call with no argument, `localeCompare` with one. Found through `globalThis`/`window`/`self`, literal computed keys (`const` strings too) and same-file bindings (aliases, parameter defaults, destructuring), by lexical scope; an alias is reported at its uses, and where declared only if exported there. The fix is the exact `ctx` equivalent, if any (`crypto.randomUUID` names `ctx.random.id(brand)`, no fix). E1603: `eval`, `Function(...)` or `new Function(...)` in app code, also aliased or as a function's (or its prototype's) `constructor`, and `import()` or `new Worker`/`SharedWorker` (also `Reflect.construct`) of a `data:` or `blob:` URL. E1603 follows a URL through `String()`, templates, `+`, `new URL`, `?:`, object properties and local assignments, and prototype chains to `constructor`. Neither follows calls or other files; E1601 also not object literals or a reassigned binding.

- `after(ms)` under sim resolves exactly when `advance` crosses the deadline, and an aborted waiter rejects.
- `Temporal.Now.instant()`, `performance.timeOrigin`, `navigator.sendBeacon(u, b)`, `navigator.languages`, `new Intl.NumberFormat()`, `n.toLocaleString()` and `new Intl.DateTimeFormat('en').format(d)` are each one E1601; with `{ timeZone: 'UTC' }` that formatter's `.format()` is one and `.format(d)` none.
- With `o` the inline call `URL.createObjectURL(b)`: `import(String(o))`, `` import(`${o}`) ``, `new Worker(new URL(o))`, `Reflect.construct(Worker, [o])`, `import(u)` after `let u; u = o`, and `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)` are each one E1603; `new Worker(new URL('./w.js', import.meta.url))` is not.
````

### k.ui (1,499 -> 1,497)
`lang` joins Base elements and the bound list; one clause is appended. To fit: the citations `(RFC 0009)`, `(rfc:0043)`, `rfc:0062`, `rfc:0064`, `rfc:0067` and `(k.compiler URL policy)` go, "no `label`" in Base elements goes (clause 10 states it), the `disabled` rationale shortens, and the tokens example drops `space 0`, `radius`, `font` and `motion` (no clause reads them; clause 6 reads only `color`).

````md
```ts
export const tokens = defineTokens({
  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },
  space: { 1: '4px', 2: '8px', 3: '16px' },
  fontSize: { sm: '14px', md: '16px', lg: '24px' },
  breakpoint: { md: '768px' },
})
```

**Base elements.** From `@keel/ui`: `Box`, `Text`, `Heading`, `Button`, `Link`, `Image`, `Input`, `TextArea`, `Select`, `Checkbox`. Required a11y props are in the type: `Heading level`; `Image alt` or `decorative`; `label` on `Input`, `TextArea`, `Select`, `Checkbox`; `Link to: Href` with text; `Button` children (text, or an `Image` whose `alt` names it). `Image src` is an asset URL string, not an `Href`. `Box as` and `Text as` take closed sets of structural tags (`section`, `nav`, `main`, `ul`, `li`, `p`, `span`, ...). `Box` and `Text` take `lang`, a BCP 47 tag or a signal of one, written as the `lang` attribute. Event props are a closed set: `Button onClick: () => void`, `Checkbox onChange: (checked: boolean) => void`, `Input onInput` and `TextArea onInput: (value: string) => void`, `Select onChange: (value: string) => void`; no others (`Link` navigates; `Box`, `Text`, `Heading`, `Image` have none). They register through the runtime's delegated `on`; a bound `field` updates first, then the prop runs. A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input), so server HTML shows it. Base elements are built through the runtime's `element` in document order, so an island of them resumes in place (k.runtime); a control the user changed before resume keeps its state, and no default is written. A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, `lang`, a style prop, a child) is bound: it carries `data-k`, so its route level is an island (k.runtime). An eager `Node` child is made first, so its island re-renders (E1253; check E1808).

**Style props** are the only styling: no `class` prop, no `styles()`. Base elements take style props whose values are token names: `p px py m mx my gap w h bg fg radius font fontSize weight shadow border direction align justify wrap`. Types accept any string shaped like a token name (`TokenName`: an identifier or short numeric key, so `16px` and `#fff` are type errors); whether the token exists is E1801. Responsive values are keyed by breakpoint. State styles live under one `states` prop: `states={{ hover, focusVisible, active, disabled }}`, each a nested style object, so `disabled` stays the boolean attribute.

- `Text lang="de-DE"` renders `lang="de-DE"`; a signal `lang` binds it, and a write changes only that attribute.
````

### spec/00-map.md (orchestrator)
- Code ranges gain `| E220x | std.temporal | E230x | std.text |` and `| E240x | std.i18n | | |`.
- Stdlib rows: `| std.temporal | Dates and times | proposed | refined ISO instants, dates, times, zones, durations; ctx clock |`, `| std.text | Text values | proposed | refined `text.Line`; graphemes, truncate, fold |`, `| std.i18n | Locales and formatting | proposed | `i18n` capability, `i18n.Locale`; numbers, money, dates, durations, plurals, collation |`.
- The std.money row's one line becomes "schema type registry: `money.Money`, add, toDecimal".

### Other docs (orchestrator)
- `spec/std/README.md`: "Stage S2 (RFC 0079): std.temporal, std.text, std.i18n."
- `docs/ARCHITECTURE.md` Borrow vs build gains "Dates, zones, locale data | Borrow platform `Intl` (ICU, CLDR); build ISO values; no `Temporal` polyfill | Node 22 has no `Temporal`; `Intl` covers formatting at no bundle cost".
- Each new package's `README.md` (its lane) follows the std-money README shape.

## Conformance diff
Each clause is cited verbatim by exactly one file (RFC 0049). New files are additions; the edited ones carry rfc:0079.

| section | clauses | files | by |
| --- | --- | --- | --- |
| std.temporal | 12 | `packages/std-temporal/conformance/`: `registry`, `gen-encode-doc`, `instant-parse`, `date-time-parse`, `time-zone-parse`, `duration`, `string-order`, `now-sim-clock`, `in-zone`, `add-days`, `add-duration-between`, `host-independent` (`.test.ts`) | new |
| std.text | 6 | `packages/std-text/conformance/`: `line-gen`, `line-rejects`, `graphemes`, `truncate`, `fold`, `host-independent` | new |
| std.i18n | 10 | `packages/std-i18n/conformance/`: `registry`, `locale-parse`, `negotiate`, `capability`, `format-money`, `format-date-time-instant`, `format-duration`, `plural`, `collate`, `host-independent` | new |
| std.money | 7 | `packages/std-money/conformance/format.test.ts` becomes `to-decimal.test.ts` | edited |
| k.schema | appended clause | `packages/schema/conformance/refine.test.ts` | new |
| k.ui | appended clause | `packages/ui/conformance/lang.test.ts` | new |
| k.ctx | 1, 10, 13 | the three files named under Spec diff, k.ctx | edited |

k.schema and k.ui stay `conformance-covered`, so `keel ledger --diff` reports E1707 for each new clause until its file lands; both files belong in the kernel lane's commits. The std sections are `proposed` until their suites pass.

## Migration
- **Apps.** None outside golden-2. No app uses `formatMoney`, `toLocale*`, `localeCompare`, a locale-less `Intl` constructor or `navigator.language`.
- **golden-2** (Open question 7). `Recipe` and `NewRecipe` gain fields; existing api bodies stay valid. A local `.api.storage` written before the change fails to parse at load; delete it (it is gitignored).
- **std-money.** `formatMoney(m)` becomes `` `${toDecimal(m)} ${m.currency}` `` for the old text, or std-i18n `formatMoney(m, locale)` to show it. The ledger entry for `packages/std-money/src/formatMoney.ts` moves to `toDecimal.ts` (orchestrator).
- **Kernel callers.** `s.refine`, `Refined`, rule `format`, `lang` and the E1601 cases are additions. A `switch` over `Rule` (forms and router `messageFor`) adds `format`; a `switch` over `Node` adds `refine`.

## Budgets
Package sizes are `tooling/budgets.mjs` measurements (gzip, minified ESM from `src/index.ts`, dependencies external), today and estimated:

| package | today | estimate | budget entry |
| --- | --- | --- | --- |
| `@keel/std-temporal` | new | 2.0 kB: five checks, civil-date math, ISO duration text, `inZone` | `"2.5kb"` |
| `@keel/std-text` | new | 0.6 kB | `"1kb"` |
| `@keel/std-i18n` | new | 1.6 kB: `Locale`, `negotiate`, capability, eight formatters, cache | `"2kb"` |
| `@keel/std-money` | 539 B | about 530 B | `"1kb"` (new entry; none exists) |
| `@keel/schema` | 4,402 B | +0.3 kB | `5kb`, holds |
| `@keel/ui` | 3,104 B | +40 B | `4kb`, holds |
| `@keel/check` | 33,538 B | +0.3 to 0.4 kB | `33kb` (33,792 B) is likely crossed; re-base to `33.5kb` with the measured bytes in the commit (default 7) |

An app that formats money and dates adds about 4 kB gzip and no locale data: `Intl` ships with the engine.

## Token impact
std.temporal 1,209, std.text 691, std.i18n 1,403 (new); std.money 710 -> 722; k.schema 1,239 -> 1,476; k.ctx 1,489 -> 1,498; k.ui 1,499 -> 1,497; spec map 895 -> about 990. A golden-2 task with the slice std.i18n, std.temporal, std.money reads about 3,300 tokens of spec.

## Known limits
- **Input.** No locale-aware number or money parsing (`12,50`); forms take ISO dates and times through refined schemas and decimals with `.`.
- **Zones.** `inZone` goes from an instant to wall time only; wall time to an instant (DST gaps and overlaps) is not in S2. `TimeZone` validity follows the platform's zone data, so a zone new to the IANA database can parse on one engine and not another.
- **Locales.** `Locale` validity follows the platform's ICU data; a Node built with small ICU accepts few locales. Literal strings follow CLDR: a CLDR update can change a conformance literal or an eval string, and the property clauses compare against `Intl` instead.
- **Document language.** `<html lang>` stays the page's static language; localized regions carry `lang`. No `dir`, so right-to-left locales are not laid out.
- **Server negotiation.** A node-rendered page takes its locale from the URL only (Open question 8).
- **E1601 reach.** Local-time getters on an existing `Date` (`getHours`, `getTimezoneOffset`) read the host zone and are not reported: finding them needs types.
- **Not in S2.** Relative time, list formatting, calendars other than ISO, calendar durations, a message catalog format.
