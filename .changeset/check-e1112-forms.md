---
"@keel/check": patch
---

E1112 follows a destructuring assignment, a `for...of` head with no declaration, `splice` and `fill`, `new Map`, `new Set`, `Object.fromEntries` and `Array.of`, and a sink called through `.call`, `.apply`, `.bind` or `Reflect.apply`. `length` and `size` of a destructured name end the flow, as they do of any carrying value.
