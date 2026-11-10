# std.i18n: Locales
status: conformance-covered

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

**Rules.** E2301, in a module whose `deps` list `@keel/std-i18n`: an `Intl` formatter constructed, or `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` or `localeCompare` called, with a locale argument. The message names the stdlib function to call: `formatNumber`, `formatMoney`, `formatDate`, `formatInstant`, `formatDuration`, `compareText`, `plural` or `localeName`. No fix: the function and its arguments depend on the value. Without a locale the same calls are E1758 (k.check). `Intl` constructors with no stdlib counterpart (`ListFormat`, `Segmenter`) are not reported.

**Conformance.**
- After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw.
- `Locale.parse` accepts each of the 11 tags and rejects `en`, `de-de`, `en_US` and `fr-CA`, each with rule `enum`.
- For every generated finite `n` and every `Locale` `l`, `formatNumber(n, l)` equals `new Intl.NumberFormat(l).format(n)`; `formatNumber(1234.5, l)` is `1,234.5` for `en-US`, `1.234,5` for `de-DE` and `1,234.5` for `ja-JP`.
- `plural(n, 'en-US', { one: '# recipe', other: '# recipes' })` is `1 recipe` for 1 and `2 recipes` for 2; with the same forms, `ja-JP` gives `1 recipes` for 1 and `de-DE` gives `1.234 recipes` for 1234. For every generated `n` and `Locale` `l`, the result is the form `Intl.PluralRules` selects, else `other`, with `#` replaced.
- `localeName` is `English (United States)`, `Deutsch (Deutschland)` and `日本語 (日本)` for `en-US`, `de-DE` and `ja-JP`.
- With `@keel/std-i18n` in a module's `deps`, `keel check` reports one E2301 each for `new Intl.NumberFormat('de-DE')` and `a.localeCompare(b, 'de-DE')` in its files and none for them in a module without it; `n.toLocaleString()` reports E1758 and no E2301.
- With `process.env.TZ` and `process.env.LANG` changed, every export returns equal results for equal arguments.
- The package root imports neither `@keel/check` nor `typescript`; `@keel/std-i18n/tools` exports the E2301 rule.
