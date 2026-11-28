---
"@keel/check": minor
---

New kernel rules: E1106 (k.schema) `s.format` in app code, no fix; E1758 ambient locale or time zone in app code (`navigator.language`/`languages`, an `Intl` constructor, `toLocale*String` or `localeCompare` without a locale, `Intl.DateTimeFormat` or a date's `toLocale*String` without `timeZone`, a local-time getter on `new Date(...)`), names resolved as for E1601, no fix; E1509 (k.prefix) over the checked route table, read statically from `routes.ts` and the params' `*.schema.ts`, with a fix that prepends `/:<p>` to the path.
