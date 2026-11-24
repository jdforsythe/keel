# RFC 0218: k.drive: `simulate` drives the run's clock when no work of the run is pending

Status: accepted (ADR-0240) by the orchestrator on 2026-11-24, amended the same day after a design review of the first build, for the operator to confirm. Adds k.drive; amends k.sim (Schedule plans, simulate), k.testing (Rules), std.postgres (Modes, Conformance), the map. From `apps/household` (walkthrough finding L9-7, backlog 1038).

## Decisions
- D1: one drive. While a run's scenario is pending, `simulate` advances the run's clock to its next moment on each drive turn where no work of the run is pending. No harness call moves the clock. `run(ms?)` only says how far to wait.
- D2: pending work is decided by tracking, not by watching quiet turns. `simulate` runs the scenario in the run's async context (`AsyncLocalStorage` plus an `async_hooks` hook, in `@keel/testing`). Every non-promise async resource created in that context is pending until Node destroys it. Held work is pending until it settles. A harness call is pending except while it waits only on an unanswered `ctx.net` route. How fast real work runs decides nothing.
- D3: parked work needs no attribution. Work waiting on the sim clock or on the net's online state is promises alone, so it is never pending. A request, job or route that is waiting on the clock is parked by construction.
- D4: `hold(label, start)` is for work that answers through something made outside the run: an engine, worker or channel. It must not wrap a clock wait. A clock or online wait made inside held work is E1728 at once (the async context shows it). std-postgres holds the engine boot and each PGlite call. The wait for the session is not held: it waits on held or parked work.
- D5: a closed list of seams. App code reaches nothing else; E1601, E1603 and E1759 report ambient effects. The residual is a reply through a channel made before the run that nothing holds, or state kept across runs. The law check reports it.
- D6: the law check. `simulate(..., { law: true })` runs each run twice and compares traces. A failing run is always replayed twice before it is reported. A difference is E1729 in place of E1704.
- D7: E1727 is raised on the drive's turn where nothing is pending, no moment is within the bound and the scenario is still pending: no grace. E1728 is held work waiting on the clock (at once), or work pending through 10,000 ms of real time. That bound only fails a run.
- D8: a new section, k.drive. Driving, seams, law, law check and stalls with 17 clauses would put k.sim at about 4,450 tokens, past the 3,400 section budget and principle 8's 4k. k.sim keeps schedules, replicas, `simulate` and `run(ms?)`.

## Problem
In `apps/household`, a `simulate` scenario over the weekly staples workflow awaited a server read. The read ran a std-postgres statement whose plan step waits on the sim clock. Nothing moved the clock while the scenario was waiting, so `vitest` reported a 240 s timeout and nothing else. The household worked around it with `setImmediate` yields that advanced the clock.

The first build of this RFC moved the clock once nothing was held and two macrotask turns passed with no store or DOM change. A review showed that this does not give the law:
- App code that awaited `ctx.clock.after(10)` and a real `setTimeout(d)` gave `[real@0, timer@10]` for d of 8 ms or less, `[timer@10, real@10]` for d of 12 ms with the run passing, and E1727 for d of 20 ms or more. A slower machine means a larger d.
- `renderRoute` with `app` routes to `app.fetch` unheld. The sign-in library hashes a password off the event loop. The PGlite session wait and the engine's cold boot (3.7 s) ran outside any hold. The household needed `held` and `onRun` helpers, and a test failed 1 in 7 under load.
- 1,000 turns took 4 to 76 ms: a grace counted in turns is machine speed under another name.

Tests are deterministic without the author thinking about it. So the law has to hold by construction for any app that reaches the outside only through Keel's seams, with no author action.

## Proposal
### Pending work
`simulate` runs each scenario in the run's async context. Work of the run is pending:
- each async resource other than a promise created in that context, from creation until Node destroys it: a timer or immediate after its callback, a file, DNS or thread-pool request (a password hash) after it answers, a socket, server, interval or port once closed;
- held work, until it settles;
- a harness `fire`, `settle`, `navigate` or render in progress, except while it waits only on an unanswered `ctx.net` route.

The harness's and the drive's own macrotask turns are made outside the run's context (`AsyncResource` bound to the root, or `AsyncLocalStorage.exit`), so they are not work. The review's `setTimeout(12)` is a `Timeout` in the run's context: the clock waits for it, and the record is `real@0, timer@10` for every d.

### Parked work
The sim clock's waiters and the net's online subscription are promises. Work waiting only on them creates no resource, so it is never pending. A request handler, a job's `fn` or a route that awaits `ctx.clock.after` is parked with no bookkeeping. That is why the mechanism needs no attribution of clock waits to held work: the hook sees real resources, and the clock is not one.

