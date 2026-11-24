# RFC 0218: k.sim: `simulate` drives the run's clock while nothing else can move

Status: accepted (ADR-0240) by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.sim (Schedule plans, simulate, three new paragraphs, Conformance), k.testing (Rules), std.postgres (Modes, Conformance). From `apps/household` (walkthrough finding L9-7, backlog 1038).

## Decisions
- D1: one driver. While a run's scenario is pending, `simulate` advances the run's clock to its next moment whenever the run is idle; no helper moves the clock on its own. `run()` only says how far to wait.
- D2: idle means no held work pending, two drained macrotask turns with no store-log or DOM change, and no harness call in progress but one stalled on an unanswered `ctx.net` route.
- D3: a sim capability factory gets `hold(work, label)` for real I/O it does; std-postgres holds each PGlite call, never a plan delay, a queue wait or `fn`'s own awaits.
- D4: `run(ms?)`: `run()` waits to the horizon as before; `run(ms)` waits to `t + ms` exactly; `run(0)` drains at the current time. `horizon: 0` leaves the clock to the scenario.
- D5: two codes in k.testing's block, E1727 (the scenario waits on nothing the run can move) and E1728 (work in flight never answers). Each fails the run, so it reaches the operator as E1704 with the shrunk `SimRun`.

## Problem
In `apps/household`, a `simulate` scenario over the weekly staples workflow awaited a server read (`shoppingApi.runs`). That read ran a lone std-postgres statement, which takes a plan step, and the step's `delay` waits on the sim clock. Nothing moves that clock while the scenario awaits: `run()` steps it, but only when called, and the scenario was waiting on the statement before it could call `run()`. `vitest` reported a 240 s timeout and nothing else. The household works around it in `test/restock.ts`: `moving` yields to the event loop with `setImmediate` and advances the clock 100 ms every 20 yields while a promise is pending; `steadily` and `turn` retry reads and advance 500 ms between tries.

What the tree does today:
- k.sim's clock moves only through `advance`. `simulate`'s `run()` settles (k.testing `settle`: microtask rounds plus one drained macrotask turn, store logs and DOM quiet), then while the next deadline or offline edge is within the horizon advances to it and settles again.
- A harness `fire` or render on a run's ctx steps the clock itself while a `ctx.net` route is in flight and nothing else moves (`clockStep`, `simClocks`). So two helpers move the clock, and neither moves it while the scenario awaits anything else.
- Runners wait on `ctx.clock.after`: std-jobs between jobs (`idle`), for backoff and for `timeoutMs`; std-workflows polls; std-schedules waits for the next time; std-channels and std-live bound a watch at 5,000 ms; the server's live stream beats. Each is a deadline in `ctx.clock.next()`.
- std-postgres under sim is PGlite in memory. A plan step's `delay` is `clock.after`; the PGlite call after it is real I/O the harness does not see. If a step's `settle` round looks quiet mid-call, `run()` can advance the clock before the statement answers, so the order of a job's timeout and its commit depends on how fast PGlite ran.

So a scenario with jobs either calls `run()` at exactly the points where it is not awaiting server work, or it hangs. The order of real I/O and clock steps is not fixed by the seed.

## Proposal
### The drive
While a run's scenario is pending, `simulate` drives the run's clock (its replicas share it). The run is idle when:
1. no held work is pending;
2. two macrotask turns in a row, each after the microtask queue drains, change no store log and no DOM; and
3. no harness `fire`, `settle`, `navigate` or render is in progress, except one waiting only on an unanswered `ctx.net` route (that route waits on the clock or on held work).

A moment is the earlier of `ctx.clock.next()` and the next offline window edge after the clock. When the run is idle the drive advances the clock to the next moment, if it is within the bound, and waits for idle again. The bound is `horizon` ms past the run's start, or `t + ms` while a `run(ms)` waits. The harness no longer steps the clock: `clockStep` and the `step` argument of `settle` go, and a harness call stalled on `ctx.net` is idle, so the drive moves the clock for it.

The rule a reader can hold: the clock moves only when nothing in the run can move without it. A scenario that awaits a job's effect gets its answer at the first moment it can. Code after an `await` that needed no clock runs at the time that `await` answered, so an assertion after it sees that time.

Every `ctx.clock.after` waiter is driven alike, with no list to keep: net and plan delays, a job's `delayMs`, backoff, lease and `timeoutMs`, a runner's poll, a schedule's next time, a stream's heartbeat, the 5,000 ms watch bounds. Perpetual pollers mean a run never runs out of deadlines; the horizon is the virtual-time budget, as it is for `run()` today.

