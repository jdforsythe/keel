# RFC 0171: k.ledger: a range clause holds a rung only while every code in it is named by a citing file

Status: implemented (ADR-0194). For backlog 0270 and the k.ledger half of 0531.

## Decisions
- D1: a range clause is a Conformance clause whose text holds the word `each` and a code range: two codes of one letter joined by `-` or ` to `, the first lower (`E2001-E2005`, `E2401 to E2406`). A clause naming a range without `each` ("reports no E1151-E1156") is an ordinary clause.
- D2: a range clause has evidence only while each code of the range is named, as a whole code, outside the quoted clause, in the header comments of a citing file that has a non-skipped test. A range written in a header (`E1502-E1506`) names its two ends only.
- D3: the header is the file's whole header (every `//` line before its first statement other than an import), not only the `// Spec:` block that quotes the clause, so a file that names its codes on later `// Spec: … rule E2751` lines counts them.
- D4: when the codes are all named, the evidence is that of every citing file, as for any clause. The rule decides whether the clause holds a rung, not which tests give it.
- D5: no new diagnostic. A range clause that loses a code falls to `none`, which E1706 (rung lower than committed) and E1707 (a `conformance-covered` section with a clause at `none`) already report.
- D6: the k.testing half of 0531 (backlog 0317: `find` exposes no `lang` and no node identity) is its own line and its own RFC; this RFC does not touch k.testing.

## Problem
`packages/cli/src/internal/buildLedger.ts` gives a clause the tests of every conformance file whose `// Spec:` header quotes it (`citesClause.ts`: the quoted clause, with or without its final period). One citing file is enough. std.sessions' "E2001-E2005 each fire on a fixture, not on its clean twin." is cited by five files, one per code (`packages/std-sessions/conformance/E2001-redact-path.test.ts` … `E2005-adapter-not-node.test.ts`). Rename `E2003-replay-input.test.ts` to `.skip.ts`, or skip its tests, and the clause stays covered: no gate notices that a rule lost its fixture.

The same holds for every clause of this shape, read on 2026-11-21:

| Clause | Citing files | Codes their headers name today |
|---|---|---|
| std.sessions#11 `E2001-E2005 each` | five, one per code | all five |
| std.jobs#8 `E2501-E2504 each` | `e2501` … `e2504` | all four, but only `e2503.test.ts` quotes the whole clause; the other three quote a prefix, which `citesClause` does not count |
| k.errors#8 `Each of E1451-E1454` | `check/conformance/fixture-per-code.test.ts` | none |
| k.router#8 `E1501-E1506 each` | `router/conformance/rules-e1501-e1506.test.ts` | all but E1503 |
| std.messages#8 `E2401 to E2406 each` | `std-messages/conformance/rules-e2401-e2406.test.ts` | all six (second `// Spec:` line) |

std.statecharts#6 and std.health#2 hold no `each` and stay ordinary clauses.

## Proposal
One sentence in k.ledger Ledger and one Conformance bullet. The ledger reads, for each range clause, the codes of its range and the header comments of each citing file that has a non-skipped test; a code counts when it appears there as a whole code outside the quoted clause. While every code counts, the clause's evidence is as today; otherwise it has none.

```ts
// packages/std-sessions/conformance/E2003-replay-input.test.ts
// Spec: std.sessions, clause "E2001-E2005 each fire on a fixture, not on its clean twin." (E2003)
```

With that file gone, or every test in it skipped, E2003 is named by no file with a non-skipped test, std.sessions#11 is `none`, and `keel ledger --diff` reports E1706 against the committed ledger and E1707 while std.sessions is `conformance-covered`.

## Alternatives
- One clause per code in each section (the backlog's second fix): six sections, all at the 1,500-token cap, grow by about 20 bullets, and a file that tests several codes would cite several clauses; the next range written in prose reopens the gap.
- Read codes from test titles (`test("E2003 fires …")`): finer (a single skipped test counts), but titles are often template literals (`${code}: its fixture …`) the ledger cannot read statically, and the ledger reads no titles today.
- A new warning for a range clause with an unnamed code: E1706 and E1707 already fail the gate at the clause; a second code says the same thing.
- Count every code-shaped clause, `each` or not: "reports no E1151-E1156" is one negative test over the whole range, and would fall to `none` for no reason.

## Spec diff
- k.ledger Ledger, after the header sentence: "A clause with `each` and a code range (`E2001-E2005`, `E2401 to E2406`) has evidence only while each of its codes is named, outside the quote, in the header of a citing file with a non-skipped test (`(E2003)`; a range names its ends)."
- k.ledger Conformance, new bullet 12: "\"E2001-E2003 each fire.\" cited by files adding `(E2001)`, `(E2002)`, `(E2003)` is `example`; skipping one file's tests, or one file adding `(E2001-E2003)` alone, gives `none`; \"No E2001-E2003.\" cited by a file naming no code is `example`."
- To stay within 1,500 tokens, prose already stated elsewhere is cut: the `proven` bullet's "passing only when the store's whole space closed" (k.model Closed form); the `monitored` bullet's "never emitted by the kernel"; Mutation's "never inside `pnpm check`", "Stryker's formula", the compact example and the record-kind sentence (`docs/OUTPUT.md` `ledger.mutation`); the Diff paragraph folds into File, dropping "checks every `conformance-covered` or `frozen` section's clauses" (E1707). No Conformance bullet changes.
- k.ledger status `proposed` (section and map row) until the build lands.

## Conformance diff
By the `conformance-writer`, under `rfc:0171`:
- `packages/cli/conformance/ledger-range-clause.test.ts` (new), from bullet 12, over in-memory spec and conformance files given to `buildLedger`'s public command (`keel ledger --format=json`): the three cases. Its own header quotes bullet 12, which holds `each` and `E2001-E2003`, so it adds `(E2001, E2002, E2003)` after the quote.
- Headers, so the existing range clauses keep their rung once built: `packages/check/conformance/fixture-per-code.test.ts` adds `(E1451, E1452, E1453, E1454)`; `packages/router/conformance/rules-e1501-e1506.test.ts` names E1503; `packages/std-jobs/conformance/e2501.test.ts`, `e2502.test.ts` and `e2504.test.ts` quote the whole std.jobs#8 clause.
- Retag two prose quotes to the trimmed bullets (not ledger-counted): `packages/cli/conformance/ledger-type-level-proven.test.ts` (`proven`) and `ledger-explore-rung.test.ts` (`exhaustive`, "evidence lists a literal `depth`").

## Token impact
k.ledger 1,497 to 1,500 tokens; 12 Conformance clauses. Map 1,335 to 1,332 (status word).

## Build order
1. This commit. 2. `conformance-writer` (the new suite and the five headers). 3. Build in `packages/cli/src/internal/buildLedger.ts` (a range-clause reader beside `citesClause.ts`), `tooling/ledger/ledger.json` regenerated, k.ledger back to `conformance-covered`.

## For the operator
- std.jobs#8 is held today by `e2503.test.ts` alone, since three of its four files quote a prefix; the build makes that visible. Recommendation: the header fix above, in the conformance commit.
- k.testing's `find` `lang` (0317) is left to its own RFC (D6).
