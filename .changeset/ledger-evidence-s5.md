---
"@keel/cli": minor
"@keel/testing": minor
---

`keel ledger` (k.ledger) reads evidence for every rung: `simulate` runs count as property runs, `explore` with `from`, `payloads` or `depth` gives `exhaustive` (with a literal `depth` in the evidence), a closed-form `explore` or a type-level test (`expectTypeOf`, `assertType`) gives `proven`, and an app's `.keel/monitored.json` gives `monitored` to the exports whose files hold a monitored transaction name or its longest held dotted prefix (E1711 when the file fails its shape). Every export of a package's top-level `src` file is an item. Mutation reports become per-file claims keyed by the sha256 of the mutated source, emitted as `ledger.mutation` records; a claim whose file changed is stale (W1714) and leaves its package score. The ledger file gains `rungs` and `mutation` (`packages` with `{ score, threshold }`, and `claims`), replacing `mutationScore`; `--diff` adds E1712 (a committed rung no item holds) and E1713 (a package below its threshold, or a lowered threshold). The summary counts items per rung and stale claims when above 0. `Evidence` gains the `monitored` kind and `depth` and `to`; ledger diagnostics cite k.ledger.
