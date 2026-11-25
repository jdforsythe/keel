---
"@keel/schema": minor
"@keel/store": minor
"@keel/std-sessions": minor
"@keel/std-channels": minor
---

`parse` accepts plain data only, but for the `Secret` at each `secret` node: a `Map`, `Set`, `Date`, typed array, class instance, function, symbol key, non-enumerable key, getter, array hole or extra array key, or a cycle fails with rule `type` at its path, at a declared position, in `s.json()` and under an undeclared key; the input is judged before a `secret` node's copy (k.schema Plain data). A session records store state, `tx` payloads and route values as their schema encodes them (unencodable: `null`), `redact` drops undeclared keys, and later error text drops a marked open object's undeclared keys and values (std.sessions). `perAnonymous` counts the cookieless channel streams of every module in the process (std.channels-limits). `@keel/store` exports `snapshotKeys(snapshot)` (the write keys a restore takes) and `givenPii(entry)` (the marked values of a payload as given, in memory) (k.store).
