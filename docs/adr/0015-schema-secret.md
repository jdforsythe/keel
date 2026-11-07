# ADR-0015: Secrets are a schema kind read by one function (RFC 0026)

**Status:** accepted
**Context.** THREAT-MODEL promised `Secret<T>` without a spec or code (red-team 0088). Every sink (JSON, logs, `#k-state`, sessions, store snapshots) serializes through `encode` or `JSON.stringify`.
**Decision.** `s.secret(inner)` parses to a `Secret<T>` holding the value in a private field; every conversion prints `"[secret]"`; decoding the marker fails with rule `secret-missing`; `reveal(secret)` is the only read path, allowed only in `*.server.ts` (E1105, check rule pending).
**Alternatives.** `secret.use(fn)`: harder to check statically. Per-sink redaction lists: opt-in and forgettable. WeakMap storage: needs a cast.
**Consequences.** Secrets are safe in every sink by type, not by configuration. Secrets do not round-trip, so they cannot live in store state. Exhaustive switches over schema node kinds and rules gain a `secret` / `secret-missing` case.
