---
"@keel/store": minor
"@keel/schema": patch
"@keel/check": patch
---

`store(schema, ...)` throws `E1303: store <id>: state schema holds s.secret at <path>` at construction when the state schema holds `s.secret` anywhere, and a `snapshot()` part that fails its codec throws an E1303 message naming the part and path. `@keel/schema/internal` exports `secretPathOf(node)` for it; `hasSecret` uses the same walk. E1303 in `@keel/check` resolves `store`, `transaction` and `reveal` by binding (a shadowing local is skipped), fires on any `reveal` in a reducer, and its explain text says to keep a value `s.secret` end to end and reveal it only where it is used.
