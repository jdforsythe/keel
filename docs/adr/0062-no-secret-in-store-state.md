# ADR-0062: store state never holds a secret, E1303 (RFC 0073)

**Status:** accepted (2026-11-09). The user chose a check rule over a documented limit.

**Context.** The snapshot fold keeps payload secrets out of snapshots, but state is written whole. A reducer that copies `reveal(p.token)` into state writes the plaintext into `state` and the snapshot `initial` (backlog 0239). A state schema holding `s.secret` passes every check and throws at `snapshot()`.

**Decision.**
- **E1303 (k.store, `@keel/check`).** One kernel rule with two cases. (a) The first argument of `store(...)` resolves to a schema holding `s.secret` at any depth. It is read through the file's consts and relative imports into `RuleInput.project` files, up to depth 8, and reported at that argument with the field path. (b) `reveal` from `@keel/schema` (any alias, or `<namespace>.reveal`) is referenced inside a `transaction(...)` function, and is reported at the reference.
- **No fix.** Removing the field or the `reveal` call leaves the code ill-typed, and the field may be in another file.
- **Runtime unchanged.** `snapshot()` still throws for a secret in state, for what the rule cannot resolve.

**Alternatives.**
- A documented limit, rejected by the user.
- A runtime comparison in `tx`, rejected because it misses derived values and costs every commit.
- Extending E1105, rejected because it would give one code two meanings.
- A field-removing fix, rejected as unsafe.

**Consequences.**
- k.store gains E1303 in its Rules and one conformance clause.
- The secret-fold test keeps the runtime behaviour and notes that check time forbids the case.
- Helpers outside the reducer and schemas from packages or factories are not followed.
