# RFC 0031: Check rules for endpoints, and malformed generated artifacts

Status: implemented

## Problem
k.services names E1651-E1653 but `@keel/check` ships no rule for them (backlog 0051, services PLAN D10), so they were explain-only. Separately, `generatedEdits` hashes `data` for a `.keel/*.json` that has `hash` but no `data`; `hashOf(undefined)` throws and `check()` crashes (backlog 0069).

## Proposal
- Static source rules, no runtime, app code only, over `endpoints({...})` calls whose `endpoints` is imported from `@keel/services` (named, aliased, or namespace):
  - E1651: a call `ctx.net.fetch(...)` or `<x>.ctx.net.fetch(...)`. No fix.
  - E1652: a `:param` in a literal `path` with no field in a literal `params: s.object({...})`, or a field not in `path`. Non-literal paths, params, spreads are skipped. Fix: adds `name: s.string()` (or a `params` property when absent and `s` is imported from `@keel/schema`); removes a one-sided extra field.
  - E1653: `body` on an endpoint whose literal `method` is `GET` or `HEAD`. Fix removes `body`.
- E1005: a `.keel/*.json` without a `data` key is malformed: reported, never hashed, no fix.
- Fixture-per-code: E1651-E1653 move from explain-only to fixtured; E1005 gains the `{"hash":"abc"}` case; the E1156 fixture used `ctx.net.fetch` and now uses `ctx.clock.now()` so it triggers one code.

## Alternatives
Type-based detection of `ctx.net.fetch`: needs the type pass and misses `NO_TYPES` runs. Guessing the field type from the path name: wrong more often than `s.string()`, which the author then narrows. Throwing for malformed artifacts: `check()` must not crash on input.

## Spec diff
k.services Rules: drops "enforced only once implemented", states scope and fixes. Codes were already listed; map unchanged.

## Conformance diff
fixtures-by-code: +E1651, E1652, E1653 (bad and clean), E1005 second bad file, E1156 uses `clock`. `EXPLAIN_ONLY` loses E1651-E1653.

## Migration
Apps calling `ctx.net.fetch` directly now get E1651; declare an endpoint.

## Token impact
k.services Rules text about the same length; <= 1,500.