### Held work
k.sim's plans bullet: the sim factory gets `{ seed, plan, hold }`. `hold(work, label)` returns `work` and marks it held until it settles. It is for real I/O whose progress no microtask and no clock of the ctx shows. A replica's held work is its parent's, since replicas share capability implementations. Outside `simulate` nothing reads it, so a plain sim ctx pays one counter.

std-postgres holds each call into PGlite: a statement, `begin`, `commit`, `rollback`, a migration, labelled `<capability> query`. A plan step's `delay`, the wait for the database to be free and `fn`'s own awaits are not held. Holding a whole transaction would deadlock a `fn` that awaits the clock (a job step that fetches with a net delay inside its transaction): the clock could not move until the transaction ends, and it cannot end until the clock moves.

### `run(ms?)`
- `run()` resolves once the run is idle, no `ctx.net` route is unanswered and no moment is within the horizon. This is today's `run()`; the drive now does the stepping.
- `run(ms)`, `ms` an integer 0 to 600,000: takes each moment at or before `t + ms` regardless of the horizon, advances the clock to `t + ms`, and resolves once idle. This is how a scenario asserts at a time: `await run(500)` and the job due at 500 has run, the one due at 1,000 has not.
- `run(0)` drains work at the current time and moves no clock.
- `horizon: 0` opts a scenario out: the drive takes no later moment, the scenario's `advance` moves the clock, and an await that needs the clock fails E1727 instead of hanging.

`ctx.clock.advance(ms)` stays the scenario's primitive. It differs from `run(ms)`: `advance` resolves every crossed waiter synchronously with no settling between them, while `run(ms)` lets each moment's work finish before the next.

### The law
The drive draws no random and reads no real time; its choice is a function of the clock's waiters (deadline order, ties by registration) and the schedule's windows. Two runs of one `SimRun` and one scenario, effects through the run's ctx and real I/O held, take the same moments in the same order and report the same observer events in the same order at the same clock times, ending with equal store snapshots. Work the run cannot see (a file read, an `import()` no harness call is loading, a timer) is outside the law. Seeds stay as they are: the `SimRun` fixes the seed and schedule, and `replay` reruns it.

### Stalls
Two codes, free in k.testing's E170x block (E1726 is the last taken; W1714 and W1723 are warnings):
```
E1727 the scenario waits past the horizon: next deadline 600500 ms
E1727 the scenario waits and nothing in the run is due
E1728 work in flight never answered: shopping.db query
E1728 work in flight never answered: a ctx.net request
```
- E1727: the scenario is pending, no `run` call of it is pending, the run is idle, no `ctx.net` route is unanswered, and no moment is within the bound, through 1,000 more macrotask turns. The turns let an untracked `import()` the scenario awaits finish before the run fails.
- E1728: held work pending, or an unanswered `ctx.net` route with no moment within the bound, through 200,000 macrotask turns with no store-log or DOM change (the count `settle` uses for a module load). The label is the first pending held work's.
- Each is thrown inside the run, so `simulate` shrinks and reports E1704 as for any failing run, its first line holding the E1727 or E1728 text (both under the 70 characters E1704 keeps). The bounds count turns, not time, as `settle`'s do.

`keel explain E1727`:
```
E1727 a simulate scenario waits on nothing the run can move
The drive moves the run's clock when the run is idle, up to the horizon. The scenario still waited: on a deadline past the horizon, or on something no clock waiter, held work or ctx.net route will answer.
raise horizon, await run(ms) for a later time, or hold the real I/O the scenario awaits
```
`keel explain E1728`:
```
E1728 work in flight that never answers under simulate
Held work (a capability's real I/O, such as a PGlite call) or a ctx.net route stayed pending with nothing else moving. The clock does not move while held work is pending.
make the held work answer; a transaction's fn must not hold across a clock wait
```

