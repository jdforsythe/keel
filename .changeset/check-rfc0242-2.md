---
"@keel/check": minor
---

The type pass finds E1451, E1452, E1455 and E1207 callees by symbol (aliases, namespace members, literal computed members, `call`, `apply`, `bind`, `Reflect.apply`) and reports any other value use of them. E1451 adds `Promise.reject`; E1452 adds `.then(f, g)`, `Promise.allSettled`, `Promise.any` and control leaving a `finally`. New E1762 (a type predicate claiming a call signature or its own type parameter outside `unsafe()`, lifted in ranges) and E1208/E1203 for `scope` and the reactive primitives called after an `await`.
