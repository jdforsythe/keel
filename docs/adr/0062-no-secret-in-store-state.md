# ADR-0062: store state never holds a secret, E1303 (RFC 0073)

**Status:** accepted (2026-11-09), amended the same day after the red-team pass (backlog 0257-0262). The user chose a check rule over a documented limit.

**Context.** The snapshot fold keeps payload secrets out of snapshots, but state is written whole. A reducer that copies `reveal(p.token)` into state writes the plaintext into `state` and the snapshot `initial` (backlog 0239). A state schema holding `s.secret` passes every check and throws at `snapshot()`.

**Decision.**
- **E1303 (k.store, `@keel/check`).** One kernel rule with two cases. (a) The first argument of `store(...)` resolves to a schema holding `s.secret` at any depth. It is read through the file's consts, relative imports into `RuleInput.project` files and method calls on a schema (receiver and arguments), through at most 8 consts, and reported at that argument with the field path. (b) `reveal` from `@keel/schema` (any alias, or `<namespace>.reveal`) is referenced inside a `transaction(...)` function, and is reported at the reference.
- **No fix.** Removing the field or the `reveal` call leaves the code ill-typed, and the field may be in another file.
- **Runtime guard.** `store()` throws `E1303: store <id>: state schema holds s.secret at <path>` at construction, as it throws its other construction errors. The path comes from `secretPathOf` in `@keel/schema/internal` (read only by `@keel/store`). This guard is exact; the static rule is the early, partial signal. A `snapshot()` part that fails its codec throws an E1303 message naming the part and path.
- **Binding, not name.** `store`, `transaction` and `reveal` count only where they bind the import; a shadowing local is skipped. Any `reveal` in a reducer fires, also a compare-only one.
- **Fix text.** Keep the value `s.secret` end to end and reveal it only where it is used (E1105), never into a payload or state field.

**Alternatives.**
- A documented limit, rejected by the user.
- A runtime comparison in `tx`, rejected because it misses derived values and costs every commit.
- Extending E1105, rejected because it would give one code two meanings.
- The static rule alone for (a), rejected because ordinary schema shapes escape it.
- A field-removing fix, rejected as unsafe.

**Consequences.**
- k.store gains E1303 in its Rules and one conformance clause.
- The secret-fold test keeps the runtime behaviour and notes that check time forbids the case.
- Helpers outside the reducer, schemas from packages or factories, and chains past 8 consts are not followed statically; `store()` catches every state schema at run time.
- A revealed value copied into a plain payload or state field is not detectable; backlog 0257 stays open as a design item.
