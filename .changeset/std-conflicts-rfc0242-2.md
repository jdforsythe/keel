---
"@keel/std-conflicts": patch
---

Reads stores and transactions with `isStore` and `isTransaction` from `@keel/store`; `findRaces` keeps the scope it is called in across its replay and nests the factories' stores in it (E1203 without one).
