---
"@keel/testing": minor
"@keel/check": patch
---

`prove` called in a worker thread rejects E1721 before any other check and before Z3 loads: Z3's WASM build can abort or hang when its caller is a worker (rfc:0106). Migration: run proofs in a process, vitest `test: { pool: "forks" }`.
