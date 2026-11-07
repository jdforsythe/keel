# ADR-0017: Typed `tx`, log entry `meta`, `undoWhere` (RFC 0028)

**Status:** accepted
**Context.** `tx` took `payload: unknown`, so wrong payloads failed only at run time (0038). The server kept caller attribution of log entries in a side map and undid in two steps (0082, 0100).
**Decision.** `tx` types `payload` from the transaction's schema (`NoInfer<P>`); a value typed exactly `unknown` is also accepted and checked at run time as before. `tx(t, payload, { meta })` records a JSON record on the entry, never in state; `snapshot()` drops it, `snapshot({ meta: true })` keeps it, `restore` keeps what it is given. `undoWhere(pred)` undoes the latest entry only when it matches.
**Alternatives.** Typed-only `tx` (forces casts for replay), a second write function (two spellings), meta in every snapshot (per-sink redaction), ambient meta from the scope chain (action at a distance), undoing an older matching entry (reorders state).
**Consequences.** Payload mistakes are compile errors at every typed call site; conformance that feeds arbitrary values types them `unknown`. Client snapshots never carry meta. Attribution travels with the entry when the caller passes it; the server can drop its tag map once actions pass `{ meta: { caller } }`.
