# std.report: Tally report
status: conformance-covered

**Extension point.** Output formatter registry (k.cli `formatter`). Importing `@keel/std-report` registers the record kind `report.tally`. Any command or tool that emits a `report.tally` record renders it through k.cli in `compact`, `pretty` or `json`.

**API** (`@keel/std-report`).
- `Tally` is `s.object({ kind: s.literal('report.tally'), id: s.string({ min: 1, max: 60 }), rows: s.array(s.object({ key: s.string({ min: 1, max: 60 }), n: s.int({ min: 1 }) }, { closed: true })) }, { closed: true })`.
- `tallyOf(id, keys: readonly string[])` counts each distinct non-empty key and returns a `Tally` record. Rows are sorted by `n` descending, then by `key` ascending. Empty keys are dropped.
- **compact** is one line: `id` then `key=n` per row, space-separated, for example `orders.status paid=3 open=1`. A tally with no rows renders `id 0`.
- **pretty** is the `id` line, then one line per row with the key left-aligned and padded to the longest key, two spaces, and `n` right-aligned and padded to the widest count.
- **json** is the record encoded by `Tally`, as one NDJSON line (k.cli).

**Rules.** None. A second `formatter('report.tally', ...)` is E1053, and a `report.tally` record that fails `Tally` is E1054 (k.cli).

**Conformance.**
- For generated key lists, `tallyOf` returns a record that parses with `Tally`. Its `n` values sum to the number of non-empty keys, and its rows follow the stated order.
- `respond([tallyOf(id, keys)], { format: 'compact' })` (`@keel/cli/testing`) prints the compact line as its first line, with exit code 0.
- `pretty` prints the `id` line and one line per row. The keys start in one column and the counts end in one column.
- `json` prints the record as one line that parses back to a value equal to the record.
- Compact and json output contain no ANSI escapes or carriage returns.
- A second `formatter('report.tally', ...)` throws E1053.
