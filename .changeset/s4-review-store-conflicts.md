---
"@keel/store": patch
"@keel/std-conflicts": patch
---

`restore` refuses a snapshot whose `head` is below its latest entry's id. `races` reports an entry whose base state cannot be rebuilt, or whose `base` is not below its own id, as `unchecked`; `findRaces` skips a stored value that is not a snapshot of a declared store; record keys such as `__proto__` are compared like any other.
