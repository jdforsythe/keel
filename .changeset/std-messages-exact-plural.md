---
"@keel/std-i18n": patch
"@keel/std-messages": patch
---

A plural form keyed `'=n'` (`n` a non-negative safe integer: `'=0'`, `'=12'`) applies when the number is `n`, before the category form and `other`; `plural` selects it and a message set admits it, so "No receipts yet" is `'=0'`. Another key starting with `=` fails with rule `format`. New rule E2407 reports a plural form that never applies in a locale file (a category the locale never selects, such as `zero` in `en-US`, or a malformed `=` key), with a fix that renames `zero` to `'=0'` and removes other dead forms. `@keel/std-messages/tools` exports seven rules.
