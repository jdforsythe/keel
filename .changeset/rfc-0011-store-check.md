---
"@keel/store": minor
"@keel/testing": patch
---

rfc:0011: `Store.check(state)` runs every invariant against a candidate state without committing or logging; `properties(transaction)` uses it and no longer defines the `keel.testing.holds` transaction.
