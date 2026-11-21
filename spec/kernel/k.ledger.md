# k.ledger: Ledger and evidence
status: conformance-covered

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`), per spec clause (`k.router#3`, the 1-based Conformance sentence) and per route and WCAG criterion (`a11y:<routeId>#1.4.3`, k.a11y). A conformance test names its clause in a header comment, `// Spec: k.router, clause "<sentence>"`, quoted verbatim (backticks, quote style, spacing, case and the final period aside; it may wrap onto the next `//` lines). `rung` is the highest held:
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a passing `explore` (k.model) given `from`, `payloads` or `depth`; evidence lists `depth` when it is a literal.
- `proven`: a passing type-level test (its body calls `expectTypeOf` or `assertType`, type-checked by the package's `check`), a passing closed-form `explore` (k.model), passing only when the store's whole space closed, or a passing `prove` its body awaits or returns (k.prove; evidence: Z3 version); nothing else claims it.
- `monitored`: production only, read from an app's `.keel/monitored.json`; never emitted by the kernel. No evidence: `none`.

**Evidence from tests.** A test references an item when its body, or a helper it calls in its own file or a relative import, uses it by name; a shadowed import or a mention only in a type is no use. Property runs are `properties`, `simulate` (k.sim) and fast-check's `assert` and `check`, with `runs` and `seed` read from literal options or imported constants (`properties` and `simulate` default to 100 and 1337); an unresolved value leaves the run `example`. An `explore` call is closed-form when its options object is absent or names none of `from`, `payloads` and `depth`; options the ledger cannot read count as given.

**Production evidence.** An app's `.keel/monitored.json` is `{ v: 1, origin, from, to, tx: { [name]: runs } }`, written by std.monitor. An app export holds `monitored` when its file holds, as a string literal, the name of a transaction with `runs` >= 1, or that name's longest dotted prefix that any file holds (a chart id); evidence lists the runs and `to`. A file failing this shape adds nothing.

**Mutation.** Stryker (`pnpm mutate`, never inside `pnpm check`) writes `packages/<pkg>/reports/mutation/mutation.json`. `keel ledger` turns each report into one claim per mutated file, `{ file, sha, killed, survived, noCoverage, score }`: `sha` is the sha256 of the source the report holds for that file, and `score` is detected over detected plus undetected (Stryker's formula, timeouts detected). A claim is fresh while the file's current source has that `sha`. Each package's score is computed over its fresh claims, with the report's `thresholds.break` as its threshold. `keel ledger` emits one `{ kind: 'ledger.mutation', file, score, survived, fresh }` per claim; compact `packages/store/src/tx.ts 91.2% 3 survived`. `ledger` and `ledger.mutation` are kernel record kinds (k.cli).

**File.** `keel ledger --write <file>` writes `{ version, unsafe, hostElements, rungs, mutation, exports, clauses, a11y }`: `rungs` counts, per rung, the items with evidence on it; `mutation` holds each package's `{ score, threshold }` and the claims, a report on disk replacing its files' claims only, a claim with no file dropped. The summary's `counts` carry the `rungs` and `stale` counts. E1005 (k.compiler) passes over an app's `.keel/ledger.json` and `.keel/monitored.json`.

**Diff.** `keel ledger --diff` compares with the committed ledger, reading reports on disk as `--write` does, and checks every `conformance-covered` or `frozen` section's clauses.

**Rules.** E1706 ledger rung lower than committed, or unsafe count higher · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it) · E1711 `.keel/monitored.json` fails its shape · E1712 `--diff` without `--scope`: a rung the committed `rungs` counts above 0 is held by no item · E1713 `--diff`: a package's score over fresh claims is below its threshold, or its threshold is below the committed one, or it has claims and none fresh; under `--scope` only a package inside it fails, and I1713 counts the rest · W1714 a stale mutation claim.

**Conformance.**
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
- A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line.
- A passing `simulate` with `runs: 100` and a literal seed makes the exports its scenario names `probabilistic`.
- A passing `explore` with `from`, `payloads` or `depth` makes the transactions it names `exhaustive`; one with none of them makes them `proven`; one whose options are an imported variable gives `exhaustive`.
- A `.keel/monitored.json` naming `todos.editor.save` with runs 3 gives `monitored` evidence to the export whose file holds `'todos.editor'` and to no other; a file failing its shape is E1711.
- From a report whose sources match the tree, `keel ledger --write` stores one claim per mutated file with Stryker's counts, and the package score over them; after one file changes, its claim is stale (W1714) and the package score omits it.
- With a committed ledger whose `rungs.monitored` is 1, removing `.keel/monitored.json` makes `--diff` report E1712.
- A report whose package score is below its `thresholds.break`, or whose `thresholds.break` is below the committed threshold, makes `--diff` report E1713.
- A passing test whose body asserts with `expectTypeOf` makes the exports it names `proven`.
- A passing `prove` makes the transactions it names `proven`.
