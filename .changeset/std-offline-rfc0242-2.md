---
"@keel/std-offline": patch
---

`isWrite` checks `output` and each present `params`, `query` and `body` with `isSchema`; `outbox` takes the scope it is called in (E1203 without one) and makes its store in it at once.
