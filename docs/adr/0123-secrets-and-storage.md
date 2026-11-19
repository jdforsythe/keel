# ADR-0123: what `reveal` returns is plain data; E1112 reports a revealed value reaching storage or a log (RFC 0100)

**Status:** accepted

**Context.** S8 makes server state durable on SQLite and Postgres. A `Secret` never gets there: `store()` refuses `s.secret` in state (E1303), `snapshot()` folds secret payloads out, and a plain or JSON field refuses a `Secret`. A value `reveal` returns is a plain string at run time. Written into a `tx` payload, `meta`, a store's `initial`, `ctx.storage`, `console` or an `Error` message, it is kept as written. No rule fires: E1105 allows `reveal` in a server file, and E1303 reads only transaction functions. Neither the store nor `commit` nor a driver can tell a revealed string from another one.

**Decision.**
- D1: no new runtime guard. k.privacy states once that what `reveal` returns is plain data, and k.store, k.persist and std.db point to it.
- D2: E1112 (k.privacy, no fix). In app code, a revealed value may not reach an argument of `tx` or `store`, `set` or `commit` on a `storage`, a `console` method or an `Error` constructor. The rule follows the value by lexical scope through same-file bindings, members, spreads, literals, templates, operators, `await`, `String()`, `JSON.stringify()` and methods on it, over `globalRefs` as E1603 does. Any other call, a parameter and an import end the flow, so a hash passes.
- D3: a credential is kept as a salted `scrypt` hash computed in server code. The salt comes from `ctx.random.id`, and the check uses `timingSafeEqual`. A helper API goes to the backlog.
- D4: a response is not a sink.
- Budget: `@keel/check` to 49.25kb.

**Alternatives.**
- `s.secret` in a store schema with the marker stored. Rejected: the marker fails `secret-missing` on `restore`, so the store would not restore after its first save.
- A runtime registry of revealed values checked at save. Rejected: one request's `reveal` would decide another's save, which is action at a distance, and short values would collide.
- Every call carries its arguments. Rejected: the documented hash would be reported.
- Report what the rule cannot read. Rejected: an error with no fix would fire on correct helpers.
- Widen E1303. Rejected: storage, `console` and `Error` are not store state, and k.store has no room.

**Consequences.**
- The backlog 0257 flow, `tx(copy, { t: reveal(p.k) })` in a server action, fails `keel check` before it can reach a database.
- A revealed value passed to a helper, an import or an encoding call, std.jobs' `enqueue`, a response, and an `s.string` password all still pass. The threat model says the rules stop accidents, and an author who means to store a secret can always do so.
- k.privacy is at 1,464 tokens and k.store at 1,500.
- `@keel/check` grows 865 B.
