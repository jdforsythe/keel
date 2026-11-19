# @keel/std-money

**Spec:** std.money · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `Money` (closed `{ amount: int in ±1e15 minor units, currency }`), `Currency` (`EUR | GBP | JPY | USD`), `addMoney(a, b): Result<Money, MoneyError>`, `formatMoney(m, locale): string` (`€12.50` in `en-US`, `12,50 €` in `de-DE`), type `MoneyError` (`money.currencyMismatch`, `money.overflow`).
- **Invariants:** importing the package registers `money.Money` and `money.Currency` (idempotent). Amounts are integers; `formatMoney` is `Intl.NumberFormat(locale, { style: 'currency', currency })` over the exact decimal string of the amount at the currency's exponent (JPY 0, the others 2), so no amount passes through a float, and it reads no host locale; an amount outside the `Money` type (non-integer, `NaN`) throws. `addMoney` never throws.
- **Dependencies:** `@keel/schema`, `@keel/std-i18n` (`Locale`).
- **Rungs:** conformance (example + probabilistic), properties for `addMoney` associativity and `formatMoney` injectivity per locale.

## Extension points

Uses the **schema type registry** (k.schema `s.register`). It registers named composite types; codec, generator and doc derive from the declaration.

## Unsafe

count: 0
