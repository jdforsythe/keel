# std.report: Tally report
status: implemented

**Extension point.** Output formatter registry (k.cli `formatter`). Importing `@keel/std-report/tools` registers the record kind `report.tally` and the `report` command. Any command or tool that emits a `report.tally` record renders it through k.cli in `compact`, `pretty` or `json`.

**API** (`@keel/std-report`).
- `Tally` is `s.object({ kind: s.literal('report.tally'), id: s.string({ min: 1, max: 60 }), rows: s.array(s.object({ key: s.string({ min: 1, max: 60 }), n: s.int({ min: 1 }) }, { closed: true })) }, { closed: true })`.
- `tallyOf(id, keys: readonly string[])` counts each distinct non-empty key and returns a `Tally` record. Rows are sorted by `n` descending, then by `key` ascending. Empty keys are dropped.
- **compact** is one line: `id` then `key=n` per row, space-separated, for example `orders.status paid=3 open=1`. A tally with no rows renders `id 0`.
- **pretty** is the `id` line, then one line per row with the key left-aligned and padded to the longest key, two spaces, and `n` right-aligned and padded to the widest count.
- **json** is the record encoded by `Tally`, as one NDJSON line (k.cli).

**Entries.** The main entry is data only, `Tally` and `tallyOf`: it imports `@keel/schema` alone and registers nothing, so a deployable's server and browser code import it. `@keel/std-report/tools` is the CLI-time half (k.module **Std config**): it has no exports, calls `formatter('report.tally', ...)` and `stdCommand('report', op)` (`@keel/cli`), and `keel check`, `keel build` and `keel report` load it for a project with the package in a module's `deps`.

**Reaching a person.** An app serves a tally as an inspect section (k.cli **Inspector hooks**):
```ts
inspector({ id: 'orders.status', schema: Tally, read: (ctx) => tallyOf('orders.status', statuses(ctx)) })
```
`keel report [url]` (default `http://localhost:5173`) fetches `<url>/__keel/inspect` from the running dev app. It emits one `report.tally` record per section whose `value` parses with `Tally`, by section id ascending, then a `summary` named `report` whose one count is `tallies` (`ok report 1 tallies`). A section of another shape, or one holding an `error`, is skipped. A target that is unreachable, not 2xx or not an inspect document is E1056, exit 1. Without `@keel/std-report` in the project's `deps` the command is I1055, exit 0 (k.cli).

**An app's own route.** A `url` with a path beyond `/` or a query names a route the app serves behind its own guard, in a build too. It is fetched as given, once; `/__keel/inspect` is not. A 2xx JSON body that parses with `Tally` or `s.array(Tally)` is emitted, an array in its order, then the summary; any other answer is E1056, exit 1, naming the URL without its query. `KEEL_REPORT_TOKEN` in the environment is sent as the caller cookie, as `keel session ingest` sends its token; Keel stores none.

**Rules.** None. A second `formatter('report.tally', ...)` is E1053, and a `report.tally` record that fails `Tally` is E1054 (k.cli).

**Conformance.**
- For generated key lists, `tallyOf` returns a record that parses with `Tally`. Its `n` values sum to the number of non-empty keys, and its rows follow the stated order.
- `respond([tallyOf(id, keys)], { format: 'compact' })` (`@keel/cli/testing`) prints the compact line as its first line, with exit code 0.
- `pretty` prints the `id` line and one line per row. The keys start in one column and the counts end in one column.
- `json` prints the record as one line that parses back to a value equal to the record.
- Compact and json output contain no ANSI escapes or carriage returns.
- A second `formatter('report.tally', ...)` throws E1053.
- With only `@keel/std-report` imported, `respond([tallyOf(id, keys)])` yields E1054; after `import('@keel/std-report/tools')` it prints the compact line.
- `@keel/std-report` exports exactly `Tally` and `tallyOf`, and `@keel/std-report/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.
- `@keel/std-report` bundled alone for a browser (esbuild, `bundle`, `platform: 'browser'`, nothing external) builds, and every input of the bundle is a file under `packages/std-report/` or `packages/schema/`.
- With `@keel/std-report/tools` imported, `keel report <url>` against an inspect document with sections `b` and `a` holding tallies and a section of another shape prints the compact line of `a`, then of `b`, then `ok report 2 tallies`, and exits 0; with no tally section it prints `ok report 0 tallies`.
- `keel report --format=json` prints each tally as one line equal to the record and a last line with `kind: "summary"`, `name: "report"` and `counts: { tallies }`.
- `keel report` against an unreachable url, a non-2xx answer or a body that is not an inspect document emits E1056 and exits 1.
- With the tools entry not imported and a project without `@keel/std-report` in its `deps`, `keel report` emits I1055 and exits 0. With it imported, the MCP tools include `report`, and `stdCommand('report', op)` with another `op` throws E1053.
- In a project whose module lists `@keel/std-report` in `deps`, `keel report` loads the tools entry itself and prints the tallies.
- A dev `createApp` with `inspector({ id, schema: Tally, read })` serves `sections[id].value` equal to the tally `read` returns, and `keel report` against it prints that tally's compact line.
- `keel report http://h/t?x=1` makes one request, to it: a `Tally` body prints its compact line and `ok report 1 tallies`; an array of tallies `b`, `a` prints `b`, `a`, `ok report 2 tallies`; `[]` prints `ok report 0 tallies`; each exits 0.
- For a `url` with a path or a query, a non-2xx answer, a body that is not JSON, an inspect document, or an array with an item failing `Tally` emits E1056, exits 1 and prints no part of the query.
- With `KEEL_REPORT_TOKEN=t` in `io.env` that request carries `cookie: __Host-keel-caller=t` over https and `cookie: keel-caller=t` over http; a `url` without path or query gets none.
