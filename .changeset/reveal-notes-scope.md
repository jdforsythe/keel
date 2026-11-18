---
"@keel/schema": minor
"@keel/server": minor
---

`reveal` calls the listener slot `Secret.of` calls, with the `Secret` it opens, before it opens it. The server walks a revealed `Secret` into the scrub set of the request, live stream or runner `run` that reveals it, once per set, so a secret made at startup, at module scope, in `createApp`'s config or in an earlier request logs as `[secret]` where a scope reveals it. A value revealed outside every scope and kept as plain text logs as written.

A secret's value and each object and array under it are frozen in place once the whole value passes its schema check, so a revealed value cannot change after the server reads it; with `s.secret(s.json())` the caller's own object is frozen, and writing into it throws a `TypeError` in strict mode. A parse that fails returns its err and leaves the caller's object unfrozen, and a value the check or the freeze cannot walk (a typed array, a getter that throws, a revoked Proxy) makes `parse` return an err, never throw.
