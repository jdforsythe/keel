---
"@keel/check": minor
---

E1112 (k.privacy): in app code, a value `reveal` returns reaching an argument of `tx` or `store`, `set` or `commit` on a `storage`, a `console` method or an `Error` constructor is reported at the argument, followed through same-file locals; no fix. `keel explain E1112` names the fix: pass the `Secret`, or store a derived value such as a salted `scrypt` hash.
