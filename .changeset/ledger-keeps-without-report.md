---
"@keel/cli": patch
---

`keel ledger` keeps the committed rung of an `a11y` item when its project holds no `reports/a11y.json` (the summary counts them as `keptNoReport`), and drops the claim of a file whose report entry holds only ignored mutants, so W1714 and `mutate-stale` agree.
