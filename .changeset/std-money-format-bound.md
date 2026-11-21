---
"@keel/std-money": patch
---

`formatMoney` throws for an amount that is not a safe integer within the `Money` bound, in every currency, instead of rounding or formatting it.
