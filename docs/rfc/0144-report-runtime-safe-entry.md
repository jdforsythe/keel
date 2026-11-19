# RFC 0144: a runtime-safe entry for std-report, and `keel report`

Status: draft, for the orchestrator to accept (ADR-0166).

## Problem
Found by exercising `@keel/std-report` in `apps/golden-2`.

1. A deployable cannot import the package. `packages/std-report/src/Tally.ts` imports `formatter` from `@keel/cli` at module top and registers the `report.tally` kind beside the schema. `keel build` follows `@keel/cli` into vite and vitest and fails in the server bundle (`Could not resolve "@vitejs/devtools/config"`, `"@vitest/ui"`). A service schema that names `Tally` would carry the same chain into a browser bundle. `Tally` and `tallyOf` are usable in tests only.
2. The formatter has no app-facing consumer. `respond` is exported from `@keel/cli/testing` only, `stdCommand` reserves `session` alone, and the server log writes fixed kernel kinds (`req`, `diag`, `csp`). An app can build a tally and has no specified way to show it to a person.

std.report says importing the package registers the kind. k.module **Std config** already describes the other half: `keel check` and `keel build` import each std package in a module's `deps` and its `./tools` export, and `keel session` does the same before it runs (`packages/cli/src/internal/loadStd.ts`, `importDeps`). Eleven std packages keep their CLI-time code behind `./tools`; std-report has no such export.

## Proposal
std.report changes, and one sentence is added to k.cli. No code is new.

### D1. The main entry is data only
`@keel/std-report` exports exactly `Tally` and `tallyOf`. Its files import `@keel/schema` and nothing else; importing it registers nothing. Server and browser code of a deployable import it.

