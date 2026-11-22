---
"@keel/std-postgres": minor
"@keel/cli": minor
"@keel/check": patch
---

`transaction(fn)` runs at `serializable`, and each lone `query`, `one` and `run` is its own `serializable` transaction, rerun as `fn` is (3 runs, then `keel.conflict`). `{ allow: 'write skew', reason }` runs at `repeatable read`, `{ allow: 'lost updates', reason }` at `read committed`; the `isolation` option and the `Isolation` type give way to `TransactionOptions` and `Allow`. `fn` may answer a union of results. `/tools` registers E2459 (an `allow` without a literal `reason`); `keel review` lists each `allow` as R2451.
