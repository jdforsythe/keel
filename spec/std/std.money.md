# std.money: Money
status: proposed

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-money` registers `money.Money` and `money.Currency`; `s.registry()` then maps each name to the exported schema. The registry names composite types: codec, generator and doc derive from their declaration (k.schema), so `money` adds no primitive kind. It depends on `@keel/std-i18n` for `Locale` (std.i18n).

**API** (`@keel/std-money`).
```ts
import { Money, Currency, addMoney, formatMoney, parseMoney } from '@keel/std-money'
const price: Money = { amount: 1999, currency: 'USD' }   // minor units: cents
formatMoney(price, props.params.locale)                  // de-DE: '19,99 $'
parseMoney('12,50 €', 'EUR', 'de-DE')                    // ok({ amount: 1250, currency: 'EUR' })
```
- `Currency` is `s.enum(['EUR', 'GBP', 'JPY', 'USD'])`. Minor-unit exponent: JPY 0, the others 2.
- `Money` is `s.object({ amount: s.int({ min: -1e15, max: 1e15 }), currency: Currency }, { closed: true })`; `type Money = s.infer<typeof Money>`. Amounts are integers in minor units; there is no float form. The bound keeps every sum of two amounts exact.
- `addMoney(a, b): Result<Money, KeelError<'money.currencyMismatch', { left: Currency; right: Currency }> | KeelError<'money.overflow', { amount: number }>>`: same currency gives `ok` with the summed amount; different currencies give `money.currencyMismatch` naming both; a sum outside the `amount` bounds gives `money.overflow` with the unsafe sum.
- `formatMoney(m: Money, locale: Locale): string` is `new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(d)`, where `d` is the exact decimal string of `amount` at the currency's exponent (`{ amount: -5, currency: 'USD' }` gives `d` `'-0.05'`), so no amount passes through a float. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE`, with U+00A0 before `€`.
- `parseMoney(text: string, currency: Currency, locale: Locale): Result<Money, ParseMoneyError>` reads typed text as `Money` in `currency`. Over 64 characters is `money.unreadable`. Otherwise the text is NFKC-normalized (fullwidth digits, separators and `￥` become their ASCII or `¥` forms), each `White_Space` character is read as a space, and the ends are trimmed. What is left must be, in order, an optional sign, an optional mark and spaces, an optional sign, the number, then optional spaces and a mark, with at most one sign and one mark:
  - **Sign.** `-` or U+2212, before the mark or directly before the number (`-€12.50`, `€ -12,50`, `-12,50 €`). No `+`, no parentheses.
  - **Mark.** `currency`'s code, or the `currency` part of `Intl.NumberFormat(locale, { style: 'currency', currency })` with `currencyDisplay` `symbol` or `narrowSymbol` (`€`, `US$`, `$`, `$US`, `JP¥`, `¥`), NFKC-normalized, matched in any case. Before or after the number, with any spacing or none.
  - **Number.** ASCII digits after normalization: an integer part, then optionally the locale's decimal separator and one or more fraction digits. The integer part is plain digits, or 1 to 3 digits then groups of a group separator and 3 digits. The separators are the `decimal` and `group` parts of `Intl.NumberFormat(locale)`, normalized as the text (`fr-FR`'s U+202F group is a space). No other separator, no leading separator, no exponent.
- `parseMoney` errors, the first that applies: `money.unreadable` (`{}`) for text not of that form, a mark of no supported currency, or digits of another script; `money.currencyMismatch` (`{ left: currency, right }`) for a mark (code or symbol, as above) of another `Currency` in `locale`; `money.tooManyDecimals` (`{ currency, decimals }`, `decimals` the exponent) for more fraction digits than the exponent, trailing zeros included (`12.500` for USD, `1800,0` for JPY): never rounded; `money.overflow` (`{ amount }`, the read amount as a number) outside the `Money` bounds. Fewer fraction digits are padded (`12,5` EUR in `de-DE` is 1250). A zero amount is `0`, never `-0`. `message` is English and holds no part of `text`. `ParseMoneyError` is that union; `money.currencyMismatch` and `money.overflow` keep `addMoney`'s data.
- A form reads money as text: the form schema's field is a `s.string()` (with `Currency` beside it when the person picks one), and the action calls `parseMoney(input.amount, input.currency, params.locale)`, answering `err` as `keel.fields` for that field with text from the app's message set chosen by the error's `code` (k.forms Submit).

**Rules.** None (no diagnostics). `money.currencyMismatch`, `money.overflow`, `money.unreadable` and `money.tooManyDecimals` are KeelError codes (k.errors), prefixed by the module id.

**Conformance.**
- After importing `@keel/std-money`, `s.registry().get('money.Money')` is `Money` and `s.registry().get('money.Currency')` is `Currency`; importing it again does not throw.
- For every value `gen(Money)` produces, `Money.parse` accepts it and `Money.parse(Money.encode(v))` returns an equal value.
- `Money.parse` rejects a non-integer amount (rule `int`), an amount beyond the bounds (rule `min` or `max`), a currency outside the four (rule `enum`) and an undeclared key (rule `unknown-key`), each at that key's path.
- `Money.doc()` is a closed-object doc naming `amount` and `currency` and each currency code.
- For generated same-currency pairs whose sum is in bounds, `addMoney(a, b)` is `ok` with `amount` `a.amount + b.amount` and equals `addMoney(b, a)`.
- Different currencies give `err` `money.currencyMismatch` with `data` `{ left: a.currency, right: b.currency }`; an out-of-bounds sum gives `err` `money.overflow`.
- For every generated `Money` and `Locale` `l`, `formatMoney(m, l)` equals the `Intl` expression above, and the digits of its `integer` and `fraction` parts (`formatToParts`), read as one integer, give back the absolute `amount`; `{ amount: 1800, currency: 'JPY' }` is `¥1,800` in `en-US`, `1.800 ¥` (U+00A0) in `de-DE` and `￥1,800` in `ja-JP`.
- For every generated `Money` `m` and `Locale` `l`, `parseMoney(formatMoney(m, l), m.currency, l)` is `ok` with a value equal to `m`; for every second `Locale` `l2`, `parseMoney(formatMoney(m, l), m.currency, l2)` is `ok` with a value equal to `m` or an `err`, never `ok` with another amount.
- `parseMoney` gives `ok` amount 1250 EUR for `12,50`, `12,5`, `12,50 €`, `12,50€`, `€12,50`, `eur 12,50`, ` 12,50 ` (U+00A0 ends) and `１２，５０` in `de-DE`, and for `1.250` 125000; `-12,50 €` and `€ -12,50` give -1250; `1 234,50 €` with U+202F, U+00A0 or a space gives 123450 in `fr-FR`; `100` and `￥100` give 100 JPY in `ja-JP`; `-0` gives `amount` `0` with `Object.is(amount, 0)`.
- `money.unreadable` for `''`, `12,50` and `1,2,3` in `en-US`, `12.50` and `1.2` in `de-DE`, `+5`, `(5)`, `5-`, `.5`, `5.`, `1e3`, `--5`, `€5 €`, `CHF 5`, `٥` and 65 digits; `money.currencyMismatch` with `{ left: 'EUR', right: 'USD' }` for `$5` in `en-US`; `money.tooManyDecimals` with `{ currency: 'USD', decimals: 2 }` for `12.505` and `12.500` in `en-US`, and `{ currency: 'JPY', decimals: 0 }` for `1,5` in `de-DE`; `money.overflow` for `10000000000000.01` USD in `en-US`. No `err` `message` contains its `text`.
