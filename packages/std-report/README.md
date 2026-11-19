# @keel/std-report

**Spec:** std.report · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:**
  - `@keel/std-report`: `Tally` (closed `{ kind: 'report.tally', id, rows: { key, n }[] }`), `tallyOf(id, keys): Tally`. Data only: server and browser code of a deployable import it.
  - `@keel/std-report/tools` (node, no exports): registers the `report.tally` formatter and the `report` command. `keel check`, `keel build` and `keel report` load it for a project with `@keel/std-report` in a module's `deps`; code that renders a `report.tally` record itself imports it.
  - `keel report [url]` (default `http://localhost:5173`): fetches `<url>/__keel/inspect` from a running dev app and prints each inspector section whose value is a `Tally`, by section id, then `ok report <n> tallies`.
- **Invariants:** the main entry imports `@keel/schema` only and registers nothing. Rows: `n` descending, then `key`; empty keys dropped. compact `id key=n ...` (`id 0` when empty); pretty aligned columns; json is the record encoded by `Tally`. `keel report` skips sections of another shape and sections holding an `error`; an unreachable, non-2xx or non-inspect target is E1056, exit 1; without the package in `deps` the command is I1055, exit 0.
- **Dependencies:** `@keel/schema`; the tools entry also `@keel/cli`.
- **Rungs:** conformance (example + probabilistic, through `@keel/cli/testing` `respond` and `run`), property for `tallyOf`.

## Serving a tally

```ts
import { inspector } from '@keel/compiler/inspect/inspector'
import { Tally, tallyOf } from '@keel/std-report'

inspector({ id: 'orders.status', schema: Tally, read: (ctx) => tallyOf('orders.status', statuses(ctx)) })
```

`keel report` then prints `orders.status paid=3 open=1` and `ok report 1 tallies`.

## Extension points

Uses the **output formatter registry** (k.cli `formatter`), the reserved **std command** `report` (k.cli `stdCommand`) and, in an app, the **inspector hooks**.

## Migration

Code that emits or renders a `report.tally` record adds `import '@keel/std-report/tools'`; app code keeps `import { Tally, tallyOf } from '@keel/std-report'`.

## Unsafe

count: 0