The async context is used for two things only. It decides which resources belong to the run. It also catches a misuse: a `ctx.clock.after` or an online wait made inside a `hold` would deadlock, because the hold blocks the clock it waits on. It fails at once with E1728 `held work waits on the sim clock: <label>`. Detecting this needs the hold's own context, which is why `hold` takes `start` rather than a started promise.

An explicit context was considered instead: a per-request ctx carrying the hold. It does not work. Capability accessors and many registries are keyed by the ctx object, so a derived ctx per request breaks `accessor(ctx)`.

### Where it lives
- `node:async_hooks` is imported only by `@keel/testing` (`src/internal/runTracker.ts`). `@keel/testing` runs under Node (`keel test`, vitest) and enters no deployable's bundle.
- `@keel/ctx` gains no Node import: its `hold` and the sim clock report to a slot that `simulate` fills through `@keel/ctx/internal`, as `netInFlight` does.
- A sim ctx outside `simulate` (a harness render on a plain sim ctx, or a sim ctx in a browser) has no tracker and is never driven: its clock is the test's, moved by `advance`.

### The drive
A moment is the earlier of `ctx.clock.next()` and the next offline edge after the clock. On each drive turn, while the scenario is pending and no work is pending, the drive advances the clock to the next moment within the bound. The bound is the horizon, or `t + ms` while a `run(ms)` waits. Every `ctx.clock.after` waiter is driven alike: net and plan delays, job delays, backoff, leases and timeouts, runner polls, schedules, heartbeats and the 5,000 ms bounds.

`run(ms)` stops at exactly `t + ms`, so state there is readable, including work parked across it. The Saturday test's `running` state is readable after `run(ms)` when the step is parked on a later deadline. The step's session wait no longer escapes: it waits on held or parked work. A state that exists only between two microtasks was never readable deterministically and is not now.

### Seams, a closed list
- `ctx.net`: a sim route, including `app.fetch` behind a harness's `app` (`documentRoute`, `renderRoute`), runs as app code, so the tracker sees its real work.
- `ctx.storage`: the sim storage resolves on microtasks; storage steps take no time.
- `ctx.clock`, `ctx.random`: no real work.
- A registered capability's sim implementation: the tracker sees its own resources. It holds what answers through something made outside the run. std-postgres holds `<capability> boot` and `<capability> query`.
- The server's handling of a request and an identity source's work: app code, tracked. A password hash on the thread pool is a request the hook counts, so the identity seam needs no extra hold, and the auth library stays the app's.
- The harness's module loads (`routes: () => import()`, a route's chunk): held by the harness, labelled with the route id. The test runner answers `import()` over a channel made before the run.

App code reaches nothing else. E1601 reports timers, `fetch`, ambient storage, `Date` and `Math.random`; E1603 reports code from strings; E1759 reports Node globals in browser files. A server-side `setImmediate` is not a check error, but it is a tracked resource.

What a capability author does: hold, with a label, each piece of work that answers through an engine, worker or channel made outside the run, and nothing that waits on the clock, the online state, other held work or app code. A promise the author did not hold cannot be detected in general. It is harmless when its real work makes resources in the run's context. When it answers through an outside channel, it is the residual below.

### The law
The drive draws no random and reads no real time. Two runs of one `SimRun` and one scenario take the same moments in the same order and report the same observer events in the same order at the same clock times, ending with equal store snapshots. The trace is the list of moments taken and the observer events of the run's ctx and replicas, each with its clock time.

The residual is exactly this:
- a reply through a channel made before the run that no capability holds: a module-level worker or socket, or an `import()` in app code that the test runner answers over its own channel;
- state kept outside the run's stores from one run to the next.

Neither is something `keel check` can see. The law check reports both whenever they change a trace.

### The law check
`simulate(scenario, { law: true })` runs each run a second time with its `SimRun` and compares the traces. A failing run's shrunk `SimRun` is always replayed twice before it is reported, unless it failed with E1727 or E1728. Two traces that differ give:
```
E1729 two replays of the run differ at trace entry 3
{"at":10,"kind":"moment"}
{"at":20,"kind":"moment"}
```
It is reported in place of E1704, so a nondeterministic failure is never presented as a shrunk counterexample.

