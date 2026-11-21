# ADR-0194: k.ledger: a range clause holds a rung only while every code in it is named by a citing file (RFC 0171)

**Status:** accepted (the orchestrator under the RFC defaults, 1: the spec is the contract).

**Context.** The ledger gives a clause the tests of every conformance file whose `// Spec:` header quotes it, and one citing file is enough. A clause such as "E2001-E2005 each fire on a fixture, not on its clean twin." is held by five files, one per code, so a lost or skipped fixture left the clause covered and no gate noticed.

**Decision.** A clause holding `each` and a code range (two codes of one letter joined by `-` or ` to `, the first lower) has evidence only while each code of the range is named, as a whole code outside the quote, in the header of a citing file with a non-skipped test; a header range names its two ends. The header is every `//` line before the first statement other than an import. When all codes are named, the evidence is that of every citing file. A clause that loses a code falls to `none`, reported by E1706 and E1707; no new code. An escaped quote (`\"`) in a header reads as a quote.

**Alternatives.**
- One clause per code: about 20 more bullets over six sections at the token cap; the next prose range reopens the gap.
- Codes from test titles: titles are often template literals the ledger cannot read statically.
- A new warning: E1706 and E1707 already fail the gate at the clause.
- Every code-shaped clause, `each` or not: "reports no E1151-E1156" is one negative test and would fall to `none` for no reason.

**Consequences.** Skipping or deleting one fixture of a range clause drops the clause and fails `keel ledger --diff`. A citing file names its code in its header (`(E2003)`).
