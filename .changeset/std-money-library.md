---
"@keel/std-money": minor
---

`@keel/std-money` is a library (k.library): a module that imports it lists `@keel/std-money` in `deps`. `Currency` and `Money` live in `*.schema.ts` files, and the `./tools` entry registers `money.Currency` and `money.Money`, so `keel check` and `keel build` see the named schemas. `formatMoney`'s decimal-string call to `Intl.NumberFormat` and its throw for an amount with no decimal form sit in `unsafe/` with their reasons.
