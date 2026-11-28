---
"@keel/std-i18n": minor
"@keel/std-money": patch
"@keel/std-text": patch
"@keel/std-temporal": patch
"@keel/std-tables": patch
"@keel/std-messages": patch
---

`@keel/std-i18n` exports `collate`, `numberParts`, `formatUnit`, `formatList`, `formatDateTime` (its `timeZone` required) and `pluralCategories`, each the `Intl` call std.i18n names. std-money, std-text, std-temporal, std-tables and std-messages construct no `Intl` formatter E2301 reads and call these instead, with the same output, so E2301 holds over their files as over an app's. `numberParts`, `formatUnit`, `formatList` and `formatDateTime` throw a `RangeError` named for the function for an input `Intl` refuses, a `numberParts` string that is no plain decimal, and a `formatDateTime` `timeZone` that is no non-empty string.
