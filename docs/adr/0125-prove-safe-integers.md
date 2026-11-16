# ADR-0125: `prove` holds every post-state integer within ±(2^53 − 1) and says so in the counterexample (RFC 0102)

**Status:** accepted (user decision 2026-11-16: the safe-integer limit becomes an obligation). D3, D4 and D6 are for the orchestrator to accept or reverse under the WORKFLOW RFC defaults; RFC 0102 Questions lists them.

**Context.** `prove` (ADR-0108) assumes each `s.int` of the pre-state and the payload within its bounds and ±(2^53 − 1), and proved the post-state against its bounds only. k.prove Sorts stated the gap as a limit: an integer with no bound may reach 2^53 and its transaction is still `proven`. `s.int` refuses an integer outside the safe range and the store throws when a transaction's result does not parse, so `inc` (`n + 1`) on `{ n: s.int({ min: 0 }) }` was `proven` and throws from a state at 9007199254740991. The same held for a decrement with no `min`, a `map` over an integer array, an optional integer and a literal 2^53. An array's length had no upper bound in the model, so `items.length + 1` rejected with a state longer than 2^53 items, printed as 64. `keel explain E1716` has no row, and the message read `breaks the schema or an invariant` for every counterexample.

**Decision.**
- D1: the goal holds every `s.int` of the post-state, at any depth, within ±(2^53 − 1), the range `s.int` parses. One sentence in k.prove Sorts replaces the limit sentence. `n + 1` on a field with no bound and no guard rejects E1716 with the state at the edge.
- D2: the check is the existing "the post-state parses" term with the integer range switched on. A copy passes by assumption, so the rule bites on an arithmetic result or a literal written to the state. Intermediate `+`, `-`, `*` results keep ±2^53. A non-integer `s.number` gets no rule.
- D3: E1716 keeps its code and JSON. When only an integer range breaks, the first line is `<tx> leaves the safe integer range from this state; bound the schema or guard it`. On a counterexample the solver checks the goal without the integer ranges, within the same array bound; a counterexample of that part is reported first, under the line it has today.
- D4: a state or payload array is assumed to hold at most 2^32 − 1 items. The post-state's arrays get no such check.
- D5: k.prove's first Conformance bullet takes a bounded counter (`{ n: s.int({ min: 0, max: 9 }) }`, `inc` as `n < 9 ? n + 1 : n`); a second bullet holds the unbounded `inc` as the rejecting case and a length write as a proving one. k.prove goes from 1,348 to 1,443 tokens.
- D6: `@keel/testing/prove` goes from 7,825 to 7,973 B gzip on the prototype and is re-based from 7.75kb to 8kb.

**Alternatives.**
- Keep the limit sentence. Rejected by the user: `proven` would cover a transaction that throws in the store.
- A warning in the result. Rejected: a resolved `prove` is the `proven` rung, and a field no test reads lowers nothing.
- Require a `max` on every `s.int` of a proven store, as E1715. Rejected: a `max` does not make `n + 1` hold, and a field that is only copied needs none.
- Check only arithmetic results that reach the state. Rejected: same verdicts, a second traversal, a longer sentence.
- Tighten the intermediate rule to ±(2^53 − 1) in place of a post-state check. Rejected: a literal 2^53 would pass, and `n + 1 - 1` would reject though it runs exactly.
- One first line for every counterexample. Not taken: 7,845 B and no re-base, and no word to the author about a bound.

**Consequences.**
- A proof over a transaction that changes an unbounded integer by arithmetic rejects E1716 until the schema has a bound and the write a guard (`n < 9 ? n + 1 : n`). A `max` alone moves the counterexample to the bound; a guard against the literal `9007199254740991` proves with no `max`.
- `n * 2` and `n + p.by` on unbounded integers, which rejected before, reject under the safe-range line.
- A length written to an integer field proves, `items.length + 1` included.
- golden-1 is unchanged: its board schemas hold no integer, and its six transactions prove in 407 ms before and 423 ms after.
- In `packages/testing`, three conformance fixtures take the bounded counter (`prove-counter`, `prove-e1717`, `prove-result`), and two unit tests change (`prove.pairs`, and one pinned counterexample in `prove.board`, whose model the array cap changes).
- A proof runs no extra check; a rejection runs one more.
- Still open: the line does not name the field, a record prints as `{}` in a counterexample, the guard's bound is a literal (`Number.MAX_SAFE_INTEGER` is E1715), and `keel explain` knows none of E1715 to E1718.
- k.prove has 57 tokens of room and the entry 219 B under its new limit.
