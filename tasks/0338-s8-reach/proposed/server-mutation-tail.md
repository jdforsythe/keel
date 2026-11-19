# Server mutation tail (0921)

Node v24.19.0, Stryker with the vitest runner, two test runner processes, on a machine other work shares. Every number here is measured in this worktree unless it says estimate. A reporter loaded from outside the repo records each mutant's plan (covering tests, Stryker's timeout, its loop limit) and the time each result arrives.

## Result

Server mutation finishes. The cache holds all 5,469 mutants: 4,192 killed, 76 timeout, 961 survived, 215 no coverage, 23 ignored, 2 runtime errors, 0 untested. The score is 78.4% against a threshold of 70.

No stalling mutant is a missing bound in the server. Each one breaks a loop that the unmutated code ends by construction, and the cost came from the run's configuration: two test files and two timeouts.

| | before | after |
|---|---|---|
| Tail rate, scrub mutants | 0.4 a minute | 3.5 a minute (94 in 27 minutes, 42 of them timeouts) |
| Rate over the last 899 mutants | not reached | 32 a minute (27.8 minutes, to the end) |
| A scrub mutant that loops without end | 383 s, ends as a runtime error | 60 to 90 s, or under 30 s when the loop limit catches it, ends as a timeout |
| Dry run, time in tests | 147 s of 194 s | 18 to 35 s of 65 to 89 s |
| Untested | about 840 | 0 |

## What stalled

The first 40 mutants a resumed run reached were in `src/internal/automatonOf.ts` lines 122 to 171, the children table and the breadth-first pass of the scrub's automaton. Mutant 838 (`automatonOf.ts:129`, `parent[x] ?? 0` to `parent[x] && 0`) took 383 s and ended `RuntimeError`, and so did its neighbor on the other runner. Two runners at that pace give 0.3 to 0.4 mutants a minute.

Three things multiplied.

1. Two test files, `test/scrubSteps.test.ts` and `test/redTeam0105.test.ts`, held the scrub's cases on texts of 400,000 to 2,000,000 characters. Instrumented they took about 115 s of the dry run's 147 s. Stryker's timeout for a mutant is 5 s, plus 1.5 times its covering tests' dry run time, plus the dry run's overhead (47 to 53 s here). For a scrub mutant, covered by 220 tests that took 113 s, that is 222 s. Stryker's loop limit is 100 times the dry run's passes through the mutated code, so with those cases it sat at 0.9 to 2 billion passes and seldom fired.
2. The mutation-only vitest config set a 60 s test timeout for those cases. The test watchdog (`tooling/watchdog.ts`) kills a runner whose test runs past its timeout plus two hook timeouts, twice, plus 30 s: 190 s. That is under Stryker's 222 s, so the watchdog killed the runner first. Stryker treats a dead runner as a crash, runs the mutant again, and after the second crash reports a runtime error, which counts for nothing in the score.
3. A mutant in the children table or the failure links leaves the breadth-first pass, the binary search in `go`, or the walk in `scrubbed` without an end. The loop is synchronous, so vitest's own timer never fires and only a kill from outside ends it.

## The stalling mutants by class

### a. A missing bound in the unmutated code: none

Each loop a mutant turned endless was read against the unmutated code for an input that does the same.

