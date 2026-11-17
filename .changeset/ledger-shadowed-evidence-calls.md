---
"@keel/cli": patch
---

The ledger no longer counts an evidence call whose callee a local binding shadows: a `const`, parameter, destructured local, named class expression, enum or namespace named `properties`, `simulate`, `explore`, `prove`, `expectTypeOf`, `assertType` or `fc` earns no rung.
