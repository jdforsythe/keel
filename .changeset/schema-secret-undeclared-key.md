---
"@keel/schema": minor
---

An open object fails `parse` with rule `type` at a `Secret` anywhere under a key it does not declare, so a store transaction that spreads a payload holding a secret into state throws and commits nothing. The marker string and plain values under an undeclared key still parse, and a declared `s.secret` key is unchanged.
