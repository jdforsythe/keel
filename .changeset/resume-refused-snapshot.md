---
"@keel/runtime-dom": patch
"@keel/store": patch
---

A `#k-state` snapshot a store refuses, whether the store is in `resume`'s `stores` or created while islands resume, is the E1253 warning `#k-state snapshot for store "<id>" does not restore`; the store starts from `initial`.
