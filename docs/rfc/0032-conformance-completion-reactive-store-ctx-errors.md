# RFC 0032: Conformance completion: k.reactive, k.store, k.ctx, k.errors

Status: accepted

## Problem
The freeze review (docs/freeze-review.md §1, backlog 0057) found clauses in these four sections asserted only in part, which blocks `conformance-covered` under the strict verdict (tasks/0034-freeze D1). Conformance edits on `implemented` sections need a numbered RFC (D5). k.errors still reads `proposed` though every API, Boundary and rule it names is implemented (review §5 item 11).

## Proposal
Add tests, or strengthen a partial one, for each clause below; the conformance-writer writes them from the spec (keel-conformance skill). Implement whatever they expose. Flip a section only when every clause is fully asserted.

| section | clause (review status) | test that covers it |
| --- | --- | --- |
| k.reactive | `owner()` inside an effect returns the scope that owns the effect (partial: first run only) | `reactive/conformance/owner-effect-rerun.test.ts`: re-run triggered by a write from outside every scope, and from inside another scope; owner at the write site restored |
| k.store | `restore` replaces the base `undo` replays from with the snapshot's `initial` (partial: equal initials) | `store/conformance/restore-different-initial.test.ts`: source with a generated non-empty initial, destination `{ items: [] }`; each undo matches the source prefix, the last returns the source initial |
| k.store | `transaction.schema` parses every payload `tx` accepts (partial: `fc.anything()` rarely valid) | `store/conformance/transaction-schema-valid-payloads.test.ts`: payloads from `gen(transaction.schema)` (`add`, `clear`) are accepted by `tx` and parsed by `schema` |
| k.ctx | `keel test` runs under sim by default (partial: clock only, `KEEL_TEST=1` set by hand) | `ctx/conformance/keel-test-env-sim.test.ts`: under `KEEL_TEST=1` every kernel capability and a registered one resolve to sim, random equals `seed: 0`; unset it is real. The cli half (`keel test` sets the variable, k.testing) is a k.cli/k.testing test (backlog 0060/0061) |
| k.errors | Each of E1451-E1454 has a fixture that triggers it and a clean counterpart (partial: E1453/E1454) | `check/conformance/fixtures-by-code.ts` E1451-E1454 bad and clean entries (present since rfc:0020), run by `fixture-per-code.test.ts`; the `it.todo` pointers in `runtime-dom/conformance/boundary.test.ts:332-338` name no clause of their own |
| k.errors | status line `proposed` | `implemented`; `conformance-covered` if the verdict holds |

## Alternatives
Leave the partial tests and flip anyway: violates D1. Spawn `keel test` from the ctx suite: ctx cannot depend on cli (build cycle).

## Spec diff
Status lines only (spec/kernel/k.reactive.md, k.store.md, k.ctx.md, k.errors.md; spec/00-map.md rows). No clause text changes.

## Conformance diff
Added only, no tracked conformance file edited: `reactive/conformance/owner-effect-rerun.test.ts`, `store/conformance/restore-different-initial.test.ts`, `store/conformance/transaction-schema-valid-payloads.test.ts`, `ctx/conformance/keel-test-env-sim.test.ts`. The weaker originals (`owner.test.ts:39`, `snapshot.test.ts:40`, `schema-exposed.test.ts:21`, `default-sim.conformance.test.ts`) stay as they are. A `Promise<Result>` E1453 fixture is left to the k.check completion (backlog 0060): the clause asks for one trigger and one clean fixture, which exist.

## Verdict
k.reactive, k.store, k.errors: every clause fully asserted; status `conformance-covered`. k.ctx: stays `implemented`; the cli half of "`keel test` runs under sim by default" (a `keel test` run whose test observes a sim ctx) is not asserted (backlog 0060/0061). No implementation change was needed: all new tests passed on first run. Untriggered Rules codes (D3, not blocking): E1204, E1205, E1302.

## Migration
None.

## Token impact
Status words only; each section unchanged in size within one token.
