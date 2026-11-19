# RFC 0082: S5 Correctness: explore, schedules, charts and a ledger backed by machinery

Status: accepted (2026-11-10); the user's answers are D1 to D4. Stage design RFC for S5 (`tasks/PROGRAM.md`, task 0311); implementation waits for the S2, S3 and S4 pushes and builds on RFC 0080's runners and RFC 0081's store heads, `save` and `net` events, `setOnline`, session groups and race finder. It applies WORKFLOW RFC defaults 1 (four kernel gaps get kernel changes, K1 to K4, in three new kernel sections: k.sim, k.model and k.ledger), 2 (one exploration engine, `explore`; one schedule generator, `simulate`; per-file mutation claims replace the per-package score as the ledger's mutation record; the `exhaustive` definition that no machinery backs is replaced, not kept beside the new one), 3 (`explore` runs transactions on the path `properties` already uses, `simulate` reuses fast-check and the harness's settle loop, mutation claims come from the Stryker reports `pnpm ledger` already reads, std.monitor reuses std.sessions' reader guard, token and `session` command, and the exit proof extends the `golden-1-api` eval), 4 (a tally holds transaction names and counts, a schedule holds no app data, a counterexample is printed by the test that found it and never uploaded), 5 (`monitor` and its route are server-only, Node deployables only), 6 (E1604, E1708 to E1713, W1714, E2009, E2010 and E2751 to E2755 enforce what prose would otherwise ask for, and `chart` throws on a structural defect) and 7 (`@keel/testing`'s size budget is re-based; E1713 refuses a lowered mutation threshold). ADR-0086 to ADR-0091 record it.

## Decisions (2026-11-10)
- D1 (user): the API shapes are accepted as a set: k.sim's `Schedule`, `createCtx({ schedule })`, `clock.next()`, `register(..., { plan })` and `simulate(scenario, { runs, seed, horizon, replay })` with `{ ctx, seed, schedule, run }`; k.model's `explore(transactions, { from, payloads, depth, maxStates })` and its result; std.statecharts' `chart(id, { data, start, events, guards, actions, initial, states })` with `to`, `guard`, `do` and target lists, `enabled` and `coverage`; std.monitor's `monitor`, `monitorRoutes` and `keel session monitor`; std.multi's `openGroup({ schedule })`. Charts are flat in S5.
- D2 (user): golden-1 is migrated as Proposal 6 lists (`editorChart` driving `EditTodoPage`, std.monitor's runner and route in `api`, three tests, `.keel/monitored.json`), and the `golden-1-api` eval is extended with the rung assertions and three planted twins.
- D3 (user): the exit proof's `monitored` evidence comes from a production build of golden-1 on a local port, driven by Chromium through Playwright (`tooling/smoke/monitor.mjs`); `.keel/monitored.json` records that `origin`. A hosted run can replace it when S6 deploys golden app 3.
- D4 (user): `proven` keeps type-level tests, as docs/TESTING.md defines the rung (types, model checking, SMT when it exists). k.ledger detects them: a passing test body that asserts with `expectTypeOf` or `assertType`, which each package's `check` type-checks with `tsc`. Closed-form `explore` is the model-checking producer beside them.

## Problem
S5 must make each rung of the ledger mean something a machine did: `proven`, `exhaustive`, `probabilistic`, `example` and `monitored` (docs/TESTING.md, principle 11). Evidence from the code and the committed ledger as of this RFC:

1. **Two rungs have no producer and one has no input.** `tooling/ledger/ledger.json` holds 330 `example`, 149 `probabilistic` and 7 `none` items, and nothing else. `testEvidence` (`packages/cli/src/internal/testEvidence.ts`) yields only `example` and `property` evidence; the `exhaustive` and `proven` kinds exist in `Evidence` but nothing creates them. k.testing defines `exhaustive` as "a property whose generator's finite domain was fully enumerated" and `proven` as "a passing type-level test or prover output", and neither is detected. `monitored` is "never emitted by the kernel", and no stdlib package emits it.
2. **Nothing enumerates states.** `properties` samples generated states and payloads (`checkTransaction.ts`: restore, `tx`, undo, `tx` again), so a transaction that breaks an invariant only from a state the generator rarely makes passes. RFC 0081's race finder checks the orders a session group recorded and leaves "exploring other schedules" to S5 (its Known limits).
3. **The simulator has no faults.** `simNet` routes a request or answers 404 at once; `simStorage` never fails; the sim clock has no way to say when its next waiter is due; a registered capability's sim factory gets only `{ seed }`. A test that wants a late, lost or refused response writes a special route by hand, and no tool generates or shrinks such cases.
4. **Mutation is a number without a claim.** Stryker reports sit in gitignored `packages/<pkg>/reports/`; `pnpm ledger` records one score per package when a report happens to be on disk (`mutationScores.ts`), with no link to the source it measured, so a score stays in the ledger after the code it scored has changed, and `--diff` never reads it. Runs hang under load on this machine (docs/HANDOFF.md: scaffold "under load it hangs with an empty log"), and nothing stops two runs from starting together.
5. **Flows are hand-coded status fields.** No declaration says which statuses a flow has, which events move between them, or that a status can be left; nothing checks it.
6. **No production evidence.** std.sessions uploads a session only on its first error; nothing counts what ran without one.

## Proposal

### 1. The pieces and how they layer

| Piece | Where | Section | Rung it backs |
| --- | --- | --- | --- |
| Model checking: `explore` | `@keel/testing` | k.model (new) | `exhaustive` (bounded or seeded), `proven` (closed form) |
| Simulator: `Schedule`, `simulate` | `@keel/ctx`, `@keel/testing` | k.sim (new) | `probabilistic`, with deterministic replay |
| Ledger: evidence kinds, mutation claims, rung counts | `@keel/testing`, `@keel/cli` | k.ledger (new; the ledger moves out of k.testing) | all five |
| State charts: `chart` | `@keel/std-statecharts` (new) | std.statecharts (new) | `proven` through `explore`; structure through `keel check` |
| Production tallies: `monitor` | `@keel/std-sessions/monitor` | std.monitor (new) | `monitored` |
| Scheduled groups | `@keel/std-sessions/group` | std.multi (edited) | `probabilistic` race search |

**One exploration engine.** `explore` is the only search over a state space. It walks one store's transactions breadth first from a start state, keeps each distinct state once, and returns the shortest path to the first broken invariant as a k.store snapshot: the log is already the replayable record of transactions (glossary: log), so `restore` and one `tx` reproduce a counterexample with no new artifact.

**Layered on RFC 0081's race finder.** The two answer different questions and share their footing:
- `races(snapshot, stores)` (std.conflicts) is an order check over a recorded log: for each rebased entry it applies two orders of entries that already happened. It searches nothing and stays as accepted, so S4's byte-equal exit proof is untouched.
- `explore` (k.model) searches every order and every payload of a store's transactions from one state.
- `simulate` (k.sim) is the one generator of schedules. With `openGroup({ schedule })` (std.multi) it replays a multi-user script under generated delays, lost responses and offline windows, and a scenario that calls `findRaces` on each run is the probabilistic search for races that RFC 0081 left to S5: the race finder runs on orders the recording never saw.
- All three apply transactions through k.store's pure path (`restore`, `tx`), and the sim ctx under every group, harness and scenario is the same k.ctx sim with an optional schedule.

### 2. Kernel changes
Three new kernel sections hold the changes; k.testing, k.ctx and k.cli each change by a pointer or a word. No change to k.store, k.server, k.sync, k.router or k.check text.

- **K1, k.sim in `@keel/ctx`: schedules.** A `Schedule` schema (net steps with a delay and a fault, storage outcomes, offline windows, per-capability plans) that `createCtx({ mode: 'sim', seed, schedule })` applies; `SimClock.next()`; `register(name, { real, shell, sim, plan? })`, whose sim factory gets `{ seed, plan }`. A ctx without a schedule behaves as today. This is the kernel's because every sim capability lives in `@keel/ctx`; a stdlib wrapper around `fetch` would be a second sim net (default 1).
- **K2, k.model in `@keel/testing`: `explore`.** Synchronous breadth-first exploration over the path `properties` uses for a transaction case (restore, `tx`, read, restore). Finite payload domains come from the payload schema or from `payloads`; the closed form needs no domain hand-picked, starts from the store's own state and must exhaust the space.
- **K3, k.sim in `@keel/testing`: `simulate`.** fast-check draws `{ seed, schedule }` from the `Schedule` schema and each `plan` schema, the scenario runs on that sim ctx, `run()` settles and steps the clock through due deadlines, and a failure shrinks to the smallest schedule and is E1704 with a replayable `SimRun`.
- **K4, k.ledger in `@keel/testing` and `@keel/cli`: evidence.** The ledger leaves k.testing for its own section, text kept verbatim where conformance headers quote it. New evidence: `explore` calls (`exhaustive`, `proven`), `simulate` calls (`probabilistic`), an app's `.keel/monitored.json` (`monitored`). Mutation reports become per-file claims keyed by the sha256 of the source they mutated. The ledger file gains `rungs` (items per rung) and `mutation`; `--diff` gains E1712 (a populated rung emptied) and E1713 (a package below its threshold, or a threshold lowered). Type-level tests keep `proven` (D4), and the ledger now detects them: a passing test body asserting with `expectTypeOf` or `assertType`, which each package's `check` type-checks with `tsc`.

**Where the tokens come from.** k.testing gives up its Ledger paragraph, three Rules entries and three clauses to k.ledger (a split along its existing Ledger seam): 1,485 to 1,122. k.ctx moves the sentence fragment "(sim: `advance` resolves in deadline order)" to k.sim, which states it in full, and gains a pointer: 1,496 (after RFC 0081) to 1,494. k.cli's kernel-kinds sentence names k.ledger for the ledger's record kinds instead of listing them: 1,486 to 1,488. Counts are in Spec diff and Token impact.

### 3. Package contracts
Every new file has one export, named as the file; schemas come first (`*.schema.ts`); every effect goes through `ctx` (`clock`, `storage`, `net`, `observe`); every state these pieces keep or emit is JSON that parses with its schema: `Schedule`, `SimRun`, `explore`'s result and counterexample snapshot, a chart's store, `Tally`, `.keel/monitored.json` and the mutation claims (principle 10).

| Package | Files (exports) | Extension points | Codes |
| --- | --- | --- | --- |
| `@keel/ctx` (kernel) | `Schedule.schema.ts`, `NetStep.schema.ts`; `SimClock.ts` gains `next`; `CtxOptions.ts` gains `schedule`; `register.ts` takes `plan`; internal `simNet`, `simStorage`, `offlineWindows` | capability registry (`plan`) | E1604 |
| `@keel/testing` (kernel) | `explore.ts`, `types/ExploreOptions.ts`, `types/Explored.ts`, `simulate.ts`, `types/SimulateOptions.ts`, `types/Scenario.ts`, `types/SimRun.ts`; `types/Evidence.ts` gains `monitored`, `depth`, `to`; internal `domainOf`, `canonicalKey`, `runUntilQuiet` | none | E1708-E1710 (E1704 reused) |
| `@keel/cli` (kernel) | internal `testFacts` (`explore`, `simulate`), `monitoredEvidence`, `mutationClaims` (replaces `mutationScores`), `MutationClaimSchema`, `LedgerFileSchema`, `ledgerCommand`, `kernelFormatters` (`ledger.mutation`) | formatter registry (kernel kind) | E1711-E1713, W1714 |
| `@keel/std-statecharts` (new) | `chart.ts`, `Chart.ts` (type), `ChartSpec.ts` (type), `coverage.ts`, `Coverage.ts` (type); internal `analyze.ts` (the one structural analysis, used by `chart` and the rules); `./tools`: E2751-E2755 | check rule registry | E275x |
| `@keel/std-sessions` | `./monitor` (Node): `monitor.ts` (a `Runner`), `monitorRoutes.ts`, `Tally.schema.ts`, `loadTally.server.ts`; command `monitor`; `./tools` gains E2009; `./group`: `openGroup` takes `schedule`, `SessionGroup` keeps it | module manifest, k.topology runners | E2009, E2010 |

**Diagnostic blocks.** Kernel codes stay in their package's block: E1604 in E160x (`@keel/ctx`), E1708 to E1713 and W1714 in E170x (`@keel/testing` and the ledger, which `@keel/cli` emits as it emits E1706 and E1707 today). A failing `simulate` run is E1704, the property-failure code, since `simulate` is a property. RFC 0081 holds E2600 to E2749; this RFC takes E2750 to E2799 for std.statecharts and adds E2009 and E2010 to std.sessions' E200x block for std.monitor, as RFC 0081 added E2007 and E2008 for std.multi. E22xx and E29xx stay unassigned (fixture codes, RFC 0079). Tooling takes E0010, E0011 and W0012 (E0006, E0007 and E0009 appear as fixture codes in `packages/cli/test`).

### 4. Semantics

**Explore.** A state is identified by its JSON encoding under the store schema with keys sorted. Edges run in the given transaction order, then domain order, so results and counterexamples are deterministic. Finite domains are enumerated from the payload schema's structure (literals, enums, booleans, bounded integers, and objects, tuples, unions and optionals of finite parts, at most 256 values); a string, an unbounded number or an array needs a `payloads` list. An edge whose transaction breaks an invariant, or throws (a returned state that fails the store schema throws in `tx` today), is E1708, and its counterexample is the shortest path. The closed form (no `from`, `payloads` or `depth`) must cover every transaction the store declares, start from a store with an empty log, use schema domains only and finish `complete`; a pass shows every invariant holds in every reachable state for every payload the schemas allow, which is model checking and why it alone claims `proven` (docs/TESTING.md lists model checking under `proven`). Every other passing run enumerated a finite space fully, which is `exhaustive`. `explore` checks invariants only; determinism and undo stay `properties`' checks.

**Schedules.** A schedule is data that shrinks: fast-check removes steps, lowers delays and moves faults toward `none`, the first value of the fault enum. Step `n` of `net` is taken when the n-th fetch is made and waits `delay` on the sim clock, so two requests can reach the route in the opposite order from the one they were sent in, which is what a server-side race needs. The faults are the four a client meets: `drop` (no request reached the server), `lost` (the server ran it and the response never arrived: the case RFC 0081's write keys exist for), `unavailable` (503 before the route) and `none`. Offline windows use RFC 0081's `setOnline`. Clock, random, net and storage each have their sim driven by the seed and the schedule; a registered capability is driven by its seed and, when it declares `plan`, by its plan.

**Simulate.** Each run snapshots the live stores before and restores them after, so runs share no state. `run()` alternates the harness's settle loop with `clock.advance` to `next()` until nothing is due within `horizon` (default 600,000 ms of sim time), which bounds every run. A failing run prints `E1704 <file>:<line>:<col> simulation failed (seed 7, run 12, shrunk)` and the shrunk `SimRun` on the next line; `simulate(scenario, { replay })` and `KEEL_SEED` replay it.

**State charts.** A chart is flat: named states, one of them `initial`, some `final`; events with payload schemas; transitions with an optional named guard and an optional named action over the chart's `data`. It compiles to a store whose state is `{ state, data }` and to one transaction per event, so a chart is logged, owned through `uses`, recorded and replayed by sessions, and explored and property-tested as any store. An event that no transition of the current state accepts leaves the state unchanged, the statechart rule for unhandled events, and `enabled` lets a component disable a control for it. `keel check` proves the structure from the literal declaration: targets exist, every state is reachable when guards are taken as possibly true (so an unreachable state is unreachable on every run), and every non-final state has a way out. Guarded reachability and states that are stuck for some `data` are what `explore` finds, read through `coverage`.

**Mutation pipeline.**
1. `pnpm mutate [--filter=@keel/<pkg>]` takes a machine-wide lock (`os.tmpdir()/keel-mutate.lock`, holding the pid; a lock whose pid is gone is taken over), runs packages one at a time (`--concurrency=1`), and refuses a second run with E0010. The Keel Stryker reporter keeps a watchdog: no mutant finished for 10 minutes of wall time ends the run with `E0011 mutation run stalled at <done>/<total> mutants` and exit 1, so an agent or CI job never waits on a hung run. `pnpm test` prints W0012 when the lock is held and runs anyway; `pnpm check` never reads the lock and never runs Stryker.
2. `pnpm ledger` (`keel ledger --write tooling/ledger/ledger.json`) reads every report on disk: per file of `report.files`, a claim `{ file: 'packages/<pkg>/<path>', sha, killed, survived, noCoverage, score }` with `sha` the sha256 of `files[path].source`, and per package `{ score, threshold }` with `threshold` the report's `thresholds.break` (the floor Stryker enforces; `strykerConfig(pkg, threshold)` sets it). A report replaces the claims of the files it covers; other claims stay.
3. Freshness is computed, never stored: a claim is fresh while the file on disk hashes to its `sha`. A package's score is over its fresh claims.
4. `pnpm ledger --diff` (its own CI job, not part of `pnpm check`) reads the committed claims and any report on disk: E1713 when a package's fresh score is below its threshold or a threshold is below the committed one; W1714 per stale claim (capped at 5 in compact, counted in the summary).
5. CI: the nightly `mutate` job and the `mutate-pr` job each run `pnpm ledger --diff` after Stryker, so fresh reports are checked against the committed claims in the job that made them. CI never commits; the orchestrator runs mutation alone after each batch and commits the ledger, as today.

The claim shape in `tooling/ledger/ledger.json`:
```json
"mutation": {
  "packages": { "store": { "score": 86.1, "threshold": 80 } },
  "claims": [{ "file": "packages/store/src/tx.ts", "sha": "9f2c...", "killed": 31, "survived": 3, "noCoverage": 0, "score": 91.2 }]
}
```

**Production tallies.** `monitor` is a k.topology `Runner`. On the server it observes `save` events (k.sync), reads the saved store's snapshot from `ctx.storage` (`keel.store.<id>`, as k.server stores it) and counts each new log entry by `name`; every 60,000 ms of `ctx.clock` it merges the counts into `sessions.tally`. The reader-guarded route `sessions.tally` serves them; `keel session monitor <url>` writes `.keel/monitored.json`, which k.ledger reads. A tally counts commits on the server, which is where golden-1's writes happen; refused writes leave no entry, so they are not counted.

### 5. Privacy and auth
- **Tallies** hold transaction names (identifiers declared in source) and counts, with the first and latest merge times. No payload, caller hash, state or per-request time is read into them (default 4). `sessions.tally` sits behind the existing `sessions.reader` guard; `.keel/monitored.json` holds what that route returned, committed with the app.
- **Server-only** (default 5). `monitor` and `monitorRoutes` run only in a `node` deployable (E2009); nothing of them reaches a browser.
- **Schedules and counterexamples** are test data. A `SimRun` holds delays, faults and offline windows; an `explore` counterexample holds states and payloads the test supplied or the schema generated, printed by the failing test to its own output and never uploaded. A store whose state schema holds `s.secret` is refused by `store()` (E1303), so no counterexample snapshot holds a secret.
- **Mutation claims** hold file paths, hashes and counts.
- Nothing here changes a cookie, a guard, the write proof or `readers`.

### 6. Exit proof and golden-1
The exit proof extends `evals/tasks/golden-1-api` (default 3), as RFC 0081 did: `pnpm eval --task golden-1-api --runner none --strict`, plus `pnpm ledger --diff` in CI, which after the stage holds every rung count above 0 and fails with E1712 if one empties.

**golden-1 changes.**
- `todos`: `EditorData.schema.ts` (`s.object({ attempts: s.int({ min: 0, max: 3 }) })`) and `editorChart.ts`, the std.statecharts example in Spec diff (`viewing`, `editing`, `saving`, `conflict`, `gaveUp`). `EditTodoPage` keeps its status in the chart: save sends `editorChart.events.save`, the outbox result (RFC 0081 `send`) sends `saved`, `refused` or `failed`, and the conflict Buttons send `mine` or `theirs` beside std.offline's `resolve`.
- `api`: `runners.server.ts` lists `monitor`; `routes.ts` lists `monitorRoutes`; `module.ts` lists `@keel/std-sessions` in `deps` with `readers` in its server-only std config.
- Tests: `test/editorChart.test.ts` (closed-form `explore`, `coverage` empty, `properties` per event); `test/board.explore.test.ts` (`explore([addList(b), addTodo(b), toggleTodo(b), editTodo(b)], { from: fixture, payloads, depth: 3 })` over the S4 fixture, with payload lists holding two titles, two priorities, and one todo id that collides with the fixture's and one that does not); `test/outbox.sim.test.ts` (`simulate`, 100 runs, seed 11: one user toggles `t2` and edits `t1` through the outbox; after `run()`, the server applied each write whose outbox entry is gone exactly once, and every remaining entry is `queued`, `conflict` or `failed`).
- `.keel/monitored.json`, written by `tooling/smoke/monitor.mjs`: it builds golden-1, starts the production entry (RFC 0080) on a local port with a fresh sessions reader token, drives the S4 script in Chromium through Playwright, waits for one tally merge, runs `keel session monitor`, and stops the server.

**Rungs and their machinery** (each a `keel ledger --scope golden-1: --format=json` record):

| Rung | Item | Machinery |
| --- | --- | --- |
| `proven` | `golden-1:todos/editorChart.ts#editorChart` | closed-form `explore` (k.model) over the chart's 8 events; `keel check` E2751-E2755 clean |
| `exhaustive` | `golden-1:api/addTodo.ts#addTodo`, `toggleTodo`, `editTodo`, `addList` | `explore` from the fixture, `depth: 3` |
| `probabilistic` | `golden-1:todos/boardOutbox.ts#boardOutbox` | `simulate` 100 runs, seed 11 (k.sim); the existing `properties` runs stay |
| `example` | the rest of golden-1's exports | the existing tests |
| `monitored` | `golden-1:api/toggleTodo.ts#toggleTodo` and the other `api.*` transactions | std.monitor tally from the production-mode run, through `.keel/monitored.json` |

Kernel packages back every rung but `monitored` with their own conformance and property tests, and `tooling/ledger/ledger.json` carries fresh mutation claims for the kernel packages S5 changes after the batch's mutation run.

**What the eval asserts** (added to `pass.ts`; the hidden acceptance test gains the editor flow):
- The `--scope golden-1:` summary's `rungs` has `proven`, `exhaustive`, `probabilistic`, `example` and `monitored` each at least 1, with the items above at those rungs; an agent build is held to all but `monitored` (an app built minutes before has no production, and the ledger reports only rungs that exist).
- Planted invariant twin: a copy of the app whose `addTodo` drops its duplicate-id check fails `board.explore.test.ts` with E1708; the counterexample snapshot's log has the fewest entries possible, and `restore` plus the reported `tx` returns `store.invariant`.
- Planted chart twins: removing `theirs` from `conflict` leaves `keel check` clean (`mine` still leads to `saving`) and makes `coverage` report `dead: ['conflict']`, since `conflict` with `attempts` 3 has no applicable target; removing every exit from `conflict` is E2753 with the `final: true` fix.
- Planted schedule twin: a copy whose `postToggle` drops `...input.write` from its `tx` fails `outbox.sim.test.ts` with E1704, and the shrunk `SimRun` holds exactly one `lost` step and no other fault; `replay` of it fails the same way and two runs print byte-equal output.
- `keel ledger --diff` in the shipped app reports nothing, and with `.keel/monitored.json` removed it reports E1712.

## Alternatives
- **A model checker library** (TLA+ with TLC or Apalache, Alloy). Each needs a Java toolchain and a second, hand-written model of the app in its own language, whose verdict says nothing about the TypeScript that runs (principles 1 and 4); it would also be an external integration. Keel transactions are already pure, named and schema-typed, so the code is the model and a store-native breadth-first search over it is a few hundred lines.
- **fast-check model-based testing** (`fc.commands` with `fc.modelRun` or `fc.asyncModelRun`, present in the installed fast-check 3.23.2). It runs random command sequences against a hand-written model and shrinks them: `probabilistic`, never `exhaustive`, and the model duplicates the transactions. Keel borrows fast-check where it fits, to generate and shrink schedules in `simulate`.
- **`fc.scheduler()`** (installed). It reorders promises that the test wraps; app code's requests go through `ctx.net` and are never handed to the test. A per-request delay in the sim net gives the same reorderings as data that shrinks and replays without fast-check.
- **Fault randomness from the seed alone** (a sim net that drops a request with probability p). Deterministic, but a failing case is an opaque seed that does not shrink to "one lost response".
- **Simulation as a stdlib wrapper** around the sim net. A second sim implementation beside k.ctx's; the kernel gap is that the sim has no fault model (default 1).
- **XState for charts** (and `@xstate/graph` for paths). A second state model with its own actor runtime: its state is not a store, its transitions are not logged transactions, sessions cannot replay it, and its path generator works only on XState machines. Compiling charts to a store gets the log, ownership, sessions, `explore` and `properties` with no new runtime.
- **Hierarchical and parallel states now.** They add entry and exit order, history and region semantics to the spec; flat charts with `data` cover golden-1's flow. A later RFC can add one level of nesting.
- **Refusing an unhandled event with `err`.** k.store gives a transaction function no way to refuse except an invariant over the next state, which cannot see the event; a kernel change for this would cover only charts. Ignoring is the statechart rule, and `enabled` lets the UI say so.
- **Keeping the ledger in k.testing.** It is at 1,485 of 1,500 tokens; evidence kinds, production evidence and mutation claims need about 900 more, and `keel ledger`, its file and its codes are a concept of their own.
- **`proven` from closed-form `explore` alone** (this RFC's draft). Rejected (D4): docs/TESTING.md lists types, model checking and SMT under `proven`, and a type assertion that `tsc` checks proves the type fact it states.
- **Per-function mutation claims.** Stryker's locations could be mapped to functions, but one export per file (principle 3) makes the file the item's unit, and per file needs no second parser.
- **Committing Stryker reports.** Each embeds every mutated file's source and changes on every run; a claim with a sha carries what the gate needs.
- **Mutation inside `pnpm check`.** Minutes per package and hangs under load; `pnpm check` stays static and fast.
- **Uploading clean sessions as production evidence.** Sessions carry payload values (redacted where configured) and run to hundreds of events; a tally needs names and counts.
- **Client-side tallies.** golden-1's writes commit in server stores, which no client log holds.
- **A k.server event per committed entry.** A kernel change for a stdlib need that the `save` event plus the stored snapshot already meets; default 1 asks for a kernel change only where there is a gap.
- **A `@keel/std-monitor` package.** It would repeat std.sessions' reader guard, `readers` config, token and `session` command.
- **Making `races` try every placement of a rebased entry.** It would change RFC 0081's accepted contract and its byte-equal exit proof; `simulate` over groups explores other schedules on the replay path RFC 0081 built.
- **A golden app 3 for S5.** A third app before S6 needs its own eval and spec slice; golden-1 already has the server store, the outbox and the conflict flow these pieces exercise.

## Spec diff
Token counts are `ceil(length / 4)`, the rule `tooling/budgets.mjs` uses, measured on copies of the sections as committed when this RFC was written with RFC 0081's edits applied where it edits the same section. No existing Conformance clause changes text; three move, verbatim, from k.testing to k.ledger.

### k.testing (1,485 to 1,122)
- The **Ledger** paragraph, with its five rung bullets and the `--diff` sentence, moves to k.ledger and is replaced by: "**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate` and schedules: k.sim."
- Rules: " · E1706 ledger rung lower than committed, or unsafe count higher · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it to `// Spec:`)" moves to k.ledger; the Rules line ends after E1705.
- Conformance: these three clauses move to k.ledger, in this order: "An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`." · "Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706." · "A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line."
- Title: "Harness and ledger" becomes "Harness and properties"; in the map, its row reads "| k.testing | Harness and properties | conformance-covered | given state, do events, expect; generated properties |".

The section after the change:
~~~md
# k.testing: Harness and properties
status: conformance-covered

**Harness.** From `@keel/testing`:
```ts
const t = render(CartView, { props: { compact: false }, state: [[cart, { items: [] }]] })
await t.fire('cart.add', { type: 'click' })
expect(t.state(cart).items).toHaveLength(1)
expect(t.find('cart.total').name).toBe('Total 3')
t.dispose()
const r = await renderRoute('orders.show', { routes, params: { id }, search: {}, ctx: sim })
```
- `render(Component, { props, state?, ctx? })` -> `{ a11y(id?), state(store?), fire(id, event), settle(), find(id), dispose() }`. `props` and each `[store, value]` in `state` are parsed by their schemas first.
- `renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders, then renders its chain; it resolves when the page is ready.
- `fire(id, event)` dispatches through the delegated table (k.runtime). `event` is a closed `TestEvent` union (`click`, `input` with `value`, `change`, `keydown` with `key`, `submit`, `focus`, `blur`). It resolves once effects, resources, and actions are quiescent.
- `settle()` runs the loop `fire` uses without an event (microtask rounds until DOM and store logs are quiet, bounded, no timers), then the render checks; `renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready.
- `find(id)` returns `{ id, role, name, text, state }`, never a DOM node. `state(store)` is that store's value; `state()` is every store keyed by store id.
- Tests address elements by id only.

**ctx.** Harness renders always use a sim ctx (k.ctx). `keel test` sets `KEEL_TEST=1`, so `ctx` created anywhere in a test defaults to sim.

**a11y.** `a11y(id?)` is built from the live DOM: nodes `{ id, role, name, state: { checked?, disabled?, expanded?, selected?, invalid?, focused? }, children }`, with implicit roles and accessible names per WAI-ARIA. After the first render and after every `fire`, the harness compares each element's role and name source with the compiler's `a11y.json` (passed as `render(C, { artifacts })` by `keel test`, which reads `.keel/`; absent, E1702 is not checked) and runs axe.

**Properties.**
```ts
properties(CartView)   // generated props and state
properties(addItem)    // generated state and payload
```
`properties(target, { runs = 100, seed? })` asserts, for a component: renders without throwing, matches `a11y.json`, no axe violations, two renders with one seed are equal. For a transaction: output parses with the store schema, every `invariant` of the store holds, equal inputs give equal outputs, `undo` restores the input. Invariants are declared once, beside the store, with `invariant(store, fn)` from `@keel/store`; `@keel/testing` re-exports nothing. Every run records its seed; `KEEL_SEED=<n>` replays it.

**Failure output** (OUTPUT.md): one diagnostic per failure. Property failures print the seed, the run count, and the shrunk case. State mismatches print one compact diff of serialized state.
```
E1704 cart/addItem.test.ts:3:1 invariant cart.nonNegative failed (seed 4021, run 37, shrunk)
  payload: {"item":{"id":"i1","qty":-1}}
```

**Ledger, exploration and simulation.** Rungs and `keel ledger`: k.ledger. `explore`: k.model. `simulate` and schedules: k.sim.

**Rules.** E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`) · E1702 rendered role or name differs from `a11y.json` · E1703 axe violation in a harness render · E1704 property failed · E1705 `fire` or `find` with an id absent from `ids.json` (message lists the nearest ids).

**Conformance.**
- `render` with props that fail the `Props` schema rejects with `schema.invalid` before rendering.
- Inside a harness render, `ctx.clock.now()` returns the sim clock's value, and two runs with one seed produce equal `state()`.
- `fire` resolves only after every effect and resource it triggered has settled.
- `a11y()` for `<Button disabled>Save</Button>` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`.
- After a resource resolves, `await settle()` makes its ready state visible without any event.
- A property failing at a seed reports that seed; re-running with `KEEL_SEED` reproduces the same shrunk case.
- A transaction breaking a declared invariant fails `properties()` with E1704.
- `navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled.
~~~

### k.ctx (1,496 after RFC 0081, to 1,494)
- API: "`ctx.clock.after(ms, signal?): Promise<void>` (sim: `advance` resolves in deadline order), " becomes "`ctx.clock.after(ms, signal?): Promise<void>`, " (k.sim Clock states it).
- API: after "any other duplicate is E1602." add "Sim mode, schedules and plans: k.sim."

### k.cli (1,486 to 1,488)
- Formatter registry: "Kernel kinds: `diag`, `summary`, `req`, `ledger`, `a11y`." becomes "Kernel kinds: `diag`, `summary`, `req`, `a11y`, and k.ledger's." (k.ledger names `ledger` and `ledger.mutation`).

### std.multi (737 in RFC 0081, to 882)
- `SessionGroup`: "...; users: Session[] }" becomes "...; users: Session[]; schedule?: Schedule }".
- Record: "`openGroup({ user, serve, users, seed, origin, at?, server? })`." becomes "`openGroup({ user, serve, users, seed, origin, at?, server?, schedule? })`."
- After the handle list add: "**Schedules.** With `schedule` (k.sim), user `i` of `n` gets the schedule whose `net` holds every `n`-th step of `schedule.net` from index `i`, with `schedule.offline` and no `storage` or `plans` steps; the server ctx gets none. `advance` moves every clock, so each user's delays resolve on the group's timeline. The group keeps `schedule`, and `replayGroup` applies it."
- Conformance, before the E2007 clause: "Under one `schedule`, two runs of one script on `openGroup` give byte-equal groups, and with a `lost` step on a user's write the server holds one entry for that write's key."

### spec/00-map.md (orchestrator; about 902 after RFCs 0080 and 0081, to about 990)
- Code ranges: the E160x owner becomes "k.ctx, k.sim"; the E170x owner "k.testing, k.model, k.ledger"; the E200x owner "std.sessions, std.multi, std.monitor"; RFC 0081's row "| E270x | std.conflicts | | |" becomes "| E270x | std.conflicts | E275x | std.statecharts |".
- Kernel table: the k.testing row as in the k.testing edit above, and after it:
```
| k.model | Exploring a store's transactions | proposed | every reachable state under the invariants; shortest counterexample |
| k.sim | Schedules and simulation | proposed | delays, faults and offline windows on sim capabilities; simulate |
| k.ledger | Ledger and evidence | proposed | rungs from tests, explore and production tallies; mutation claims |
```

### spec/std/README.md (orchestrator)
Gains the line "S5 (RFC 0082) adds std.statecharts and std.monitor." and the rows:
```
| std.statecharts | State charts | proposed | check rule registry: flat charts compiled to a store and transactions, E2751-E2755 |
| std.monitor | Production tallies | proposed | std-sessions: server transaction counts as `monitored` evidence, E2009-E2010 |
```

### spec/kernel/k.ledger.md (new, 1,413)
~~~md
# k.ledger: Ledger and evidence
status: proposed

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`) and per spec clause (`k.router#3`, the 1-based Conformance sentence). A conformance test in any package names its clause in a header comment, `// Spec: k.router, clause "<sentence>"`, quoted verbatim (backticks, quote style, spacing, case and the final period aside; it may wrap onto the next `//` lines). `rung` is the highest held:
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a passing `explore` (k.model) given `from`, `payloads` or `depth`; evidence lists `depth` when it is a literal.
- `proven`: a passing type-level test (its body asserts with `expectTypeOf` or `assertType`, which the package's `check` type-checks) or a passing closed-form `explore` (k.model), which passes only when the store's whole space closed; nothing else may claim it.
- `monitored`: production only, read from an app's `.keel/monitored.json`; never emitted by the kernel. No evidence: `none`.

**Evidence from tests.** A test references an item when its body, or a helper it calls in its own file or a relative import, names it. Property runs are `properties`, `simulate` (k.sim) and fast-check's `assert` and `check`, with `runs` and `seed` read from literal options or imported constants (`properties` and `simulate` default to 100 and 1337); an unresolved value leaves the run `example`. An `explore` call is closed-form when its options object is absent or names none of `from`, `payloads` and `depth`; options the ledger cannot read count as given.

**Production evidence.** An app's `.keel/monitored.json` is `{ v: 1, origin, from, to, tx: { [name]: runs } }`, written by a stdlib monitor (std.monitor). An app export holds `monitored` when its file holds, as a string literal, the name of a transaction with `runs` >= 1, or that name's longest dotted prefix that any file holds (a chart id); evidence lists the runs and `to`. A file failing this shape is E1711 and adds nothing.

**Mutation.** Stryker (`pnpm mutate`, run alone and never inside `pnpm check`) writes `packages/<pkg>/reports/mutation/mutation.json`. `keel ledger` turns each report into one claim per mutated file, `{ file, sha, killed, survived, noCoverage, score }`: `sha` is the sha256 of the source the report holds for that file, and `score` is detected over detected plus undetected (Stryker's formula; timeouts count as detected). A claim is fresh while the file's current source has that `sha`. Each package's score is computed over its fresh claims, with the report's `thresholds.break` as its threshold. `keel ledger` emits one `{ kind: 'ledger.mutation', file, score, survived, fresh }` per claim; compact `packages/store/src/tx.ts 91.2% 3 survived`. `ledger` and `ledger.mutation` are kernel record kinds (k.cli).

**File.** `keel ledger --write <file>` writes `{ version, unsafe, rungs, mutation, exports, clauses }`: `rungs` counts, for each rung, the items holding any evidence on it; `mutation` holds each package's `{ score, threshold }` and the claims, a report on disk replacing the claims of the files it covers and other claims kept. The summary carries the `rungs` counts and the count of `stale` claims.

**Diff.** `keel ledger --diff` compares with the committed ledger, reading reports on disk as `--write` does, and checks every `conformance-covered` or `frozen` section's clauses.

**Rules.** E1706 ledger rung lower than committed, or unsafe count higher · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it to `// Spec:`) · E1711 `.keel/monitored.json` fails its shape · E1712 `--diff` without `--scope`: a rung the committed `rungs` counts above 0 is held by no item · E1713 `--diff`: a package's score over fresh claims is below its threshold, or its threshold is below the committed one · W1714 a mutation claim is stale (its file changed since the run).

**Conformance.**
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
- A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line.
- A passing `simulate` with `runs: 100` and a literal seed makes the exports its scenario names `probabilistic`.
- A passing `explore` with `from`, `payloads` or `depth` makes the transactions it names `exhaustive`; one with none of them makes them `proven`; one whose options are an imported variable gives `exhaustive`.
- A `.keel/monitored.json` naming `todos.editor.save` with runs 3 gives `monitored` evidence to the export whose file holds `'todos.editor'` and to no other; a file failing its shape is E1711.
- From a report whose sources match the tree, `keel ledger --write` stores one claim per mutated file with Stryker's counts, and the package score over them; after one file changes, its claim is stale (W1714) and the package score omits it.
- With a committed ledger whose `rungs.monitored` is 1, removing `.keel/monitored.json` makes `--diff` report E1712.
- A report whose package score is below its `thresholds.break`, or whose `thresholds.break` is below the committed threshold, makes `--diff` report E1713.
- A passing test whose body asserts with `expectTypeOf` makes the exports it names `proven`.
~~~

### spec/kernel/k.model.md (new, 1,231)
~~~md
# k.model: Exploring a store's transactions
status: proposed

`explore` visits every state a store reaches from a start state through a set of its transactions and checks the store's invariants (k.store) in each. Where `properties` (k.testing) samples generated states, `explore` enumerates the reachable ones, so a passing run is evidence for every state it visited (k.ledger `exhaustive`, `proven`).

**API** (`@keel/testing`).
```ts
const r = explore([addList, addTodo, toggleTodo], { from: fixture, payloads: { 'api.addTodo': [milk, bread] }, depth: 3 })
explore(Object.values(editorChart.events))   // closed form
```
`explore(transactions, { from?, payloads?, depth?, maxStates = 10000 })`, synchronous:
- `transactions`: one or more transactions of one store, distinct by name; else it throws E1710.
- Start: `from`, parsed by the store's schema and `check`ed (fail: E1710); else the store's current state.
- Domains: a transaction's payloads are `payloads[name]` (each parsed by its schema, fail: E1710), else every value of its payload schema when that schema is finite: literals, enums, booleans, integers with `min` and `max`, and objects, tuples, unions and optionals of finite parts, at most 256 values. A transaction with neither is E1710 before any edge runs.
- Edges: from each state, each transaction in the given order with each payload in domain order (enum and union members as declared, `false` before `true`, integers ascending, object values by key order, an absent optional first). An edge runs as a `properties` case runs a transaction: the store is restored to the state, `tx` commits, the output is read, and the store's snapshot from before `explore` is restored at the end, log `meta` included.
- Order: breadth first, so each state is reached by a shortest path. Two states are one when their JSON encodings by the store schema, keys sorted, are equal. A path stops after `depth` edges.

**Result** (JSON): `{ states, edges, depth, complete, terminal }`. `states`: every distinct state visited, the start first, in visiting order. `edges`: how many ran. `depth`: the longest shortest path. `complete`: true when no state was left unexpanded. `terminal`: the visited states from which every edge returned the same state or `err`.

**Counterexample.** An edge whose `tx` returns `store.invariant`, or whose function throws, stops the run with E1708: message `explore <store>: <transaction> broke an invariant after <n> steps (<k> states)`. The thrown error's `data` is `{ snapshot, transaction, payload }`: `snapshot` a k.store snapshot whose `initial` is the start state and whose `log` is the shortest path to the state the edge ran on, so `restore(snapshot)` and then `tx` of `transaction` with `payload` reproduce it.

**Closed form.** With none of `from`, `payloads` and `depth`, `transactions` must name every transaction of its store (`store.payloads`), the store's log must be empty, and the run must end `complete`; else E1709 or E1710. A passing closed run shows that every invariant holds in every state the store reaches from its start under every payload its schemas allow.

**Bounds.** Reaching `maxStates` (at most 1,000,000) distinct states while an unexpanded state within `depth` remains is E1709 with the counts: such a run enumerated no finite space and claims nothing.

**Rules.** E1708 an invariant broke, or a transaction threw, on an explored edge · E1709 `maxStates` reached before the space or `depth` was exhausted, or a closed form that did not close · E1710 transactions of several stores or repeated names, a `from` or `payloads` value that fails its schema, a transaction with no finite domain (message names it: give `payloads`), or a closed form missing a transaction or starting from a store with log entries.

**Conformance.**
- From `from`, with payload lists, `explore` visits exactly the states reachable within `depth` edges, each once and the start first, and `edges` counts one per expanded state, transaction and payload.
- Two calls with equal arguments return equal results.
- A transaction that breaks a declared invariant from a reachable state fails with E1708 whose `data.snapshot` log has the fewest entries of any path to it, and `restore` of that snapshot followed by `tx` of `data.transaction` with `data.payload` returns `store.invariant`.
- An enum, a boolean and an integer with `min` 0 and `max` 2 payload field give 2 × 3 × 3 payloads in the declared order; an `s.string()` field with no `payloads` entry is E1710 and runs no edge.
- A closed form over a store whose space closes returns `complete: true`; one missing a transaction of the store, or whose space exceeds `maxStates`, fails with E1710 or E1709.
- After `explore` returns or throws, the store's state, log and log `meta` equal those before the call.
- `terminal` holds a state from which every transaction returns that state unchanged, and no state with an edge to another.
~~~

### spec/kernel/k.sim.md (new, 1,223)
~~~md
# k.sim: Schedules and simulation
status: proposed

Under sim (k.ctx) every capability is deterministic by seed. A schedule fixes what the seed leaves alone: how long each request takes, which requests and storage calls fail, and when the network is offline. `simulate` runs one scenario under many generated schedules, as `properties` (k.testing) runs one property under many inputs.

**Clock.** The sim clock starts at 0 and moves only through `advance(ms)`, which resolves each waiter whose deadline it crosses in deadline order (ties: registration order), with `now()` at that deadline. `next()` returns the earliest pending deadline, else `null`.

**Schedule** (`@keel/ctx`, a schema; JSON):
```ts
type Schedule = { net: NetStep[]; storage: ('ok' | 'fail')[]; offline: { at: number; ms: number }[]; plans: { [capability: string]: JsonValue[] } }
type NetStep = { delay: number; fault: 'none' | 'drop' | 'lost' | 'unavailable' }   // delay: integer 0 to 60000
```
`createCtx({ mode: 'sim', seed, schedule })` applies it:
- **net.** The n-th `fetch` of the ctx (from 0) takes `net[n]`, or `{ delay: 0, fault: 'none' }` past the end. It waits `delay` ms on the sim clock, then: `none` runs the route and resolves its response; `drop` rejects with a `TypeError` and runs nothing; `lost` runs the route, then rejects with a `TypeError`; `unavailable` resolves a 503 and runs nothing. Each step is taken when the fetch is made, so responses can arrive out of order.
- **storage.** The n-th `get` or `set` takes `storage[n]`; `fail` rejects with an `Error`, and a failed `set` stores nothing.
- **offline.** Each window sets the net offline (k.sync) when the clock reaches `at` and online again at `at + ms`.
- **plans.** `register(name, { real, shell, sim, plan? })`: `plan` is the schema of one step of that capability's plan. Its sim factory gets `{ seed, plan }`, `plan` being `plans[name]` parsed by it (default `[]`), and consumes it in call order as its own documentation says.

A ctx without `schedule` behaves as with an empty one. `schedule` on a real or shell ctx, or one that fails `Schedule`, throws E1604.

**simulate** (`@keel/testing`).
```ts
await simulate(async ({ ctx, run }) => {
  const t = await renderRoute('todos.list', { routes, params: { listId: 'l1' }, ctx })
  await t.fire('todos.addTodo', { type: 'click' })
  await run()
  expect(t.state(serverBoard).todos).toHaveLength(3)
}, { runs: 100, seed: 7 })
```
`simulate(scenario, { runs = 100, seed?, horizon = 600000, replay? })`. Each run draws a `SimRun` `{ seed, schedule }` from fast-check, the schedule generated from `Schedule` and each registered `plan` schema, creates that sim ctx, and awaits `scenario({ ctx, seed, schedule, run })`. `run()` settles as the harness does (k.testing `settle`), then while `ctx.clock.next()` is at most `horizon` ms past the run's start it advances the clock to that deadline and settles again. Each run starts from the snapshots the live stores (`stores()`) held before `simulate`, restored after it. A scenario that throws or rejects fails the run. The seed is `seed`, else `KEEL_SEED`, else 1337; success resolves `{ seed, runs }`.

**Failure.** A failing run is shrunk (fewer steps, shorter delays, fewer faults and windows) and reported as E1704 (k.testing) with the seed, the run, and the shrunk `SimRun` as JSON on the next line. `simulate(scenario, { replay: simRun })` runs that one `SimRun` once, and two runs of one `SimRun` take the same steps in the same order.

**Conformance.**
- `clock.next()` is the earliest pending `after` deadline, and `null` once `advance` has passed every one or each waiter aborted.
- With `net` `[{ delay: 50, fault: 'none' }, { delay: 10, fault: 'none' }]`, two fetches made at time 0 resolve the second at 10 and the first at 50, and a route that records calls sees the second first.
- `drop` and `unavailable` never run the route; `lost` runs it once and the fetch rejects with a `TypeError`; `unavailable` resolves status 503.
- A `fail` storage step rejects that call and a failed `set` leaves the key's earlier value.
- An `offline` window `{ at: 100, ms: 50 }` makes `ctx.net.online()` false from clock time 100 to 150, and an observer gets the two `net` events.
- A registered capability with a `plan` schema receives `plans[name]` in its sim factory; a plan step that fails its schema, or `schedule` on a real ctx, throws E1604.
- A ctx with an empty schedule gives the same results and observer events as one without.
- A scenario that fails only when a response is `lost` fails `simulate` with E1704 whose shrunk `SimRun` holds exactly one `lost` step and no other fault; `replay` of it fails the same way.
- Two `simulate` runs with one seed pass the same `SimRun`s to the scenario in the same order.
- A module store written by one run holds its pre-`simulate` state when the next run starts and after `simulate` resolves.
~~~

### spec/std/std.statecharts.md (new, 1,120)
~~~md
# std.statecharts: State charts
status: proposed

**Extension points.** Check rule registry: E2751-E2755 through `@keel/std-statecharts/tools`. A chart compiles to a k.store store and one transaction per event, so it needs no capability and no kernel change.

**Declare.** In a client-safe file whose name is the export:
```ts
export const editorChart = chart('todos.editor', {
  data: EditorData, start: { attempts: 0 },
  events: { edit: s.object({}), save: s.object({}), saved: s.object({}), refused: s.object({}), failed: s.object({}), mine: s.object({}), theirs: s.object({}), cancel: s.object({}) },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: d.attempts + 1 }), reset: () => ({ attempts: 0 }) },
  initial: 'viewing',
  states: {
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { saved: { to: 'viewing', do: 'reset' }, refused: 'conflict', failed: [{ to: 'saving', guard: 'canRetry', do: 'count' }, { to: 'gaveUp' }] } },
    conflict: { on: { mine: { to: 'saving', guard: 'canRetry', do: 'count' }, theirs: { to: 'viewing', do: 'reset' } } },
    gaveUp: { final: true },
  },
})
```
`chart(id, { data, start, events, guards?, actions?, initial, states })`: `id` is the store id, prefixed by the declaring module (E1155). `data` is the schema of the chart's own values and `start` their first value; `events` maps each event to its payload schema. A state is `{ on?, final? }`; `on` maps an event to a target: a state name, `{ to?, guard?, do? }` (`to` absent: stay), or a list of those, tried in order. `guards` are pure predicates `(data, payload) => boolean` and `actions` pure updates `(data, payload) => data`, named by `guard` and `do`.

**Compiles to.** The store `id`, state schema `s.object({ state: s.enum(<state names>), data }, { closed: true })`, initial `{ state: initial, data: start }`; and per event the transaction `<id>.<event>` with that event's payload schema. Its function takes the first target of the current state's `on[event]` whose `guard` holds for `(data, payload)`, applies `do` to `data` and moves to `to`; with no such target the state is unchanged. The chart exposes `store`, `events` (each event's `Transaction`), `states`, `initial`, and `enabled(state, event, payload)`, true when a target applies. Writes go through `tx(editorChart.events.save, {})`, under `uses` (k.store) as any transaction.

**Checked.** `keel check` analyzes the declaration as written; `chart` repeats E2751, E2753 and E2754 as throws. Reachability treats every guard as possibly true, so a state E2752 names is unreachable on every run. Guarded reachability and stuck states are k.model's: `coverage(chart, explore(Object.values(chart.events)))` returns `{ unreached, dead }`, the declared states no explored state holds and the non-final states some `terminal` state holds.

**Rules.** E2751 `initial` or a `to` naming no state (fix: the nearest state name) · E2752 a state unreachable from `initial` through `on` targets · E2753 a non-final state with no target to another state (fix: add `final: true`) · E2754 a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry · E2755 a `chart` whose `initial`, `states`, `on` keys or targets are not literals (the checker cannot prove it).

**Conformance.**
- The compiled store's schema parses `{ state: initial, data: start }` and refuses a state name outside `states`; each event's transaction is named `<id>.<event>` and its `schema` is that event's payload schema.
- `tx` of an event moves to the first target whose guard holds and applies its `do`; with no applicable target the state and `data` are unchanged.
- `enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`.
- Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`, and `coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`.
- A state whose every exit is guarded false from some reachable `data` appears in `dead`.
- `keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins; E2751 carries a fix to the nearest name and E2753 one adding `final: true`.
- `chart` throws E2751, E2753 and E2754 for those fixtures.
- An event's transaction passes `properties` for a chart whose guards and actions are pure.
~~~

### spec/std/std.monitor.md (new, 838)
~~~md
# std.monitor: Production tallies
status: proposed

**Module.** Part of `@keel/std-sessions`, subpath `./monitor` (Node only), under the module `sessions` and its config (`readers`). It counts, on a running server, how many times each server-store transaction commits, and gives the count to the ledger as `monitored` evidence (k.ledger). It records names and counts only.

**Count.** `monitor` is a `Runner` (k.topology) that a module lists in `runners.server.ts`. Its `run(ctx, signal)` observes the app's `ctx`: after each `{ kind: 'save', store, head }` (k.sync) it reads `keel.store.<store>` from `ctx.storage` and adds one run per log entry whose `id` is above the last head it counted for that store, keyed by the entry's `name`; at its first save of a store it counts the entries above the head it saw when `run` started, else from 0. Every 60,000 ms on `ctx.clock`, and once when `signal` aborts, it merges the counts into `ctx.storage` key `sessions.tally`:
```ts
type Tally = { v: 1; from: number; to: number; tx: { [name: string]: number } }
```
`from` is the clock time of the first merge and `to` of the latest. A store folded past the entries not yet counted (more than `logLimit` commits between two saves) is counted from its kept log; the gap is not estimated.

**Read.** `monitorRoutes` holds the route `sessions.tally` (`GET /sessions/tally`), listed by the serving module: guard `sessions.reader` (a `caller` in `readers`, else redirect to `sessions.ingest`), loader output `Tally` from `ctx.storage`, `{ v: 1, from: 0, to: 0, tx: {} }` when none.

**Command** (k.cli `session`). `monitor <url> [--out f]` fetches `<url>/sessions/tally` with cookie `KEEL_SESSIONS_TOKEN`, as `ingest` does, and writes `.keel/monitored.json` (default `--out`): `{ v: 1, origin, from, to, tx }`, `origin` the URL's origin, keys sorted. It prints one `session.monitor` record `{ kind, origin, transactions, runs, file }`; compact `ok session monitor 7 transactions, 312 runs -> .keel/monitored.json`. A non-2xx answer is E2010 and writes nothing.

**Privacy.** Only transaction names, which are declared in source, and counts leave the server: no payload, caller, state, entry time or request detail is read into the tally. `sessions.tally` is behind the reader guard, and the file holds what the route returned.

**Rules.** E2009 `monitor` in the runners, or `monitorRoutes` in the routes, of a non-`node` deployable · E2010 `session monitor`: the tally URL is unreachable, not 2xx, or not a `Tally`.

**Conformance.**
- Under sim, after three saves of a store whose actions committed `api.addTodo` twice and `api.toggleTodo` once, and one clock advance of 60,000 ms, `sessions.tally` holds `tx` `{ 'api.addTodo': 2, 'api.toggleTodo': 1 }`.
- Entries committed before `run` started are not counted, and each entry is counted once across saves and merges.
- Aborting `signal` merges the counts not yet stored, and `run` resolves.
- No value of a payload, a caller hash or a store state appears in `sessions.tally` or in the written file.
- A caller outside `readers` is redirected from `sessions.tally`; a reader gets the `Tally`.
- `keel session monitor` against a served tally writes `.keel/monitored.json` that k.ledger reads; against an unreachable URL it reports E2010 and writes nothing.
- E2009 fires on a fixture and not on its clean twin.
~~~

## Conformance diff
The conformance-writer of each lane writes these from the accepted spec text, skipped until implementation; each new clause is cited verbatim by exactly one file. k.testing, k.ctx and k.cli keep every clause they hold after the change covered, so they stay `conformance-covered`; k.ledger, k.model, k.sim and the std sections are `proposed`.

- **Kernel, edited headers (one `rfc:0082` commit in the kernel lane).** The clause and quoted text stay byte-identical; only the section id changes from `k.testing` to `k.ledger` (and `describe` titles that name k.testing): `packages/cli/conformance/ledger-diff-e1706-cli.test.ts`, `ledger-diff-e1707-cli.test.ts`, `ledger-rung-promotion-cli.test.ts`; `packages/testing/conformance/ledger-diff-e1706.test.ts`, `ledger-real-runs.test.ts`, `ledger-rung-promotion.test.ts`, `ledger-shape.test.ts`, `rule-E1706.test.ts`. No assertion changes.
- **Kernel, added.** k.ledger clauses 4 to 10: `packages/cli/conformance/ledger-simulate-rung.test.ts`, `ledger-explore-rung.test.ts`, `ledger-monitored.test.ts`, `ledger-mutation-claims.test.ts`, `ledger-rungs-e1712.test.ts`, `ledger-mutation-e1713.test.ts`, `ledger-type-level-proven.test.ts` (fixture reports are hand-written JSON in Stryker's report shape; no Stryker run). k.model: `packages/testing/conformance/explore-reachable.test.ts`, `explore-deterministic.test.ts`, `explore-counterexample.test.ts`, `explore-domains.test.ts`, `explore-closed.test.ts`, `explore-restores.test.ts`, `explore-terminal.test.ts`. k.sim: `packages/ctx/conformance/sim-clock-next.test.ts`, `sim-net-delay.test.ts`, `sim-net-faults.test.ts`, `sim-storage-fail.test.ts`, `sim-offline-window.test.ts`, `sim-plan.test.ts`, `sim-empty-schedule.test.ts`; `packages/testing/conformance/simulate-shrink.test.ts`, `simulate-deterministic.test.ts`, `simulate-isolation.test.ts`.
- **std-statecharts, added.** `compiles`, `transition`, `enabled`, `closed-explore`, `dead`, `rules-e2751-e2755`, `throws`, `properties` (`.test.ts` in `packages/std-statecharts/conformance/`).
- **std-sessions, added.** std.monitor: `monitor-count`, `monitor-once`, `monitor-abort`, `monitor-privacy`, `monitor-reader`, `monitor-command`, `e2009`; std.multi: `group-schedule`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): `explore` over generated small stores visits the same set as a naive enumeration; a generated `Schedule` round-trips through JSON and a ctx under it is deterministic by `SimRun`; a generated chart declaration either throws one of E2751, E2753, E2754 or compiles to a store that `properties` accepts; claims from a generated report sum to Stryker's own counts; a generated tally merge is associative.

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (k.ledger, k.model, k.sim, std.statecharts and std.monitor new; the k.testing, k.ctx, k.cli and std.multi edits; the map and `spec/std/README.md`). Write the ADRs. Create `packages/std-statecharts` in the std-money shape (`package.json` with `.` and `./tools` exports and `@keel/schema`, `@keel/store`, `@keel/check` dependencies, `@keel/testing` as a dev dependency; `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, an empty `src/index.ts`, `conformance/`, `unsafe/`). Add the `./monitor` export to `packages/std-sessions/package.json`. Set the `tooling/deps.json` order: `std-statecharts` after RFC 0081's `std-conflicts`. Add the `tooling/budgets.json` entries and the `@keel/testing` re-base (Token impact). Add `@keel/std-statecharts` to `apps/golden-1/package.json`. Run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Run the conformance-writers. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/OUTPUT.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`, `apps/golden-1/.keel/monitored.json`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 to K4) | `packages/ctx/src/**`, `packages/testing/src/**`, `packages/cli/src/**`, `packages/check/src/internal/EXPLANATIONS.ts`; the kernel conformance files above, including the eight header edits; kernel changesets | nothing; commits K1 (schedules), then K2 (`explore`), then K3 (`simulate`), then K4 (ledger) | `pnpm --filter @keel/ctx --filter @keel/testing --filter @keel/cli --filter @keel/check run check`, the same with `run test` |
| statecharts | `packages/std-statecharts/**` | K2 for `coverage` and the closed-explore tests; writes `chart`, `analyze` and the rules first | `pnpm --filter @keel/std-statecharts run check && pnpm --filter @keel/std-statecharts run test` |
| sessions | `packages/std-sessions/**` | K1 for group schedules; RFC 0080's `Runner` and RFC 0081's `save` event for `monitor` | `pnpm --filter @keel/std-sessions run check && pnpm --filter @keel/std-sessions run test` |
| mutation | `tooling/stryker-reporter.mjs`, `tooling/turbo.mjs`, `tooling/mutate-changed.mjs`, `tooling/mutateLock.mjs` (new), `tooling/ci.source.json` and the workflows `tooling/generate.mjs` writes from it, `tooling/package.json` (a `test` script), `tooling/test/**` (new) | K4 for the end-to-end `pnpm ledger --diff` step; the lock and watchdog need nothing | `pnpm --filter @keel/tooling run check && pnpm --filter @keel/tooling run test && node tooling/generate.mjs --check` |
| golden-1 | `apps/golden-1/**` except `.keel/monitored.json`; `evals/tasks/golden-1-api/**` (TASK.md, the acceptance test, `pass.ts`; `spec-slice.txt` gains the key lines of k.model, k.sim and std.statecharts); `tooling/smoke/monitor.mjs` (new) | every lane | `pnpm --filter golden-1 run check && pnpm --filter golden-1 run test && pnpm eval --task golden-1-api --runner none --strict` |

Order: kernel, sessions, mutation and statecharts start at once. statecharts writes the declaration, compilation and rules against the spec text, and its `coverage` tests once K2 lands. sessions writes `monitor` first (it needs no kernel change of this RFC) and the group schedule once K1 lands. mutation proves the lock and the watchdog first with a fixture reporter, since the "run alone" guarantee rests on them. golden-1 starts with the chart, its schema and the eval task, and finishes last. That is four implementation agents and one kernel agent, inside the program's batch budget. After the batch, alone: the orchestrator runs `node tooling/smoke/monitor.mjs` and commits `.keel/monitored.json`; then `pnpm mutate --filter=@keel/ctx`, `@keel/testing`, `@keel/cli`, `@keel/check` and `@keel/std-statecharts` one at a time; then `pnpm ledger`. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, `pnpm ledger --diff`, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0270 (kernel lane, `packages/cli`: a range clause counted covered by any one citing file) if RFC 0080's and 0081's lanes left it open, since K4 rewrites the same evidence code; 0317 (kernel lane, `packages/testing`: `find` exposes no `lang`) if S2 left it open. 0287 (`packages/reactive`, `packages/store`), 0257, 0258, 0261 and 0291 (`packages/check` beyond `EXPLANATIONS.ts`), 0292 (apps), 0293 (the vitest 5 bump changes `pnpm-lock.yaml` and must run alone) and 0294 (waits for the pnpm pin) are outside these lanes and wait.

## Migration
- **Kernel callers.** `createCtx({ schedule })`, `SimClock.next()`, `register(..., { plan })`, `explore` and `simulate` are additions; a ctx without a schedule and a capability without a plan behave as today, and existing sim factories ignore the extra `plan` field. `Evidence` gains kinds; its consumers are `@keel/testing` and `@keel/cli`, both in the kernel lane.
- **The ledger split.** Eight conformance headers change section id (Conformance diff). Clause items renumber: `k.testing#8` to `#10` become `k.ledger#1` to `#3`, and `k.testing#11` becomes `k.testing#8`; the orchestrator rewrites `tooling/ledger/ledger.json` with `pnpm ledger` in the kernel lane's batch so `--diff` compares like with like. The `see` field of E1706, E1707 and W1706 becomes `k.ledger` (`EXPLANATIONS.ts`, `buildLedger.ts`, `coverageGaps.ts`, `ledgerCommand.ts`).
- **The ledger file.** `mutationScore` becomes `mutation.packages`; a committed file without `rungs` or `mutation` parses (both optional on read), so the first `--diff` reports nothing for them and the first `--write` adds them. E1712 starts guarding once `rungs` is committed.
- **Mutation.** `pnpm mutate` keeps its flags; a concurrent second run now exits with E0010 instead of starting. `stryker.config.mjs` files do not change.
- **golden-1** (D2). As Proposal 6 lists: the chart and its schema, `EditTodoPage` on the chart, the monitor runner and route, three tests, `.keel/monitored.json`; README follows.
- **Docs** (orchestrator). docs/TESTING.md: the Rungs line reads "`proven` (type-level tests; model checking: closed-form `explore` over a store's whole space; SMT when it exists) · `exhaustive` (`explore` from a chosen state, payloads or depth) · `probabilistic` (schema-generated properties and `simulate`, with seed counts) · `example` · `monitored` (std.monitor tallies from production)", and the Mutation paragraph describes claims, the lock, the watchdog and E1713. docs/ARCHITECTURE.md gains Borrow vs build rows "Model checking: build `explore` over transactions; no TLA+ or Alloy model", "Simulation: borrow fast-check generation and shrinking; build schedules in the sim ctx" and "State charts: build on store and transactions; no XState", and std-statecharts joins the stdlib paragraph. docs/OUTPUT.md lists the record kinds `ledger.mutation` and `session.monitor`. The `keel-testing` skill gains three lines (`explore` for reachable states, `simulate` for faults, what each rung needs); the `keel` skill gains `chart`. Each new package gets a README in the std-money shape.

## Token impact
Sections after the change (measured): k.testing 1,122 (from 1,485), k.ctx 1,494 (from 1,496 after RFC 0081), k.cli 1,488 (from 1,486), std.multi 882 (from 737 in RFC 0081); new: k.ledger 1,413, k.model 1,231, k.sim 1,223, std.statecharts 1,120, std.monitor 838; spec map about 990 (estimated from RFC 0081's 829 plus RFC 0080's rows). k.ctx is 6 tokens and k.cli 12 tokens under the cap; their next change needs a split first (k.ctx's seam is its Rules paragraph with the E1601 and E1603 clauses, k.cli's its Inspect paragraph), except RFC 0083's k.cli edit, which fits exactly (Later stages). A task that tests a store reads k.testing and k.model, about 2,350 tokens; the golden-1-api spec slice keeps key lines only. The `keel-testing` skill grows by about 70 tokens.

Package sizes (gzip; `tooling/budgets.mjs` rule; today measured, the rest estimated):

| Package | Today | Estimate | `budgets.json` |
| --- | --- | --- | --- |
| `@keel/testing` | 6,974 B | +2.1 kB (`explore` 1.2 kB, `simulate` 0.8 kB, evidence) | `{ "max": "9kb", "platform": "node" }` (9,216 B) would hold with under 200 B left; re-base to `10kb` with the measured bytes in the commit (default 7) |
| `@keel/ctx` | 2,054 B | +0.15 kB (RFC 0081) +0.55 kB (schedule, `next`, `plan`) | `3kb` holds, about 300 B left |
| `@keel/cli` | 19,166 B | +1.2 kB (claims, monitored evidence, rung counts) | `{ "max": "22kb", "platform": "node" }` holds |
| `@keel/std-sessions/monitor` | new | 1.4 kB | `{ "max": "2kb", "platform": "node" }` |
| `@keel/std-statecharts` / `./tools` | new | 1.2 kB / 3 kB | `"1.5kb"` / `{ "max": "4kb", "platform": "node" }` |

A client that uses a chart adds about 1.2 kB gzip; `explore`, `simulate`, the monitor and the rules never reach a browser.

## Known limits
- **Finite spaces only.** The closed form needs every payload schema finite and a finite reachable space; stores keyed by strings, such as golden-1's board, get `exhaustive` within a depth and a chosen set of payloads, never `proven`.
- **One store at a time.** `explore` follows one store's transactions; an invariant across stores, or a flow through actions and loaders, is `simulate`'s.
- **No state-space reduction.** No symmetry or partial-order reduction; the default bound is 10,000 states and the ceiling 1,000,000.
- **Flat charts.** No nested or parallel states and no history.
- **The schedule's model of a network** is a delay and one of four faults per request: no partial bodies, no duplicated delivery, no server-side processing time beyond the request's delay.
- **Plans need a declaration.** A registered capability without a `plan` schema is driven by its seed alone; S5 declares none for std.geo or the `session` capability.
- **Monitored means committed in production.** A tally counts commits on the server that ran `monitor`; refused writes, client stores and other instances are not counted, and the exit proof's production is a production build on a local port (D3).
- **Evidence assumes the tests passed.** The ledger reads test sources statically, as today; `pnpm test` green is the precondition for every rung but `monitored`.
- **Mutation claims age.** Between mutation runs a changed file's claim is stale and its package score covers fewer files; the nightly job checks fresh reports but never commits them.
- **A counterexample longer than `logLimit`** is folded into the snapshot's `initial` and replays from there.

## Later stages
RFC 0083 (S6, draft, written concurrently) is rebased on this RFC's split, since S5 lands first:
- **k.testing.** 0083 edits it from 1,485 to 1,459, including the Ledger paragraph (a third item kind) and the moved clauses; after this RFC those live in k.ledger, so its ledger edits move to k.ledger (1,413 here) and its render-check edits apply to k.testing at 1,122.
- **k.cli.** 0083 adds 12 tokens (1,486 to 1,498). This RFC's edit is held to 2 tokens (1,488), so both together land at 1,500, the cap exactly; any further k.cli change needs the Inspect split first.
- **std.sessions.** This RFC adds nothing to std.sessions' own section (std.monitor and std.multi are separate sections), so 0083's edit applies unchanged at 1,498.
- **Codes.** This RFC takes E1604, E1708 to E1713, W1714, E2009, E2010, E2751 to E2755, E0010, E0011 and W0012; none is among 0083's E1060 to E1064, E1111, E1570, E1571, E1820 and E1821.

## ADRs
Written with this RFC's acceptance, in `docs/adr/`: 0086 model checking, 0087 schedules, 0088 the ledger, 0089 mutation claims, 0090 state charts, 0091 production tallies.
- **Model checking is a store-native breadth-first `explore` in @keel/testing** (K2, k.model). It enumerates one store's reachable states through its pure transactions, dedupes by canonical JSON, returns the shortest counterexample as a k.store snapshot, and claims `proven` only in the closed form and `exhaustive` otherwise. Chosen over TLA+, Alloy and Apalache (a second model of the app, a Java toolchain) and over fast-check model-based testing (random, not exhaustive, with a model that duplicates the transactions).
- **Simulation is a JSON schedule on the sim ctx, generated and shrunk by fast-check** (K1, K3, k.sim). Each request takes a delay and a fault, each storage call an outcome, offline windows ride RFC 0081's `setOnline`, and registered capabilities take plans typed by a `plan` schema; `simulate` reports a failing `SimRun` that replays exactly. Chosen over seed-only fault probabilities (opaque, no shrinking), over `fc.scheduler()` (promises app code never exposes) and over a stdlib sim wrapper (a second sim net).
- **The ledger is its own kernel section and every rung has a producer** (K4, k.ledger). Evidence comes from tests (`example`, property runs including `simulate`, `explore`) and from an app's production file (`monitored`); the file counts items per rung and `--diff` refuses a rung that empties (E1712). `proven` comes from type-level tests, now detected, and from closed-form `explore` (D4).
- **Mutation results are per-file ledger claims keyed by source sha256** (K4, tooling). Stryker reports turn into claims at `pnpm ledger`; freshness is a hash comparison; thresholds come from the report's enforced floor and may never fall (E1713); runs hold a machine-wide lock, go one package at a time, and a watchdog ends a stalled run (E0011). Chosen over committing reports, over per-function claims and over mutation inside `pnpm check`.
- **State charts compile to a store and one transaction per event** (std.statecharts). Flat states, `data` with a schema, named pure guards and actions, unhandled events ignored; `keel check` proves structure from the literal (E2751-E2755) and `explore` finds guarded reachability and stuck states. Chosen over XState (a second state model and runtime, unlogged) and over nested states in S5.
- **Production evidence is a server-side tally of committed transactions** (std.monitor). A `Runner` counts entries by name after each `save`, a reader-guarded route serves the counts, and `keel session monitor` writes `.keel/monitored.json` for the ledger; names and counts only. Chosen over uploading clean sessions (payload values, volume), over client tallies (server writes unseen) and over a k.server event per entry (no kernel gap).

## Open questions
None. The escalations the defaults required are answered as D1 to D3, and D4 keeps type-level tests under `proven`.

**Borrow vs build, decided by defaults 1 to 3 with evidence.**
- **Build `explore`; borrow nothing for model checking.** The installed fast-check 3.23.2 offers `fc.commands`, `fc.modelRun` and `fc.asyncModelRun` (random sequences against a hand-written model) and `fc.scheduler` (random promise orders); neither enumerates a space, and both need a model beside the transactions. TLA+, Alloy and Apalache run on the JVM against a separate specification. Keel's transactions are the model, and `properties` already runs one transaction on one state through `restore` and `tx` (`checkTransaction.ts`), which `explore` repeats per edge.
- **Borrow fast-check for `simulate`.** Generation from a schema (`gen`, `@keel/schema/gen`) and shrinking are what fast-check does and Keel already uses for `properties`; the schedule is a schema, so its arbitrary comes from `gen(Schedule)`.
- **Borrow Stryker, build the claims.** Stryker 10.1.1's JSON report holds `thresholds` (`high`, `low`, `break`) and, per file, `source` and `mutants` with `status` (read from `packages/check/reports/mutation/mutation.json` on this machine), which is all a sha-keyed claim and its gate need.
- **Build charts on k.store; no XState.** A chart that is a store needs no second runtime and is covered by every tool the kernel has for stores.