## Alternatives
- **`until(ctx, () => cond)`, the walkthrough's suggestion.** A second helper that moves the clock, beside `run()` and the harness. A predicate polled between steps also hides which await was stuck. The drive needs no new helper, and a plain `await` is the condition.
- **Keep `run()` as the only driver and document it.** It cannot help a scenario that is awaiting server work, which is the case that hung.
- **Drive outside `simulate`, on any sim ctx.** A plain sim ctx's clock is the test's (k.testing); driving it there changes every harness test. A test that wants driving uses `simulate(scenario, { replay })` with an empty schedule.
- **Infer real I/O without a seam (count PGlite's promises in the kernel).** The kernel imports no std package. `hold` is one function on the factory a capability already gets.
- **Hold a whole transaction.** Deadlocks a `fn` that awaits the clock; see Held work.
- **Name each clock waiter in E1727.** `ctx.clock.after` takes no label, and adding one touches every caller for a message. E1727 names the next deadline; E1728 names held work, which does take a label.

## Spec diff
Applied in this commit.
- k.sim (stays `implemented`): the plans bullet gains `hold`; `run(ms?)` replaces `run()`'s stepping sentence; new paragraphs Driving, Law and Stalls; ten Conformance clauses (#15 to #24).
- k.testing (stays `implemented`): Rules lists E1727 and E1728, pointing to k.sim Stalls.
- std.postgres (stays `implemented`): Modes says which PGlite calls are held; one Conformance clause (#24).
- Map: unchanged. E170x is already k.testing's; no status moves.
- Ledger: the new clauses appear at `none` when the orchestrator regenerates it.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/testing/conformance/sim-drive.test.ts`: k.sim's clauses on the drive, `run(ms)`, `horizon: 0`, held work and the harness `fire` (#15 to #20).
- `packages/testing/conformance/sim-stalls.test.ts`: E1727 twice and E1728 (#21 to #23).
- `packages/testing/conformance/sim-law.property.test.ts`: the determinism clause (#24).
- `packages/std-postgres/conformance/sim-held.test.ts`: std.postgres's clause (#24).
- `packages/check/conformance/fixtures-by-code.ts`: no fixture: E1727 and E1728 are runtime codes, as E1704 is; the writer confirms the catalog test's list of runtime codes takes them.
- Existing cases: k.sim's `run()` clauses keep their wording and their outcome. A test that awaited `run()` only to step the clock still passes.

## Migration
None. No app is released; `apps/household`'s helpers are rewritten in the build.

## Token impact
- Spec: k.sim grows from about 1,800 to about 3,280 tokens, under the 3,400 section budget; k.testing by about 30; std.postgres by about 170 to about 3,270. The map is unchanged.
- `keel explain E1727`, `E1728`: two catalog entries, under the 300-token budget each.
- `@keel/testing`: the drive replaces `run()`'s loop and the harness `clockStep`; size measured in the build. `@keel/ctx`: one counter per sim ctx family.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the eleven clauses. 3. Build:
- `packages/ctx`: the sim factory's `hold`; a held set per sim ctx family (labels in hold order), read through `@keel/ctx/internal` as `netInFlight` is.
- `packages/testing/src/simulate.ts`: the drive (idle detection, moment, bound), `run(ms?)` with its `schema.invalid`, E1727 and E1728; `internal/settle.ts` loses `step` and reports to the run when it is in progress and when it is stalled on `ctx.net`; `internal/clockStep.ts` and `simClocks` become that report. `Scenario` types `run(ms?: number)`.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1727, E1728 as above.
- `packages/std-postgres/src/server/internal/makeDatabase.ts` and the sim backend: each PGlite call through `hold`, after `gate`, outside the engine's queue.
- `apps/household/test/restock.ts`, `restock.sim.test.ts`, `restock.test.ts`: under `simulate`, `moving`, `steadily` and `turn` become plain awaits and `run(ms)`; the kill-point test runs each kill under `simulate(scenario, { replay: { seed: 100 + kill, schedule } })` with an empty schedule, so it drops the `setImmediate` yields. Golden-1 and golden-2 scenarios under `simulate` are run unchanged.
- Docs: `packages/cli/skills/keel-testing/SKILL.md` (copied to `.claude/skills`): a scenario awaits server work directly, `run(ms)` for a time, E1727 and E1728; `packages/testing/README.md`; a changeset; `tasks/p1/walkthrough-findings.md` (L9-7); `tasks/BACKLOG.md`.

## For the operator
1. **The clock moves by itself under `simulate`.** Recommended: yes. Only when nothing else can move, so a scenario's assertions after a non-clock await see the time they expect, and a scenario that wants full control sets `horizon: 0`.
2. **Driving stays inside `simulate`.** A plain sim ctx keeps a test-owned clock; a test that wants driving replays an empty `SimRun`.
3. **`run(ms)` is new surface.** It is the one way to assert at a time with work settling between moments; `advance` stays the primitive.
4. **E1727's grace of 1,000 macrotask turns.** Short enough that a stalled run fails in milliseconds and shrinks inside the per-run test timeout; an untracked `import()` slower than that fails E1727 rather than running outside the law unseen.
