# @keel/std-report

**Spec:** std.report · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `Tally` (closed `{ kind: 'report.tally', id, rows: { key, n }[] }`), `tallyOf(id, keys): Tally`.
- **Invariants:** importing the package registers the formatter for kind `report.tally`. Rows: `n` descending, then `key`; empty keys dropped. compact `id key=n ...` (`id 0` when empty); pretty aligned columns; json is the record encoded by `Tally`.
- **Dependencies:** `@keel/cli`, `@keel/schema`.
- **Rungs:** conformance (example + probabilistic, through `@keel/cli/testing` `respond`), property for `tallyOf`.

## Extension points

Uses the **output formatter registry** (k.cli `formatter`).

## Unsafe

count: 0