- `automatonOf.ts` 122 to 171 and `scrubbed.ts` 45 to 82 (49 timeouts). The trie is a tree by construction, each node enters the queue once, a failure chain ends at the root, and the walk's inner loop ends at state 0. The input is capped before any of it runs: forms stop at 2,000,000 characters (`SCRUB_CAP`, k.privacy Server log) and a longer message is not read.
- `attempted.ts` 12 and 24 (10 timeouts, 1 runtime error). With `isThenable` wrong, `attempted` returns a promise as a finished value, and the heartbeat loop in `liveStream.ts:55` and the restart loop in `keepRunning.ts:25` stop waiting on the clock: a loop of microtasks with no pause. The unmutated loops wait 1,000 ms (k.topology Runners) or one heartbeat on `ctx.clock` each turn.
- `runGuards.ts` 118 to 121 (3). The redirect walk is bounded by `guardLoop` and `MAX_GUARD_HOPS` in `@keel/router`.
- `liveStream.ts` 55 and 71 (2). I tested the hostile case against the unmutated code with a client that never reads the body. The loader is pulled 2 times and then waits on the write, so nothing queues. An aborted request frees the stream's place and returns the loader's iterator. `close()` resolves and the iterator returns after it. The probe was a throwaway test and is not in the repo: `test/liveStreamAborted.test.ts` and the conformance file for close cover the same paths with a reading client.
- `keepRunning.ts:25` (1). A runner that rejects every time runs again every 1,000 ms with no limit on the count. That is the contract (k.topology Runners) and its rate is fixed, so I left it.
- `dom/ServerNode.ts:112` (4), `dom/compileSelector.ts:43`, `nearestErrorElement.ts:5`, `secretSegments.ts:53` (4), `written.ts:10`: a loop counter or its test is mutated. Each unmutated loop runs over a finite list or string.

### b. An expected timeout: 76 timeouts and 1 runtime error

Stryker's timeout is the right killer for all of them. Of the 76, 47 end by the loop limit in 0 to 46 s and 29 wait for the full timeout of 59 to 90 s. `automatonOf.ts:47` (`i++` to `i--` in `folded`) grows a string until the 1.5 GB heap is full and ends as a runtime error in about 6 s.

| file | timeouts | lines |
|---|---|---|
| `automatonOf.ts` | 35 | 32, 34, 122 (2), 123, 126 (6), 128 (4), 129, 130, 132, 137, 138, 142, 143, 150, 153 (2), 158 (2), 162 (4), 171 (4) |
| `scrubbed.ts` | 14 | 45, 47, 50 (2), 51 (5), 54, 64 (3), 82 |
| `attempted.ts` | 10 | 12 (8), 24 (2) |
| `dom/ServerNode.ts` | 4 | 112 |
| `secretSegments.ts` | 4 | 53 |
| `runGuards.ts` | 3 | 118, 120, 121 |
| `liveStream.ts` | 2 | 55, 71 |
| `dom/compileSelector.ts`, `keepRunning.ts`, `nearestErrorElement.ts`, `written.ts` | 1 each | 43, 25, 5, 10 |

I added no `// Stryker disable` comment. No line has a hang as its only outcome: the densest, `automatonOf.ts:126`, has 6 timeouts, 1 survivor and 1 kill, and `attempted.ts:12` has 8 timeouts beside 9 kills and 1 survivor. A comment there hides mutants the tests catch.

### c. A runner fault: two, both fixed

- The watchdog raced Stryker's timeout and won, as described above. `tooling/mutate.mjs` now starts Stryker with `KEEL_WATCHDOG_GRACE_MS` at ten minutes, for every package. The same mutant is then one timeout, counted as detected. Of the 11 mutants that ended as runtime errors before the change (9 in the cache, 2 in the diagnostic run), 10 are now timeouts.
- The scale cases set every scrub mutant's timeout and loop limit. They moved, unchanged, to `test/scrubSteps.scale.test.ts` and `test/redTeam0105.scale.test.ts`, and `vitest.stryker.config.mjs` leaves `test/*.scale.test.ts` out. `pnpm test` still runs all 47 cases of the four files. The test timeout under mutation is 10 s in place of 60 s: the slowest remaining test takes 1.1 s instrumented on a quiet machine and 2.7 s on a loaded one.

No test leaks a server, a socket or a timer into later mutants: run 3 holds 32 mutants a minute to its last mutant. The five `keel build` tests the config leaves out (0922) play no part in the stall, and adding them would add seconds to every mutant they cover.

