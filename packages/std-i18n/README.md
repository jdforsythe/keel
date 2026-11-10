# @keel/std-i18n

**Spec:** std.i18n · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `Locale` (`s.enum` of `de-DE`, `en-GB`, `en-US`, `es-ES`, `fr-FR`, `it-IT`, `ja-JP`, `ko-KR`, `nl-NL`, `pt-BR`, `zh-CN`), `formatNumber(n, locale)`, `plural(n, locale, forms)`, `localeName(locale)`, type `PluralForms` (`other` plus optional `zero`, `one`, `two`, `few`, `many`). `@keel/std-i18n/tools`: `localeFormatter`, the `RuleDef` for E2301 (registered on import).
- **Invariants:** importing the package registers `i18n.Locale` (idempotent). Every function takes the locale explicitly and reads no host locale or time zone. `plural` picks the form `Intl.PluralRules` names, else `other`, and replaces each `#` with `formatNumber(n, locale)`. E2301 flags, in a module whose `deps` list `@keel/std-i18n`, an `Intl` formatter (`NumberFormat`, `DateTimeFormat`, `PluralRules`, `DisplayNames`, `Collator`, `RelativeTimeFormat`, `DurationFormat`) constructed with a locale, `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString` called with one, and `localeCompare` with a second argument; the message names the stdlib function to call; no fix. The module is the `module.ts` with the longest directory prefix of the file.
- **Dependencies:** `@keel/schema`; the `./tools` entry adds `@keel/check` and `oxc-parser`. The root imports neither `@keel/check` nor `typescript`.
- **Rungs:** conformance (example + probabilistic), properties for `formatNumber` agreeing with `Intl` and `plural` picking the `Intl.PluralRules` form, examples for E2301 scoping and messages.

## Extension points

Uses the **schema type registry** (k.schema `s.register`) and the **check rule registry** (k.check `defineRule`, `./tools`).

## Unsafe

count: 0
