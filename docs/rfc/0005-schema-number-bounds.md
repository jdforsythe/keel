# RFC 0005: schema: number and int bounds

Status: implemented

## Problem
`s.string` takes `{ min, max }` but `s.number` and `s.int` do not. Pagination, quantities and ports need bounded numbers, and forms and router suites already write `s.int({ min: 0 })`. Callers hand-check ranges and lose generator, doc and issue support.

## Proposal
- `s.number({ min?, max? })` and `s.int({ min?, max? })`, inclusive.
- Construction throws on `min > max`, non-finite bounds, or an `int` range holding no integer.
- Issues use the existing rules `min` and `max`, reported after `type`, `finite` and `int`.
- `gen()` only yields values within bounds; `doc()` shows them (`int(0..1000)`).
- `decodeStrings` coercion is unchanged; bounds are then checked by `parse`.

## Alternatives
- Exclusive bounds or `multipleOf`: not needed yet; additive later.
- Separate `s.positive()` helpers: more API for no new capability.

## Spec diff
spec/kernel/k.schema.md: Primitives line gains `{ min, max }` for `number` and `int`; Conformance gains one sentence on bounded generation and rejection.

## Conformance diff
Add `number-bounds.test.ts`: generated values within bounds, out-of-range rejected with `min`/`max`, construction guard (seed 1337). Existing tests unchanged.

## Migration
Additive. No new rules or exports.

## Token impact
About 40 tokens in k.schema.
