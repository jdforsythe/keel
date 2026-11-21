# RFC 0183: k.sim: `run()` steps to the edges of the schedule's offline windows

Status: accepted (ADR-0205). From the offline, conflict and connection-loss scenario tests in `apps/golden-1/test/*.sim.test.ts`.

## Decisions
- D1: `run()` steps to the earlier of the next pending `after` deadline and the next edge of a `schedule.offline` window, either within `horizon`. An edge is a window's `at` or `at + ms`; the next one is the earliest edge later than the clock's time.
- D2: `clock.next()` keeps its meaning: the earliest pending `after` deadline. Window edges are a schedule's, not the clock's, and `run()` reads them from the run's schedule. The rejected alternative, `next()` counting window edges, changes a clock every capability reads and its conformance clause 1.
- D3: only the windows of the run's own schedule count. A scenario's own `ctx.net.setOnline` is its business, as now.
- D4: no new codes. k.sim goes from `conformance-covered` to `implemented` until its new clause, in the ledger at `none`, is covered. Nothing becomes `frozen`.

## Problem
k.sim says `run()` "settles as the harness does, then while `ctx.clock.next()` is at most `horizon` ms past the run's start it advances the clock to that deadline and settles again". `next()` is the earliest pending `after` deadline (clause 1), and a window's edges are clock timers that `next()` leaves out (`packages/ctx/src/internal/simClock.ts`, the edges set in `packages/ctx/src/createCtx.ts`). So a run whose last deadline falls inside an offline window stops there, and the net stays offline: the outbox never drains and a live channel never reopens, though the schedule ends every window inside the horizon.

The scenario tests step past every window by hand before their final assertions (`offlineConflictLive.sim.test.ts` lines 165 to 174, `connectionLoss.sim.test.ts` lines 169 to 175 and 212 to 218): they compute the last window's end, advance to it, force the net online and run again. Every author of a scenario with `offline` windows has to know this and write it.

## Proposal
k.sim `simulate`: `run()` settles as the harness does, then while the earlier of `ctx.clock.next()` and the next edge of a window in the run's `schedule.offline` is at most `horizon` ms past the run's start, it advances the clock to it and settles again. So after `run()` no window edge within the horizon is ahead of the clock, and the net is online unless a window reaches past the horizon.

## Alternatives
- **`next()` counts window edges.** Rejected (D2): every waiter on the sim clock reads `next()`, and its clause states it.
- **A `run({ online: true })` option that ends every window.** Rejected: a second way to say what the schedule already says.
- **Leave it to the tests, documented in the skill.** Rejected: the hand-written step is the same in each scenario and easy to get wrong (forcing `setOnline(true)` hides a window that should still hold).

## Spec diff
Applied in this commit:
- **k.sim** (status `implemented`, D4): `simulate` states that `run()` also steps to window edges. Conformance gains clause 11.
- **Map**: the k.sim row reads `implemented`.
- **Ledger**: `k.sim#11` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0183`, from the spec text alone, in `packages/testing/conformance/`:
- k.sim 11: `simulate(scenario, { replay })` of a `SimRun` whose schedule's `offline` is `[{ at: 100, ms: 50 }]`, the scenario advancing the clock to 120 with no `after` waiter pending: after `run()`, `ctx.net.online()` is true and `ctx.clock.now()` is 150; with `horizon: 130`, it is still false after `run()`.
Spec topics: `pnpm spec k.sim`; for context `pnpm spec k.ctx`.

## Build
- `@keel/testing`: `simulate`'s `step` takes the earlier of `ctx.clock.next()` and the next window edge of the run's schedule.
- golden-1: the hand-written window steps in `offlineConflictLive.sim.test.ts` and `connectionLoss.sim.test.ts` go.
- Docs: the `keel-testing` skill's `simulate` paragraph.

## Known limits
- A window that ends past `horizon` still leaves the net offline after `run()`, as the schedule says.

## Migration
None: unreleased.

## Token impact
k.sim 4,959 to about 5,400 characters. No budget moves.
