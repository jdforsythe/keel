---
"@keel/std-money": minor
---

`formatMoney(m, locale)` takes a `Locale` and writes `Intl.NumberFormat` currency style over the exact decimal of the amount: `{ amount: 1250, currency: 'EUR' }` is `€12.50` in `en-US` and `12,50 €` in `de-DE`. Migration: `formatMoney(m)` becomes `formatMoney(m, locale)`, with the locale from the route's `params.locale`.
