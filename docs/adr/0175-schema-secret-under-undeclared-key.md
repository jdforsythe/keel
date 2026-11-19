# ADR-0175: k.schema: an open object refuses a `Secret` under an undeclared key (RFC 0153)

**Status:** accepted (orchestrator, under the RFC defaults; for the user to confirm).

**Context.** A transaction spreading a payload that holds `s.secret` into an open state object committed the `Secret` under an undeclared key: live state held a secret that `snapshot()` dropped, although `store()` refuses a state schema with a secret.

**Decision.** `parse` of an open object fails with rule `type` at each `Secret` under an undeclared key, at any depth, in the same walk that refuses prototype keys there.

**Alternatives.**
- Strip undeclared keys at every commit: copies the state each commit and reruns every reader.
- A store-only walk after each commit: a second pass, and other open objects still carry secrets.
- A static check only: partial by construction.

**Consequences.** State never holds a secret, so live, snapshot and replayed state agree on secrets; any open-object value carrying a stray `Secret` is refused at its boundary, and `encode` of one throws.
