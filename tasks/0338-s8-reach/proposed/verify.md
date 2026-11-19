# verify lane: spike record and spec sentences to apply (orchestrator, before the root gates)

Commits: d184687 (spike, `packages/testing/spike/board.spike.mjs`), 216e5ea (`prove`), 9d457d5 (ledger rung; `ledgerCommand.ts` evidence line prints `proven z3 5.3.3 <path>`).
Export: `prove<T>(transactions: readonly Transaction<T, unknown>[], options?: { rlimit?: number }): Promise<{ proven: readonly string[]; z3: string }>`; types `Proof`, `ProveOptions`.

## Spike (Z3 5.3.3, default rlimit, one check per transaction; a bounded search with array lengths 0..3 runs first for counterexamples)
| Obligation | Result | ms (3 runs) | rlimit used |
|---|---|---|---|
| addList | proved | 175 / 73 / 69 | 83,662 |
| addTodo | proved | 89 / 78 / 81 | 108,101 |
| toggleTodo | proved | 57 / 54 / 58 | 73,962 |
| editTodo | proved | 56 / 57 / 58 | 73,783 |
| hideList (planned) | proved | 51 / 55 / 57 | 67,918 |
| showList (planned) | proved | 51 / 56 / 55 | 67,918 |
| initial | proved | about 6 | 961 |
| planted addTodo without the duplicate check | counterexample | about 35 | 37,908 |

Encoding: strings and ids are one uninterpreted sort; enum values and literals are distinct constants; records are datatypes, an optional field an option datatype; an array is a length >= 0 plus `(Array Int T)`; `some` is `exists`, `every` is `forall`; `Set(...).size === length` is pairwise distinct; append is a `store` at the length; `map` is a `lambda`.
Limits found: a 2^53-1 cap on array lengths made appends unknown (dropped); Z3 builds no model with the quantified invariant as hypothesis (the bounded search finds counterexamples instead); string min/max lengths are not modelled (over-approximation, sound).
Wasm load 50-60 ms; peak RSS about 230 MB; verdicts, rlimit counts and models byte-equal across runs.

## Proposed k.prove sentences (assertions are loose there; tighten through a conformance-writer once applied)
- E1715: "`<tx>: <construct> at offset <n> is outside the fragment; explore remains`, or `<tx>: no sort for <kind> at state.<path>`."
- E1716: "the JSON is `{"transaction","state","payload"}` (`{"state"}` for `initial`); a string is the model's literal, else `a`, `b`, ... in order of appearance."
- Version: "`prove` resolves `{ proven, z3 }`, `z3` being `major.minor.build` (`5.3.3`)."
- Sorts defect: "every integer result included" would fail `inc` at 2^53-1, which the conformance forbids. Replace with "`s.int` as integers within its bounds, state and payload values also within +-(2^53 - 1)" (same length); add "(string lengths unchecked)".
- Bad arguments (empty or mixed list, bad `rlimit`) reject with k.model's E1710; k.prove names no code: add a clause or accept.

Without Z3 installed a `prove` test counts as `example` in the ledger. A store whose `initial` breaks an invariant is constructible (D7 confirmed).
Bytes: `@keel/testing/prove` 7,255 of 7,680; `@keel/testing` 13,036; `@keel/cli` 25,405 of 24,832 (OVER: it was 25,163 before the verify commit, from other lanes' work; re-base when the lanes finish).
