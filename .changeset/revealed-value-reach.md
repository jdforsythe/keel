---
"@keel/check": minor
"@keel/server": patch
"@keel/schema": patch
---

E1112 reports a revealed value reaching more places: `process.stdout.write` and `process.stderr.write`, the `node:fs` writes, `Promise.reject` and a `throw`, under any local name or `.bind()` of a sink. It follows the value through `for...of`, member writes, `push` and the other mutating methods, an alias of `reveal`, and the standard conversions and encodings (`btoa`, `encodeURIComponent`, `Buffer.from`, `structuredClone`). It no longer reports `length`, `size`, a boolean or position method, the left side of `&&`, a field that does not hold the value, a `let` reassigned to another value, or `set` on an app object named `storage`. Its `see` is `k.reveal`.

The server's log writes `[secret]` in place of the revealed value of each `Secret` in the request's action input, in every `diag` record, in dev and production.
