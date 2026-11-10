---
"@keel/std-i18n": minor
---

`@keel/std-i18n` exports `Locale`, the 11 tags Keel formats for, registered as `i18n.Locale`; `formatNumber(n, locale)`, `plural(n, locale, forms)` with type `PluralForms`, and `localeName(locale)`. Each takes the locale explicitly and reads no host locale or time zone. `@keel/std-i18n/tools` exports `localeFormatter`, rule E2301: in a module whose `deps` list `@keel/std-i18n`, an `Intl` formatter or `toLocale*String`/`localeCompare` call given a locale, with the stdlib function to call instead.
