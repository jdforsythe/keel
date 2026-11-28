# ADR-0086: model checking is a store-native `explore` (RFC 0082)

**Status:** accepted (2026-11-10), user decision D1, under the WORKFLOW RFC defaults 1, 2 and 3.

**Context.** `properties` samples generated states and payloads, so a transaction that breaks an invariant only from a rarely generated state passes. Nothing enumerated the states a store reaches, the ledger had no producer for `exhaustive`, and RFC 0081's race finder checks only the orders a session group recorded.

**Decision.** k.model, a new kernel section implemented in `@keel/testing`. `explore(transactions, { from?, payloads?, depth?, maxStates = 10000 })` walks one store's transactions breadth first, runs each edge on the path `properties` uses (restore, `tx`, read, restore), dedupes states by their JSON encoding with keys sorted, and checks the store's invariants on every edge. Payload domains come from finite payload schemas (at most 256 values) or from `payloads`. A broken invariant or a throw is E1708 with the shortest path as a k.store snapshot, replayed by `restore` and one `tx`. With none of `from`, `payloads` and `depth` (the closed form) it must cover every transaction of the store from an empty log and exhaust the space, and claims `proven`; any other passing run claims `exhaustive`. E1709 marks a bound reached first, E1710 a bad argument or a domain that is not finite.

**Alternatives.**
- TLA+, Alloy or Apalache, rejected: a second, hand-written model in another language on a Java toolchain, whose verdict says nothing about the TypeScript that runs.
- fast-check model-based testing (`fc.commands`, `fc.modelRun`), rejected: random sequences, never exhaustive, against a model that duplicates the transactions.
- Extending std.conflicts' `races` to search, rejected: it would change RFC 0081's accepted contract; `races` stays an order check over a recorded log.

**Consequences.**
- `explore` is the one search over a state space; `simulate` and `races` do not search.
- Stores keyed by strings get `exhaustive` within a depth and chosen payloads, never `proven`.
- No symmetry or partial-order reduction; the ceiling is 1,000,000 states.
- `@keel/testing` grows about 1.2 kB; its budget is re-based to 10 kB with `simulate`.