## What leaving the scale cases out costs

Of the mutants the cache held as killed and this work ran again, 13 are still killed, 8 now survive and 1 is a timeout. The cap keeps its killers at small scale: `test/holdSecrets.test.ts` passes a small cap to `automatonOf` and checks it at its exact size.

## Measure

Three runs, each on the default 30-minute budget.

| run | config | ran | result |
|---|---|---|---|
| 1 | scale cases out, 10 s test timeout | 19 in 5 minutes | stopped by hand: `attempted.ts:12` took 183 s and ended as a runtime error, because the watchdog's 90 s was under Stryker's 99 s |
| 2 | plus the ten-minute grace | 94 in 27 minutes | budget reached at 4,570 of 5,469; 42 timeouts, 42 survivors, 9 kills, 1 runtime error |
| 3 | same | 899 in 27.8 minutes | finished: `ok mutate server score 78.4% (threshold 70%)` |

Two results in the cache are runtime errors. `automatonOf.ts:47` is the out-of-memory mutant. `attempted.ts:12:3` (`false`) is left from run 1 and is a timeout under the present config; Stryker reuses it until the file or its tests change.

A cold cache costs more than 30 minutes: 29 full timeouts at 59 to 90 s on two runners are about 18 minutes (estimate), and the mutants outside the scrub fill most of two budgets. The run resumes from its cache, so a cold server is two or three bounded runs.

Of the 899 mutants of run 3, 492 survive. In some files nearly every newly measured mutant survives: `dom/parseHtml.ts` 38 of 38, `bearerOf.ts` 25 of 25, `peerPaths.ts` 23 of 24, `TopologySchema.ts` 15 of 15, `dom/VOID_TAGS.ts` 14 of 14, `onUncaught.ts` 11 of 11. Tables and expressions at module level are the static mutant gap of 0920; I did not check each of these files for it. A survivor covered by 400 tests costs about 30 s, because Stryker runs every covering test before it calls a mutant survived.

## std-sessions

Not run. From its configs and the times its last dry run saved:

- It has no vitest config of its own for mutation, so every test runs. The tests take 154 s. Six conformance files take 129 s of that: `group-replay` 45.6 s, `group-schedule` 29.2 s, `group-order` 16.8 s, `group-deterministic` 16.2 s, `net-event` 13.1 s, `group-isolation` 8.0 s. Each is a seeded property of 4 to 10 runs that renders an app per run, with its own timeout of 60 or 120 s.
- A mutant those files cover gets a Stryker timeout of 5 s plus the overhead plus up to 231 s, and a survivor pays the full covering time. Two a minute is 60 s a mutant on two runners, which matches survivors and slow kills that wait for one of the six files.
- The watchdog race is there too. A test on the default 5 s timeout has a watchdog bound of 80 s, under any Stryker timeout that includes those files. The ten-minute grace in `tooling/mutate.mjs` removes that part for every package.

So the pattern is the same in both parts. The fix is a `vitest.stryker.config.mjs` for std-sessions that leaves the six files out. They are conformance files and stay as they are for `pnpm test`. `test/group-handle.test.ts`, `group-stream`, `group-caller` and `group-app` cover the same code in 7.2 s. With them out the tests take about 25 s (estimate from the saved times), a factor of 6 on the test time behind every timeout and every survivor. Measure which kills are lost the way this note does, by comparing the cache before and after.

## Left

- `automatonOf.ts`: a `head < nodes` bound on the breadth-first pass would end the 16 timeouts of lines 122 to 133 early (estimate, not tried). It guards a state the unmutated code cannot reach and adds bytes to a package near its size limit, so it is the owner's call.
- The 8 mutants only the scale cases killed want cases at small scale (failure links and padding in `automatonOf.ts` 158 to 168).
- Survivors are now the largest cost in a server run: 961, each paying for every test that covers it.
- 0922 is unchanged.
