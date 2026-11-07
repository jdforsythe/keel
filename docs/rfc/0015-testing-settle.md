# RFC 0015: testing: handle.settle()

Status: implemented

## Problem
After `render`, a resource that resolves later is visible only after `fire`. Tests fire a synthetic `focus` only to wait (golden-1 friction 8).

## Proposal
`Harness` gains `settle(): Promise<void>`, also on `renderRoute` handles. It runs the loop `fire` uses: microtask rounds until the DOM and every store log are quiet, bounded, no timers. Then it runs the render checks (`keel.unexpected`, E1702, E1703). `render` stays synchronous.

## Alternatives
- `render` returns a promise: breaks every caller.
- A `waitFor(id)` poll: needs timers.

## Spec diff
k.testing: Harness line lists `settle()`; Conformance gains "after a resource resolves, `await settle()` makes its ready state visible without any event".

## Conformance diff
Add `packages/testing/conformance/settle.test.ts`.

## Migration
Additive.

## Token impact
About 40 tokens in k.testing.
