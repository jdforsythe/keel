---
"@keel/std-i18n": patch
"@keel/std-temporal": patch
"@keel/std-text": patch
"@keel/std-money": patch
"@keel/std-tables": patch
"@keel/std-messages": patch
"@keel/std-geo": patch
"@keel/std-report": patch
"@keel/check": patch
---

A refused input raises a defect (`defect` of `@keel/schema`) with a literal message and its values as `data`, where it threw an `Error` or a `RangeError`: std-i18n's `numberParts`, `formatUnit`, `formatList` and `formatDateTime` (an `Intl` refusal is the `cause`), std-temporal's `durationOf`, `plainDateOf` and `formatInstant`, std-text's bounds and `truncate`, std-money's `formatMoney`, std-tables' E2851, E2852 and E2853, std-messages' declarations and refused entries. std-temporal's and std-money's errors are made by `s.error`, with literal messages. std-geo's `geo.unavailable` and std-report's requests catch through `attempt` with an `expect`. Each of the twelve libraries lists `@keel/reactive` as a peer. E1162 finds a library a library lists as Node finds it from the listing library's real folder.
