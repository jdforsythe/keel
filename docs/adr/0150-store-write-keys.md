# ADR-0150: store write keys outlive the undo log (RFC 0128)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** A store kept the write keys of its last `logLimit` keyed commits, so `logLimit: 0` deduped nothing and a server store forgot a key after 256 keyed writes from other callers. k.sync conformance bullet 11 pinned that coupling.

**Decision.**
- D1: a `store` option `keyLimit`, default 1024, bounds `keys` on its own; `logLimit` bounds the undo log only.
- D2: a `keyLimit` that is not a positive integer makes `store` throw with the existing options error. Reversible.
- D3: `snapshot()` holds at most `keyLimit` keys; `restore` keeps the latest `keyLimit`.
- D4: k.sync bullet 11 now reads `keyLimit` where it read `logLimit`; its two conformance files change with it.

**Alternatives.**
- `max(logLimit, 256)`: still forgets on a busy store.
- A new E-code for `key` on a `logLimit: 0` store: fixes half.
- `keyLimit: 0` as "no dedupe": silently disables a guarantee.

**Consequences.**
- A server store's persisted snapshot can carry up to 1,024 keys, about 90 KB.
- A retry stays safe for `keyLimit` keyed writes on the server store, whatever its `logLimit`.
- `@keel/store` grows about 25 bytes gzip, to about 3,350 of 3,584.
