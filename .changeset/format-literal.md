---
"@keel/schema": minor
"@keel/check": minor
"@keel/std-temporal": patch
---

k.formats: `formatLiteral(format, text)` in `@keel/schema` writes a format value in source (a chart's `start`, a store's initial value, a test fixture) for every format type over `s.string()`. `text` is a string literal, the result is `Format<string, N>`, and outside `keel check` a text that does not parse throws a `TypeError` naming the format and the rule. E1108 in `keel check`: a `text` that is no string literal, a `format` with no registered name, or a literal its format's `parse` refuses, at the argument at fault, with no fix; `keel explain E1108` is new. `UTC` is a `formatLiteral`.
