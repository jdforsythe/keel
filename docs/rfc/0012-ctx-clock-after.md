# RFC 0012: ctx.clock.after(ms, signal) timer

Status: draft

## Problem
`Clock` has only `now()`. `@keel/services` timeouts poll a sim clock once per macrotask and detect sim with `"advance" in clock`. That needs real timers under sim and breaks under `vi.useFakeTimers()`.

## Proposal
`Clock.after(ms: number, signal?: AbortSignal): Promise<void>`. Under sim it resolves when `advance` crosses `now() + ms`; `advance(ms)` resolves all due waiters in deadline order (ties by registration order) before it returns. If `signal` aborts, the promise rejects with `signal.reason` and the waiter is dropped; an already aborted signal rejects at once. Real mode wraps `setTimeout`, clamps the delay to 2^31-1, and clears the timer on abort. Shell delegates to real. `ms` must be finite and >= 0, else RangeError. `@keel/services` uses `after(ms, controller.signal)` and drops polling.

## Alternatives
- Keep polling: nondeterministic, ties services to timers.
- Expose a timer registry: larger surface.

## Spec diff
k.ctx: API line for `after`; Conformance gains "`after(ms)` under sim resolves exactly when `advance` crosses the deadline, never before, and an aborted waiter rejects".

## Conformance diff
Add `packages/ctx/conformance/clock-after.test.ts`. Existing tests unchanged.

## Migration
Additive. Custom `Clock` implementations must add `after`.

## Token impact
About 50 tokens in k.ctx.
