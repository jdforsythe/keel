# std.money: Money
status: conformance-covered

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-money` registers `money.Money` and `money.Currency`; `s.registry()` then maps each name to the exported schema. The registry names composite types: codec, generator and doc derive from their declaration (k.schema), so `money` adds no primitive kind. It depends on `@keel/std-i18n` for `Locale` (std.i18n).

**API** (`@keel/std-money`).
```ts
import { Money, Currency, addMoney, formatMoney } from '@keel/std-money'
const price: Money = { amount: 1999, currency: 'USD' }   // minor units: cents
formatMoney(price, props.params.locale)                  // de-DE: '19,99 $'
```
- `Currency` is `s.enum(['EUR', 'GBP', 'JPY', 'USD'])`. Minor-unit exponent: JPY 0, the others 2.
- `Money` is `s.object({ amount: s.int({ min: -1e15, max: 1e15 }), currency: Currency }, { closed: true })`; `type Money = s.infer<typeof Money>`. Amounts are integers in minor units; there is no float form. The bound keeps every sum of two amounts exact.
- `addMoney(a, b): Result<Money, KeelError<'money.currencyMismatch', { left: Currency; right: Currency }> | KeelError<'money.overflow', { amount: number }>>`: same currency gives `ok` with the summed amount; different currencies give `money.currencyMismatch` naming both; a sum outside the `amount` bounds gives `money.overflow` with the unsafe sum.
- `formatMoney(m: Money, locale: Locale): string` is `new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(d)`, where `d` is the exact decimal string of `amount` at the currency's exponent (`{ amount: -5, currency: 'USD' }` gives `d` `'-0.05'`), so no amount passes through a float. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE`, with U+00A0 before `€`.

**Rules.** None (no diagnostics). `money.currencyMismatch` and `money.overflow` are KeelError codes (k.errors), prefixed by the module id.

**Conformance.**
- After importing `@keel/std-money`, `s.registry().get('money.Money')` is `Money` and `s.registry().get('money.Currency')` is `Currency`; importing it again does not throw.
- For every value `gen(Money)` produces, `Money.parse` accepts it and `Money.parse(Money.encode(v))` returns an equal value.
- `Money.parse` rejects a non-integer amount (rule `int`), an amount beyond the bounds (rule `min` or `max`), a currency outside the four (rule `enum`) and an undeclared key (rule `unknown-key`), each at that key's path.
- `Money.doc()` is a closed-object doc naming `amount` and `currency` and each currency code.
- For generated same-currency pairs whose sum is in bounds, `addMoney(a, b)` is `ok` with `amount` `a.amount + b.amount` and equals `addMoney(b, a)`.
- Different currencies give `err` `money.currencyMismatch` with `data` `{ left: a.currency, right: b.currency }`; an out-of-bounds sum gives `err` `money.overflow`.
- For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`.
