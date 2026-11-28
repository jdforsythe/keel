---
"@keel/check": patch
---

E1303 reads `reveal` in a transaction function passed by name (a function declaration, a const function, or a function imported from a relative file), through const aliases and destructuring of `reveal`, through `K['reveal']`, and in a `transaction` called through a namespace import of `@keel/store`.
