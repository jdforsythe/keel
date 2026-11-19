# ADR-0108: `prove` checks inductive invariants with Z3 over a declared fragment (RFC 0085)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 1, 3 and 6.

**Context.** TESTING.md lists SMT under the `proven` rung. RFC 0082's closed-form `explore` proves invariants only when every payload schema is finite, so golden-1's board, keyed by string ids in arrays, holds `exhaustive` at best. A sound proof needs a decision procedure over the transactions as written, and Keel transactions are pure, named and schema-typed.

**Decision.** `prove(transactions, { rlimit })` in `@keel/testing/prove` (Node) translates each transaction and invariant function from its source into SMT, with sorts from the schemas, and asks Z3 (`z3-solver`, an optional peer dependency) whether a state satisfying the invariants and a valid payload can break one. `unsat` for every transaction, with `initial` passing `check`, is an induction proof and k.ledger's `proven`. A `sat` model is E1716 with the state and payload, possibly unreachable; a construct outside the fragment is E1715 with no claim; no verdict within the resource limit is E1717; a missing solver is E1718. The fragment covers golden-1's map-based transactions and invariant; the verify lane's first commit measures Z3 on those six obligations.

**Alternatives.**
- Bounded enumeration only, rejected: it yields `exhaustive`, which `explore` already gives.
- Symbolic execution of all TypeScript, rejected: unsound where it cannot model the language.
- TLA+, Alloy or Dafny models, rejected: a second model of the app and another toolchain.

**Consequences.**
- Unbounded numeric and keyed domains can reach `proven`; `filter`, loops and calls stay at `explore`'s rung.
- A verdict uses a resource count, not wall time, so it repeats; it is tied to the Z3 version the evidence records.
- `z3-solver` is 40 MB and installed only by projects that call `prove`.