### Stalls
- E1727, on the drive turn where nothing is pending, no moment is within the bound and the scenario is pending with no `run` call: `the scenario waits past the horizon: next deadline <n> ms`, or `the scenario waits and nothing in the run is due`. There is no grace: pending real work is tracked, so nothing can still be coming.
- E1728, at once: `held work waits on the sim clock: <label>`.
- E1728, after work stays pending through 10,000 ms of real time: `work in flight never answered: <label>`, the label being the held work's or the resource's Node type (`Timeout`, `PBKDF2REQUEST`, `TCPWRAP`). `@keel/testing` reads `performance.now` for this bound only. It can fail a run and never moves the clock or changes a trace. An open handle that is never closed (a library's interval or a socket) ends here, named.

`keel explain` entries: E1727 and E1728 as built, with E1728's text naming both cases. E1729:
```
E1729 two replays of a simulate run differ
The run reached work the drive cannot see: a reply through a channel made before the run that no capability holds, or state kept from one run to the next.
hold the outside work in its capability, or keep the state in the run's stores
```

## Alternatives
- Watching quiet macrotask turns (the first build): speed decides the trace, as the review measured.
- Holding composites (a request, a net dispatch, an identity call) with AsyncLocalStorage attribution of clock waits: needs a parked rule per hold and misses a concurrent branch. Resource tracking makes a clock wait parked by construction.
- Refusing to advance while a promise chain started by a harness call is unsettled: promise chains have no end a hook can see without promise hooks on every promise, and parked chains never settle.
- An explicit per-request ctx: breaks capability accessors keyed by ctx.
- `until(ctx, cond)`: a second helper that moves the clock.
- Driving any sim ctx: changes every harness test and would need the tracker in browsers.

## Spec diff
Applied in this commit.
- k.drive (new, `implemented`): Driving, Seams, Law, Law check, Stalls, an "empty replay" definition, and 17 clauses. #1 to #10 are k.sim's former #15 to #24, with "Under `simulate` with `replay` of a `SimRun` of seed 1 and an empty schedule" written "In an empty replay". #5 and #9 change behaviour (the `hold` signature, the outside channel, the 10,000 ms bound). #11 to #17 are new.
- k.sim: the plans bullet's `hold(label, start)` and what a capability holds; `simulate` gains `law = false`; `run(ms?)` points to k.drive; the Driving, Law and Stalls paragraphs and clauses #15 to #24 move to k.drive, leaving 14 clauses.
- k.testing Rules: E1727, E1728 (both cases), E1729, pointing to k.drive.
- std.postgres: Modes holds `boot` and `query`; #24's wording is unchanged; #25 is new (a first query's boot is held).
- Map: the k.drive row; `spec.map` re-based from 1,440 to 1,450 and `docs.map` from 1,520 to 1,530 tokens. `tooling/docs-owners.json`: `@keel/testing` owns k.drive.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/testing/conformance/sim-drive.test.ts`, `sim-stalls.test.ts`, `sim-law.property.test.ts`: headers move from k.sim#15 to #24 to k.drive#1 to #10 and quote the new wording. #5 is rewritten (a port made before `simulate`); #9 waits on the 10,000 ms bound with its own timeout.
- `packages/testing/conformance/sim-tracked.test.ts` (new): k.drive#11 (real `setTimeout`), #12 (`pbkdf2`), #14 (`running` at `t + ms`), #15 (`renderRoute` module load).
- `sim-stalls.test.ts` gains #13 (hold waiting on the clock); `sim-law-check.test.ts` (new): #16, #17.
- `packages/std-postgres/conformance/sim-held.test.ts`: #25 (a first query's boot), and `hold` calls take `(label, start)`.

## Migration
None. No app is released.

## Token impact
- k.drive about 2,430 tokens; k.sim about 1,935; std.postgres about 3,335; k.testing about 2,930. Each is under 3,400.
- The map and the docs map gain one row, re-based as above.
- `@keel/testing`: the tracker replaces the quiet-turn idle rule; size measured in the build.

## Build plan
- `packages/testing/src/internal/runTracker.ts` (new, Node only): the run's `AsyncLocalStorage`, the `async_hooks` hook counting non-promise resources by type, the 10,000 ms bound and the in-hold check.
- `drive.ts`: moves the clock when the tracker's count, held work and pending harness calls are all zero, on its own turn made outside the run; E1727 with no grace.
- `drained.ts` and `settle.ts`: make their turns outside the run's context.
- `simulate.ts`: `law`, the trace, the replays and E1729.
- `documentRoute.ts`, `renderRoute.ts`: module loads held with the route id. `app.fetch` needs nothing more.
- `packages/ctx`: `hold(label, start)`; the clock and online waits report inside a hold.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1728's text covers both cases; E1729 is new.
- `packages/std-postgres` (`simBackend.ts`, `simEngine.ts`, `pgliteEngine.ts`): hold `boot` and each call as `(label, start)`; the session wait stays unheld.
- Remove: `apps/household/test/serve.ts`'s `held` and `onRun`, and the 600-turn loops in the household tests. Scenarios await the server and call `run(ms)`.
- `packages/testing/test/simulate-drive.property.test.ts`: replace the chatter with real work (timers, a hash) at random delays.
- Docs: the keel-testing skill, the testing README, the changeset.

## For the operator
1. **A real-time safety net that can only fail a run.** E1728 fails a run whose work stays pending through 10,000 ms of real time. It reads real time but never moves the clock or changes a trace; without it, a library's open handle hangs the run until vitest's timeout, with no name. Recommended: accept.
