---
"@keel/std-money": patch
---

`parseMoney(text, currency, locale)` reads typed amounts into `Money`: the locale's own decimal and group separators, an optional sign and one mark (the code or a symbol) before or after, NFKC and any White_Space. It returns `money.unreadable`, `money.currencyMismatch`, `money.tooManyDecimals` (never rounded) or `money.overflow`, and no message quotes the text. `parseMoney(formatMoney(m, l), m.currency, l)` is `ok(m)` for every `m` and `l`.
