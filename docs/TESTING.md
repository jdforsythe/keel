# Testing and the ledger

**Rungs.** `proven` (types, model checking, SMT when it exists) · `exhaustive` (finite spaces fully enumerated) · `probabilistic` (schema-generated properties, simulation, fuzz, with seed counts) · `example` (hand cases, golden flows) · `monitored` (production only). The ledger lists every public function and spec clause with its highest rung (`none` when no evidence exists) and evidence path.

**Kernel requirements.** Conformance green · property tests for every exported pure function · mutation score >= 80% for `schema`, `reactive`, `store`, `router`; >= 70% elsewhere · a11y assertions in `ui`, `runtime-dom` · output budgets in `cli`, `check`.

**Mutation.** `pnpm mutate [--filter=@keel/<pkg>]` (turbo; nightly in CI) or `pnpm --filter @keel/<pkg> mutate` runs Stryker (vitest runner, incremental) through the one runner `tooling/mutate.mjs` with the shared factory `tooling/stryker.mjs`; each package has a 3-line `stryker.config.mjs`. Prints one trailer `ok|fail mutate <pkg> score 84.2% (threshold 80%)`; `KEEL_FORMAT=json` prints the NDJSON summary. The report is `packages/<pkg>/reports/mutation/mutation.json`; `pnpm ledger` (`keel ledger --write tooling/ledger/ledger.json`) records `mutationScore` per package from it. Thresholds are never lowered; a temporary floor needs a `TODO` and a backlog line.

**Mutation run time.** No run is longer than its budget: `tooling/budgets.json` `mutate`, in minutes (`default` 30; a package may have its own entry). At the budget the runner sends Stryker one SIGINT, Stryker saves what it tested, and the run ends `fail mutate <pkg> time budget 30m reached at 5,120 of 8,634 mutants; run again to resume (1800.4s)`. The next run starts from the saved results, so a cold package is several bounded runs.
- Cache: `<git common dir>/keel-mutation/<pkg>.json`, shared by every worktree of a clone, so one run of a package at a time per clone (`<pkg>.run.json` holds the claim); CI restores that directory and always saves it under a key of its own run. `<pkg>.times.json` beside it holds the dry run's time per test file.
- Order: test files run shortest first (`@keel/tooling/quick-first`), so a mutant a quick test kills never pays for a slow one. A package with its own vitest config for mutation runs names the sequencer there.
- Watch and stop: `pnpm mutate:status` prints one line per live run (`check 5,120 of 8,634 mutants, 3,100 reused, 41 a minute, about 14m left`); `pnpm mutate:stop` sends the one SIGINT to every live run the runner started. Stryker exits without saving on a second signal, so the budget, `mutate:stop` and Ctrl-C all claim the run file first and only the first one signals; never signal Stryker by hand. A run that has not left 120 s after its SIGINT is killed; a run whose runner died ends itself the same way.
- Per task: `pnpm mutate:changed [--base <ref>]` runs only packages changed since `<ref>` (default `origin/main`), and only a package's changed `src` files when nothing but prose changed beside them; the report keeps every other file's results. The whole run is the nightly one.

**Conformance rules.** Written by `conformance-writer` from the spec section before implementation · imports public API only · lives in `packages/<pkg>/conformance/` · changes only via `rfc:NNNN` PRs (hook + CI).

**Evals.** `evals/` holds agent tasks with pass criteria. Metrics: converged ledger-green rate, iterations to green, tokens to green, unsafe count. Run weekly across >= 2 models; results committed to `evals/results/`.

**Determinism.** All kernel tests run under a seeded clock and PRNG via `ctx`. A test reading wall time fails lint.

verified: ca93820d1c28ba356fca552aafde67801229366e
