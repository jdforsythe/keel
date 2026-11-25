# ADR-0228: std.money: `parseMoney(text, currency, locale)` reads typed amounts (RFC 0206)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** `formatMoney` writes an amount for a locale and nothing reads one back. Each app that takes an amount in a form writes its own reader; the household app's takes `.` or `,` as the decimal in every locale, so `1.250` in `de-DE` is read as 125 euros.

**Decision.**
- `parseMoney(text, currency, locale): Result<Money, ParseMoneyError>` in `@keel/std-money`. The currency is an argument.
- The text is NFKC-normalized, `White_Space` read as a space, trimmed, at most 64 characters. It is an optional `-` or U+2212, an optional mark (the code, or the locale's `symbol` or `narrowSymbol` for the currency) before or after, and a number with the locale's own decimal separator and an optional group separator between groups of three.
- More fraction digits than the currency's exponent is `money.tooManyDecimals`, trailing zeros included; nothing is rounded. Other errors: `money.unreadable`, `money.currencyMismatch` for another supported currency's mark, `money.overflow` outside the `Money` bounds. No `message` quotes the text.
- Laws: `parseMoney(formatMoney(m, l), m.currency, l)` is `ok(m)`; read in another locale it is `ok(m)` or `err`, never another amount.
- A form reads money as a `s.string()` field; the action calls `parseMoney` and answers `keel.fields`.

**Alternatives.**
- A format type or a k.forms `field` parser: a format type cannot carry the locale; a parser hook is a second way to read a value.
- Either separator as decimal: misreads by a factor of a hundred or a thousand.
- Rounding extra digits: silent.

**Consequences.** One reader for typed amounts, exact and locale-strict; a German typing `12.50` is told to write `12,50`. The household app drops `minorUnits.ts`. std.money reads `proposed` until conformance and the build land.
