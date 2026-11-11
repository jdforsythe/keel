# Task 0401: mutation run time budget

**Spec:** none (tooling) · docs/TESTING.md Mutation · **Principles:** 11, 12 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-11)

User rule (2026-11-11): no mutation run may take two hours again, and a run must not be silent until its trailer.

## Facts measured before design
- Stryker 10.1.1 saves a partial incremental file on one SIGINT (`4-mutation-test-executor.js`); a second signal forces exit without saving.
- A run with `--mutate <file>` keeps every out-of-scope file in the incremental file and in `mutation.json` (ui: 38 files before, 33 after, the 5 dropped no longer exist), so a scoped run leaves a whole report.
- Reporter events: `onDryRunCompleted` carries each test's `fileName` and `timeSpentMs`; `onMutationTestingPlanReady` carries the plan; `onMutantTested` fires per mutant.
- check, last full run: 9,958 mutants, 320 timeouts in 42 files (unifiedDiff 68, guardRedirectLoops 40, the rest spread over rule files and not loops in those files).
- The cache lives in `packages/<pkg>/.stryker-tmp/incremental.json` (git-ignored, 70 MB over 15 packages): a new worktree starts cold.

## Decisions
- D1 one runner: every package's `mutate` script is `node ../../tooling/mutate.mjs`. It spawns Stryker, records the child's pid in `.stryker-tmp/run.json`, enforces the time budget, and passes other arguments through. `--status` and `--stop` are modes of the same file (`pnpm mutate:status`, `pnpm mutate:stop`).
- D2 cache home: `<git common dir>/keel-mutation/<pkg>.json`. Every worktree of a clone shares it; CI caches that one directory with separate restore and always-run save steps, so a run that hits its budget still saves progress. Not committed: 70 MB of JSON that changes on every run.
- D3 time budget: `tooling/budgets.json` `mutate` (minutes; `default` 30, per-package overrides). Over budget the runner sends one SIGINT, waits for Stryker to save, prints `fail mutate <pkg> time budget 30m reached at N of M mutants; run again to resume`, exit 1. A cold check run is then several bounded runs, each resuming.
- D4 progress: the `keel` Stryker reporter writes `.stryker-tmp/progress.json` (total, tested, killed, survived, timeout, startedAt) at most once a second. stdout stays silent until the trailer (docs/OUTPUT.md); `pnpm mutate:status` prints one line per live run.
- D5 stop: `pnpm mutate:stop` reads `run.json`, confirms the pid is alive and its command line names `stryker`, sends one SIGINT. Only pids the runner started are signalled.
- D6 quick-first for every package: the reporter writes per-file test times from the dry run to `.stryker-tmp/test-times.json`; a shared vitest sequencer (`@keel/tooling/quick-first`) sorts files by that, shortest first, read at sort time so the first run uses it too. Replaces check's and scaffold's hand-kept SLOW patterns.
- D7 scoped runs: `tooling/mutate-changed.mjs` passes a package's changed `src` files as `--mutate` when only `src` changed; any test or config change runs the package whole (incremental). `--base <ref>` names the range. The full run stays nightly.
- D8 timeouts: no source change and no tighter factor. A tighter factor turns slow mutants into false kills (principle 11); loop bounds in check source are a kernel edit for a tooling reason. The budget bounds their cost and the cache pays it once. The 212 timeouts outside the two loop files get a backlog line.

- D9 the runner refuses a second run in a package with a live one (it would remove the first run's sandbox), and removes sandbox copies an interrupted run left. Stryker titles its process `stryker`; that title plus the pid in `run.json` is the liveness test.
- D10 packages without a vitest config of their own for mutation runs use `tooling/vitest.mutate.config.ts` (their `vitest.config.ts` plus the sequencer); check, scaffold, server name the sequencer in theirs.
- D11 tooling has a `test` script (`tooling/test/mutate.test.ts`, 12 tests) so the pure parts run in `pnpm test`.

## Measured (ctx, 318 mutants)
- Cached run 4 s; forced run 12 s. Budget 0.1 min on a forced run: `fail mutate ctx time budget 0.1m reached at 111 of 318 mutants; run again to resume`, exit 1, 150 results saved, the resume reused 150 and finished at 76.8%.
- `mutate:status` during a run: `ctx 65 of 318 mutants, 7 reused, 881 a minute, about 1m left`; `mutate:stop` ended it with `fail mutate ctx stopped at 65 of 318 mutants; run again to resume` and the resume reused 83.

## Steps
1. [x] `tooling/mutate.mjs` runner (D1, D3, D5) and reporter progress, test times (D4, D6).
2. [x] Shared factory: cache home (D2); move the 15 existing caches there.
3. [x] `quick-first` sequencer; check, scaffold configs use it; other packages get it through the factory (D6).
4. [x] `mutate-changed.mjs` scoped runs (D7).
5. [x] CI source: restore/save steps on the new path; regenerate.
6. [x] Tests for the pure parts (budget lookup, status line, changed scope, sequencer order).
7. [ ] docs/TESTING.md, docs/HANDOFF.md, backlog; close.

## Verification
- `pnpm check` and `pnpm test` green.
- ctx: `pnpm --filter @keel/ctx mutate` prints the trailer; `pnpm mutate:status` shows a line during a run; `pnpm mutate:stop` ends a run with a saved cache and the next run resumes.
- A budget of 0.05 min on a forced run fails with the budget line and leaves a cache.
- `node tooling/mutate-changed.mjs --list --base HEAD~1` names packages and files.

## Next action
Read the check and server runs through the runner (started 2026-11-11), then `pnpm check`, `pnpm test`, step 7, reviewer, close.
