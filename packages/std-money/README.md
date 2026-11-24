# @keel/std-money

**Spec:** std.money · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `Money` (closed `{ amount: int in ±1e15 minor units, currency }`), `Currency` (`EUR | GBP | JPY | USD`), `addMoney(a, b): Result<Money, MoneyError>`, `formatMoney(m, locale): string` (`€12.50` in `en-US`, `12,50 €` in `de-DE`), `parseMoney(text, currency, locale): Result<Money, ParseMoneyError>` (`12,50 €` in `de-DE` is 1250 EUR), types `MoneyError` (`money.currencyMismatch`, `money.overflow`) and `ParseMoneyError` (those two, `money.unreadable`, `money.tooManyDecimals`).
- **Invariants:** importing the package registers `money.Money` and `money.Currency` (idempotent). Amounts are integers; `formatMoney` is `Intl.NumberFormat(locale, { style: 'currency', currency })` over the exact decimal string of the amount at the currency's exponent (JPY 0, the others 2), so no amount passes through a float, and it reads no host locale; an amount outside the `Money` type (non-integer, `NaN`) throws. `parseMoney` reads only the locale's own decimal and group separators (a group only between groups of three digits), an optional sign, and one mark (the code or a symbol) before or after the number, after NFKC and White_Space-as-space; text over 64 raw characters, `12,50` in `en-US` and digits of another script are `money.unreadable`; a mark of another currency is `money.currencyMismatch`; fraction digits beyond the exponent are `money.tooManyDecimals` and nothing is rounded; no error message quotes the text. `addMoney` and `parseMoney` never throw.
- **Dependencies:** `@keel/schema`, `@keel/std-i18n` (`Locale`).
- **Rungs:** conformance (example + probabilistic), properties for `addMoney` associativity, `formatMoney` injectivity per locale and `parseMoney` reading what `formatMoney` writes.

## Extension points

Uses the **schema type registry** (k.schema `s.register`). It registers named composite types; codec, generator and doc derive from the declaration.

## Unsafe

count: 0
