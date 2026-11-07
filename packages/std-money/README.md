# @keel/std-money

**Spec:** std.money · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `Money` (closed `{ amount: int in ±1e15 minor units, currency }`), `Currency` (`EUR | GBP | JPY | USD`), `addMoney(a, b): Result<Money, MoneyError>`, `formatMoney(m): string` (`-0.05 USD`, `1234 JPY`), type `MoneyError` (`money.currencyMismatch`, `money.overflow`).
- **Invariants:** importing the package registers `money.Money` and `money.Currency` (idempotent). Amounts are integers; `formatMoney` is string arithmetic, exact for every in-bounds amount; `addMoney` never throws.
- **Dependencies:** `@keel/schema`.
- **Rungs:** conformance (example + probabilistic), properties for `addMoney` associativity and `formatMoney` injectivity.

## Extension points

Uses the **schema type registry** (k.schema `s.register`). It registers named composite types; codec, generator and doc derive from the declaration.

## Unsafe

count: 0
