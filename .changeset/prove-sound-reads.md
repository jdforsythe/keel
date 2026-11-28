---
"@keel/testing": patch
"@keel/cli": patch
---
`prove` no longer reports a transaction proven when an index or map read can miss, an option is read through while absent, or arithmetic leaves ±2^53: each is a counterexample (E1716) or outside the fragment (E1715). The ledger counts a test as `proven` only when its body awaits or returns `prove`.
