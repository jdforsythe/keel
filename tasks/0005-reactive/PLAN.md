# Task 0005-0006: reactive

**Spec:** k.reactive · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/reactive
Covers backlog 0005 (signal, computed, effect, scopes) and 0006 (resource union, declared writes, cycle detection).

## Deliverables
- [ ] `signal`, `computed`, `effect(fn, { writes })`, `resource(fetcher)`, `scope(fn)` with disposal
- [ ] glitch-free propagation; effects run after commit (batch); disposal frees subscriptions
- [ ] resource state union loading|error|ready; stale results never overwrite newer
- [ ] runtime E1201 (undeclared write) and E1202 (cycle) as thrown KeelError with code; E1203 outside scope
- [ ] property tests; README; changeset

## Steps
1. conformance-writer writes packages/reactive/conformance from k.reactive.
2. Implement (engine: borrow Solid-style algorithm; wrap or hand-write per ADR-0002/0010, record choice).
3. Properties; README; changeset; spec status -> implemented.

## Decisions
- D1: resource fetcher receives an AbortSignal-free context; staleness tracked by monotonically increasing request id.

## Verification
- [ ] conformance green · properties present · `pnpm check` clean · size budget 4kb gz

## Next action
Step 1.
