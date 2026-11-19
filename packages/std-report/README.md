# @keel/std-report

**Spec:** std.report · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:**
  - `@keel/std-report`: `Tally` (closed `{ kind: 'report.tally', id, rows: { key, n }[] }`), `tallyOf(id, keys): Tally`. Data only: server and browser code of a deployable import it.
  - `@keel/std-report/tools` (node, no exports): registers the `report.tally` formatter and the `report` command. `keel check`, `keel build` and `keel report` load it for a project with `@keel/std-report` in a module's `deps`; code that renders a `report.tally` record itself imports it.
  - `keel report [url]` (default `http://localhost:5173`), one request in one of two forms the `url` alone decides, then `ok report <n> tallies`:
    - inspect form, a `url` with no path beyond `/` and no query: fetches `<url>/__keel/inspect` from a running dev app and prints each inspector section whose value is a `Tally`, by section id.
    - route form, a `url` with a path beyond `/` or a query (`https://app.example/admin/tallies`, `http://h/?team=3`): fetches the url as given and prints the `Tally`, or the array of them in its order, that the JSON body is. `/__keel/inspect` is not fetched.
  - `KEEL_REPORT_TOKEN` in the environment, when not empty, goes with the route-form request as the caller cookie (`__Host-keel-caller` over https, `keel-caller` over http, as `keel session ingest` sends `KEEL_SESSIONS_TOKEN`), for a route whose guard admits a listed `caller`. It is read for that request and neither stored nor printed. The inspect form sends none.
- **Invariants:** the main entry imports `@keel/schema` only and registers nothing. Rows: `n` descending, then `key`; empty keys dropped. compact `id key=n ...` (`id 0` when empty); pretty aligned columns; json is the record encoded by `Tally`. In the inspect form `keel report` skips sections of another shape and sections holding an `error`, and an unreachable, non-2xx or non-inspect target is E1056, exit 1. In the route form an unreachable target, a non-2xx answer, a body that is not JSON and JSON that is neither a `Tally` nor an array of them (an inspect document, an array with one item failing `Tally`, a `Tally` wrapped in another object) are each E1056, exit 1. The E1056 message names the url without its query, cut to 48 characters; without the package in `deps` the command is I1055, exit 0.
- **Dependencies:** `@keel/schema`; the tools entry also `@keel/cli`.
- **Rungs:** conformance (example + probabilistic, through `@keel/cli/testing` `respond` and `run`), property for `tallyOf`.

## Serving a tally

```ts
import { inspector } from '@keel/compiler/inspect/inspector'
import { Tally, tallyOf } from '@keel/std-report'

inspector({ id: 'orders.status', schema: Tally, read: (ctx) => tallyOf('orders.status', statuses(ctx)) })
```

`keel report` then prints `orders.status paid=3 open=1` and `ok report 1 tallies`.

The route form reads a body that is the tally itself:

```json
{ "kind": "report.tally", "id": "orders.status", "rows": [{ "key": "paid", "n": 3 }, { "key": "open", "n": 1 }] }
```

An API route's loader answers `{ id, results }` (k.api), which holds a tally and is not one, so `keel report` against it is E1056.

## Extension points

Uses the **output formatter registry** (k.cli `formatter`), the reserved **std command** `report` (k.cli `stdCommand`) and, in an app, the **inspector hooks**.

## Migration

Code that emits or renders a `report.tally` record adds `import '@keel/std-report/tools'`; app code keeps `import { Tally, tallyOf } from '@keel/std-report'`.

## Unsafe

count: 0
