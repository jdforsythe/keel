# RFC 0206: std.money: `parseMoney(text, currency, locale)` reads typed amounts

Status: implemented (ADR-0228), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends std.money (API, Rules, Conformance) and `spec/std/README.md`'s row. From backlog 1010.

## Decisions
- D1: `parseMoney(text, currency, locale): Result<Money, ParseMoneyError>` beside `formatMoney`; the currency is an argument, never inferred from the text.
- D2: it accepts what `formatMoney` writes in that locale and the usual typing variants of it: no mark or a mark before or after, any spacing, NBSP and NNBSP, fullwidth forms (by NFKC), `-` or U+2212, grouping optional.
- D3: only the locale's own decimal and group separators, and a group separator only between groups of three digits. So no text is read as another amount than it shows in some locale: `12,50` in `en-US` is an error, never 1250 dollars.
- D4: fraction digits beyond the currency's exponent are `money.tooManyDecimals`, trailing zeros included; nothing is rounded.
- D5: four error codes: new `money.unreadable` and `money.tooManyDecimals`, and `addMoney`'s `money.currencyMismatch` and `money.overflow` with their data.
- D6: a form reads money as a `s.string()` field and the action calls `parseMoney`, answering `keel.fields`. No format type, no `field` parser.

## Problem
`formatMoney` writes `12,50 €`; nothing reads it back. `apps/household/modules/receipts/minorUnits.ts` is the reader each app writes: it takes `.` or `,` as the decimal in every locale, so `1.250` in `de-DE` (one thousand two hundred and fifty euros as a German writes it) is 125 euros, and it reads no currency mark, no grouping, no NBSP and no fullwidth digits. Every app that takes an amount repeats this, with its own float or string arithmetic.

## Proposal
```ts
parseMoney('12,50 €', 'EUR', 'de-DE')   // ok({ amount: 1250, currency: 'EUR' })
parseMoney('12,50', 'EUR', 'en-US')     // err money.unreadable
parseMoney('12.505', 'USD', 'en-US')    // err money.tooManyDecimals { currency: 'USD', decimals: 2 }
parseMoney('$5', 'EUR', 'en-US')        // err money.currencyMismatch { left: 'EUR', right: 'USD' }
```
- **Normalization.** NFKC (fullwidth digits, `，`, `．`, `￥` typed through a Japanese or Chinese input method), each `White_Space` read as a space, ends trimmed. Text over 64 characters is unreadable before any work, which also bounds `money.overflow`'s `amount`.
- **Grammar.** `[sign] [mark spaces] [sign] number [spaces mark]`, one sign and one mark at most. Sign `-` or U+2212. Mark: the code (any case), or the `symbol` or `narrowSymbol` currency part `Intl` writes for that currency in that locale (`US$` and `$` in `en-GB`, `$US` in `fr-FR`, `JP¥` and `¥` in `zh-CN`). Number: ASCII digits; integer part plain or grouped in threes with the locale's group; then the locale's decimal and at least one digit.
- **Exponents.** Fraction digits up to the exponent (EUR, GBP, USD 2; JPY 0), padded when fewer. The rule reads the exponent table `formatMoney` uses; a currency with exponent 3 would follow it unchanged.
- **Non-Latin digits.** None of the eleven `Locale` tags formats with them by default; `٥` or `५` is `money.unreadable`. NFKC covers the fullwidth digits people actually type in `ja-JP`, `ko-KR` and `zh-CN`.
- **Errors.** In order: `money.unreadable` `{}`; `money.currencyMismatch` `{ left, right }` for another supported currency's mark; `money.tooManyDecimals` `{ currency, decimals }`; `money.overflow` `{ amount }`. `message` is English for a developer and never quotes the text, so a logged error leaks nothing typed. The data carries what a form message needs ("JPY takes no decimals", "write at most 2 decimals"); the separators are the locale's and the app's message set already says them.
- **Laws** (checked over 13,904 cases against a reference reader while writing this RFC): `parseMoney(formatMoney(m, l), m.currency, l)` is `ok(m)` for every `m` and every `l`; reading one locale's output in another locale is `ok(m)` or `err`, never another amount.
- **Forms.** The schema field stays `s.string({ min: 1, max: … })`, and the action:
```ts
const amount = parseMoney(input.amount, input.currency, params.locale)
if (!amount.ok) return err({ code: 'keel.fields', message: text.amountFormat, data: { amount: text.amountFormat } })
```
  Client validation stays the schema's (required, length); the locale-aware read is the action's, which the no-script path runs too (k.forms Submit).

## Alternatives
- **A `money` format type or a `field` parser in k.forms.** A format type is a predicate over its base (k.formats) and cannot carry the route's locale; a parser hook in k.forms is a kernel change for one std type, and two ways to read a typed value.
- **Accept `.` and `,` as decimal in every locale (household's reader).** Misreads `1.250` in `de-DE` and `1,250` in `en-US` by a factor of a thousand or a hundred.
- **Round extra digits.** Silent; a person who typed `12.505` meant something the app cannot store.
- **Infer the currency from the mark.** `$` is not one currency; the form already carries the currency.
- **`+`, parentheses, exponents.** `formatMoney` never writes them, and no one types them for a price.

## Spec diff
Applied in this commit.
- std.money (`conformance-covered`): the import line and an example; `parseMoney` with Sign, Mark and Number; its errors; the form pattern; Rules lists the two new KeelError codes; three conformance clauses (the two laws, accepted texts, rejected texts).
- `spec/std/README.md`: the row reads `proposed` and "format and parse". No diagnostic, no code range, no glossary term.

## Conformance
By the `conformance-writer`, from the spec text, in `packages/std-money/conformance/`:
- `parse-money-laws.test.ts` (new): the round-trip and cross-locale properties over `gen(Money)` and every `Locale`.
- `parse-money.test.ts` (new): every accepted and rejected text in the clauses, with `code` and `data`; `Object.is(amount, 0)` for `-0`; no `message` contains its text.
No existing case contradicts the text.

## Migration
None (unreleased).

## Token impact
std.money about 820 to 1,810 tokens, under 3,100. Map budgets unchanged. `@keel/std-money` size: one function and a small grammar; measure in the build and re-base if over.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`. 3. Build:
- `packages/std-money/src/parseMoney.ts`, `ParseMoneyError.ts` (new), `MoneyError.ts` (unchanged), `index.ts`; the exponent table shared with `formatMoney` (an `internal/EXPONENT.ts`).
- `apps/household`: `recordReceipt.server.ts` calls `parseMoney`; `minorUnits.ts` and `test/minorUnits.test.ts` go; the README's receipts bullet says so; the German `amountFormat` names `12,50`.
- Docs: the std-money README, the keel-client skill's forms paragraph (money is a text field read with `parseMoney`), a changeset, `tasks/BACKLOG.md` 1010.

## For the operator
1. **Strict separators: `12.50` in `de-DE` is an error, not 12,50 €.** Recommended: accept; the alternative misreads `1.250`.
2. **Trailing zeros beyond the exponent (`12.500` USD) are an error.** Recommended: accept; one rule, digits not value.