### D2. Registration lives in `./tools`
`@keel/std-report/tools` (file `src/tools.ts`, a `./tools` key in the package's `exports`) has no exports. It calls `formatter('report.tally', { schema: Tally, compact, pretty })` and `stdCommand('report', op)`. The CLI loads it the way it loads every std package's tools: `importDeps` for a project whose modules list `@keel/std-report` in `deps`, on `keel check`, `keel build` and `keel report`. The compact, pretty and json renderings are unchanged.

What breaks: code that imported only `@keel/std-report` and relied on the kind being registered. In the repo that is the package's three conformance files and its tests; each adds `import '@keel/std-report/tools'`.

### D3. A tally reaches a person through the inspect document
The route from a running app to the CLI already exists: an inspector hook (k.cli **Inspector hooks**) puts a schema-typed value in the dev app's `GET /__keel/inspect`. An app registers `inspector({ id, schema: Tally, read: (ctx) => tallyOf(...) })`, nothing new.

`keel report [url]` (default `http://localhost:5173`) is the reader. It fetches `<url>/__keel/inspect` and emits one `report.tally` record per section whose `value` parses with `Tally`, ordered by section id ascending, then a `summary` named `report` with the one count `tallies`:
```
orders.status paid=3 open=1
ok report 1 tallies
```
Sections of another shape and sections holding an `error` are skipped; `keel inspect` prints those. A target that is unreachable, not 2xx or not an inspect document is E1056, exit 1, as for `keel inspect`. Without `Io.fetch` the command is I1055.

### D4. `report` is a reserved std command
`stdCommand` reserves `report` beside `session`, with the same rules: filled by the tools entry, served by the binary and as an MCP tool once filled, I1055 with exit 0 when the project does not list the package, E1053 when filled with another operation. `keel report` imports the project's std `deps` before it runs, as `keel session` does.

### D5. No new code
E1053, E1054, E1056 and I1055 keep their meanings. Nothing is reserved in the code ranges.

## Known limits
- The inspect document is served in dev only (k.cli), so `keel report` reads a dev app. A built server has no reader for a tally; std.timings has the same limit (`tasks/BACKLOG.md` 0930). See Alternatives, A2.
- The MCP `tools/list` budget (1,650 tokens) counts `report` once a project fills it.
- `@keel/std-conflicts` (`RaceRecord.ts` imports `formatter`), `@keel/std-brands` and `@keel/std-sessions` (rule files on the main entry import `@keel/check`) have main entries that reach CLI-time packages. This RFC fixes std-report only. See Alternatives, A4.

## Alternatives
- A1. Render through `keel inspect`: a section whose value has a registered kind is printed with that kind's formatter. No new command, but `keel inspect` would have to import the project's std `deps`, its conformance bullet ("one `inspect.section` per section") would change meaning, and the tallies would sit among stores and counts. Rejected: a kernel command changes behaviour for one std package.
- A2. A `report.tally` server log record, written by a built server. The log's kinds and bounds are fixed (k.serverlog), and a server that renders the compact line needs the formatter at runtime, which is the import chain this RFC removes. A json-only record avoids the formatter and still needs a new `ctx` or server API for app records. Larger than D3; open for a later RFC if tallies are wanted from production.
- A3. Export `respond` from `@keel/cli` for apps. It makes the CLI a runtime dependency of app code. Rejected.
- A4. A general rule: a std package's main entry that reaches `@keel/cli` (or `@keel/check`) is reported. No existing rule is close: the layer lint (`tooling/deps.json`) orders packages and does not see entries, and E1007 (k.bundle, k.boundary) reads an app's browser bundles for server code, not a package's entry for tooling. A new structure-lint over each `packages/std-*` main entry (bundle it, fail when an input is under `packages/cli/` or `packages/check/`) would go red today on std-conflicts, std-brands and std-sessions, so it lands with their moves, not here. The bundle bullet in std.report is that rule for one package. Out of scope; proposed as a backlog line.
- A5. Keep the registration on the main entry behind a dynamic `import('@keel/cli')`. The bundler still follows it, and registration turns asynchronous. Rejected.

## Spec diff
- `spec/std/std.report.md` (1,946 to about 5,000 characters, under 1,300 tokens):
  - Status `conformance-covered` becomes `implemented` here and in `spec/std/README.md` while the appended clauses have no evidence; it goes back with the conformance commit.
  - Extension point: "Importing `@keel/std-report` registers the record kind `report.tally`." becomes "Importing `@keel/std-report/tools` registers the record kind `report.tally` and the `report` command."
  - New paragraphs **Entries** (D1, D2) and **Reaching a person** (D3, D4) before Rules.
  - Conformance: bullets 1 to 6 unchanged. Appended 7 to 15 (below).
- `spec/kernel/k.cli.md`: after the sentence on `session`, "`report`: std.report."; the `session` sentence drops its package note. The section is 5966 characters. Status unchanged: no bullet is added there; std.report's bullets carry the command.
- `spec/std/README.md`: the std.report row reads `implemented` and names `keel report`.
- `spec/00-map.md`: unchanged (std sections are not listed there, and k.cli keeps its status).
- Codes: none new.

Appended std.report bullets:
7. With only `@keel/std-report` imported, `respond([tallyOf(id, keys)])` yields E1054; after `import('@keel/std-report/tools')` it prints the compact line.
8. `@keel/std-report` exports exactly `Tally` and `tallyOf`, and `@keel/std-report/tools` exports nothing; the package's `exports` has the keys `.` and `./tools`.
9. `@keel/std-report` bundled alone for a browser (esbuild, `bundle`, `platform: 'browser'`, nothing external) builds, and every input of the bundle is a file under `packages/std-report/` or `packages/schema/`.
10. With `@keel/std-report/tools` imported, `keel report <url>` against an inspect document with sections `b` and `a` holding tallies and a section of another shape prints the compact line of `a`, then of `b`, then `ok report 2 tallies`, and exits 0; with no tally section it prints `ok report 0 tallies`.
11. `keel report --format=json` prints each tally as one line equal to the record and a last line with `kind: "summary"`, `name: "report"` and `counts: { tallies }`.
12. `keel report` against an unreachable url, a non-2xx answer or a body that is not an inspect document emits E1056 and exits 1.
13. With the tools entry not imported and a project without `@keel/std-report` in its `deps`, `keel report` emits I1055 and exits 0. With it imported, the MCP tools include `report`, and `stdCommand('report', op)` with another `op` throws E1053.
14. In a project whose module lists `@keel/std-report` in `deps`, `keel report` loads the tools entry itself and prints the tallies.
15. A dev `createApp` with `inspector({ id, schema: Tally, read })` serves `sections[id].value` equal to the tally `read` returns, and `keel report` against it prints that tally's compact line.

## Conformance diff
One `rfc:0144` commit by the `conformance-writer`, red:
- New files under `packages/std-report/conformance/` for bullets 7 to 15. Bullets 7 and 13 need a test file that does not import the tools entry at top (the registry and the command slot are process-wide; vitest isolates files). `keel report` runs through `run` from `@keel/cli` with `Io.fetch` answering the inspect document.
- Import lines only, no clause changes: `render.test.ts` and `formatter-twice.test.ts` add `import '@keel/std-report/tools'`. `tally.test.ts` is unchanged.

## Migration
- `@keel/std-report`: `src/Tally.ts` loses the `@keel/cli` import and the `formatter` call; `src/tools.ts` holds the formatter registration and `stdCommand('report', op)`; the operation lives in a file of its own; `exports` gains `./tools`. README Public API names both entries and the inspector example.
- `@keel/cli`: `stdCommand` accepts `report`; the engine, the MCP tool list and `CommandName` treat it as they treat `session` (load std deps, run the filled operation, I1055 unfilled).
- `apps/golden-2`: a server file imports `tallyOf`, an inspector section serves a tally, and `keel build` passes.
- `docs/OUTPUT.md`: a line for `report.tally` (`{ kind, id, rows }`, the compact form) beside the other std kinds. Skills that list commands name `keel report`.
- Changesets: `@keel/std-report`, `@keel/cli`.
- Migration note for code outside the repo: code that emits or renders `report.tally` adds `import '@keel/std-report/tools'`; app code keeps `import { Tally, tallyOf } from '@keel/std-report'`.

## Build order
1. This RFC, ADR-0166, std.report, the k.cli sentence and the std README row (commit 1).
2. `conformance-writer`: the Conformance diff, red (commit 2).
3. Builders: the Migration; std.report back to `conformance-covered` when green.

## Token impact
std.report about 1,250 (was 487). k.cli 1,499 (was 1,491). Map unchanged.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the main entry exports `Tally` and `tallyOf` only and imports `@keel/schema` alone (D1).
- C2: registration in `@keel/std-report/tools`, no exports, loaded through `deps` (D2). Runner-up: none; it is the convention.
- C3: the emit path is an inspector section read by `keel report [url]` (D3). Runner-up: A1, rendering inside `keel inspect`.
- C4: `report` is a second reserved name for `stdCommand` (D4). Runner-up: an open set of std command names, a larger kernel change.
- C5: no new code; E1056 and I1055 are reused (D5).
- C6: the general entry rule is a backlog line, not part of this unit (A4).
- C7: k.cli keeps `conformance-covered`, since its one new sentence is tested by std.report's bullets. Runner-up: lower it to `implemented` until the conformance commit.
