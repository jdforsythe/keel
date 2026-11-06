# RFC 0011: store.check(state) runs invariants without committing

Status: implemented

## Problem
Stores hide their invariants, so `@keel/testing` filters generated states by defining a probe transaction (`keel.testing.holds`) on the store, restoring the state into it, and reading `store.invariant`. This adds a transaction name to every probed store and mutates state to ask a question.

## Proposal
`Store<T>.check(state: unknown): Result<T, KeelError<'store.invariant'>>`. It parses `state` with `store.schema`, then runs every declared `invariant`. It returns `ok(state)` when all hold, else `err` with code `store.invariant` and data `{ transaction: '' }`; a candidate the schema rejects is also `store.invariant`. It never changes state, log, or signals, and never runs transactions. `@keel/testing` filters generated states with it and removes `holds` and the probe transaction.

## Alternatives
- Expose the invariant list: leaks closures, and callers re-implement the loop.
- Keep the probe: a hidden transaction per store.

## Spec diff
k.store: API line for `check(state)`; Conformance gains "`check(state)` returns ok iff every invariant holds and never changes state or log".

## Conformance diff
Add `packages/store/conformance/check.test.ts`. Existing tests unchanged.

## Migration
Additive. `@keel/testing` internal change only.

## Token impact
About 40 tokens in k.store.
