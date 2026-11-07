# RFC 0036: Conformance completion k.scaffold, k.testing

Status: accepted (ADR-0025)

## Problem
docs/freeze-review.md §1 and backlog 0061, 0104. k.scaffold had three partial clauses. The check after every generator was a proxy: relative imports resolve, and `transaction` and `service` had no generator at all. The dry run compared edit sets, not the printed diff. `turbo.json` was compared with a second run of the same generator. All twelve scaffold headers used `// Clause:` (W1706), so the ledger held k.scaffold#1-7 at `none`. k.testing: `fire-resource` capped the promise chain at 24 hops, because `settle` gave up after 32 quiet microtask hops, so the clause was asserted only below the implementation's limit. The harness restored stores from `snapshot()`, which drops log `meta` (rfc:0028), so `properties()` and `dispose()` erased it. The `a11y()` and `settle()` headers did not quote their clause, so the ledger counted neither.

## Proposal
1. `@keel/scaffold` gains `transaction { id: "<module>.<store>.<name>" }`. It writes `<Name>Payload.schema.ts`, `<name>.transaction.ts` and a 100-run `properties()` test. The store must exist (E1052); the rule codes are E1351 and E1352. It also gains `service { id, schema, service }`, which places the two sources `@keel/services/openapi` generates (rfc:0034) at `modules/<id>/api.schema.ts` and `api.ts`. The cli reads `--openapi` and converts the document, because scaffold may not import services.
2. Read-only generated sources: no operation may change a file whose first line is a generated marker (`// _generated`, `// Generated`, `# _generated`). Such an operation is refused with E1005. The one exception is a relocation that recreates the same bytes.
3. Generated projects run their own tests. `vite.config.ts` uses `vitest/config` with `test.environment: "happy-dom"`, and `happy-dom` is a devDependency. Before this, every generated component and route test failed under `keel test` with "document is not defined".
4. `settle` (and so `fire`): a round whose hops saw no change waits one macrotask turn (`node:timers` `setImmediate`, which is not a clock and cannot be faked by a test). The microtask queue drains during that turn, so a silent promise chain of any length finishes. A loop that keeps writing never reaches the turn and still ends in `keel.unexpected` "fire did not settle".
5. `checkTransaction` and `seedStores` take `snapshot({ meta: true })` before they restore (backlog 0104).

Clause to test (strict verdict, task 0034 D1):

| section | # | clause | test | verdict |
| --- | --- | --- | --- | --- |
| k.scaffold | 1 | generator leaves `keel check` + `keel test` clean | `generators-leave-check-clean`: real `keel` binary on a temp tree for project, module, route, component, store, transaction, service; test count >= generated test files | partial: the `service` case is skipped (E1752 below) |
| k.scaffold | 2 | `rename A B` + `rename B A` byte-identical | `rename-references` | covered |
| k.scaffold | 3 | no reference to the old name after `rename` | `rename-references` | covered |
| k.scaffold | 4 | `--dry-run` prints exactly the diff apply writes | `dry-run`: printed diffs replayed by `unified-diff.ts` against the cli's real write, for 8 ops; plan == apply for 10 | partial: cli routes neither `transaction` nor `service` |
| k.scaffold | 5 | would-introduce diagnostic -> E1353, nothing written | `E1353-aborts-would-break-check` | covered |
| k.scaffold | 6 | second run E1351, nothing written | `E1351-duplicate-id`, `transaction-file`, `service-file` | covered |
| k.scaffold | 7 | `turbo.json` equals output for the new graph | `turbo-emission`: graph computed from manifests and topology, module rename, CI | covered |
| k.testing | 1 | invalid props -> `schema.invalid` | `render-schema-invalid` | covered |
| k.testing | 2 | sim clock, equal `state()` per seed | `ctx-sim-clock`, `default-sim-seed` (no-ctx render equals `createCtx` sim for any `KEEL_SEED`) | covered |
| k.testing | 3 | `fire` waits for effects and resources | `fire-settles`, `fire-resource` (1-2000 hops, chained resources, effect -> tx) | covered |
| k.testing | 4 | `a11y()` of Button | `a11y-button` | covered |
| k.testing | 5 | `settle()` shows ready state | `settle` | covered |
| k.testing | 6 | seed reported, `KEEL_SEED` replays | `properties-failure-output`, `properties-records-seed` | covered |
| k.testing | 7 | broken invariant -> E1704 | `properties-transaction-invariant` | covered |
| k.testing | 8 | example -> probabilistic | `ledger-real-runs`, `ledger-rung-promotion` (the `ledger()` engine `keel ledger` calls, fed from real runs) | partial: no `keel ledger` run on a fixture; testing may not import cli |
| k.testing | 9 | lowered rung -> `keel ledger --diff` E1706 | `ledger-diff-e1706` (`ledgerDiff`, the function the command calls) | partial: same, a proxy for a CLI run |

Also: `properties-keeps-log-meta` (0104); `transaction-file` and `service-file` (Generators, E1005, E1052); Rules E1701 static and E1702 move from `it.skip` to real tests.

## Alternatives
- Count the proxy (imports resolve) or in-process `@keel/check` alone for clause 1: `keel test` stays unasserted (D1).
- Spawn `keel ledger` from testing conformance: the scaffold suite does spawn the binary, but deps order puts cli after testing, and ADR-0021 assigns CLI halves to cli conformance.
- An OpenAPI converter in scaffold: a second generator for one format (principle 1, ADR-0023).
- A larger `ROUND_HOPS`: still a finite cutoff.

## Spec diff
None to text. k.testing "settle ... microtask rounds ... no timers" holds: no timer or clock is read, and a quiet round now drains the queue. Status lines stay `implemented`, since each section has two partial clauses.

## Conformance diff
scaffold: `generators-leave-check-clean` (real cli, proxy kept), `dry-run` (printed form), `turbo-emission` (independent graph), new `transaction-file` and `service-file`, support files `keel-cli.ts` and `unified-diff.ts`, and 12 `// Clause:` headers rewritten to `// Spec:`. testing: `fire-resource` uncapped, `default-sim-seed` extended, new `properties-keeps-log-meta`, E1701 and E1702 real, and headers quoting each clause exactly. No assertion removed.

## Remaining (blocks the flips)
1. cli: `scaffoldInput` needs `transaction` and `service` cases; it fails `tsc` against the wider `Op` (TS2366). `PENDING` must be dropped, and `scaffold service --openapi` must call `openapi()` and then `scaffold("service", ...)`. Then add both ops to the printed `dry-run` table.
2. k.services/k.check: `modules/<m>/api.schema.ts` exporting `<M>Api` (the k.services spec path and the rfc:0034 output) is E1752. An RFC must rename the file (`<M>Api.schema.ts`) or exempt it. Then un-skip the service case.
3. cli conformance: `keel ledger` on a fixture (example-only export is `example`; adding a 100-run property makes it `probabilistic`; lowering it makes `--diff` report E1706). That closes k.testing 8 and 9.

## Migration
Projects generated before this RFC: add `test: { environment: "happy-dom" }` to `vite.config.ts` and the `happy-dom` devDependency.

## Token impact
None to spec; RFC and ADR only.
