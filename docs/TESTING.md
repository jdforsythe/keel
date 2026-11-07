# Testing and the ledger

**Rungs.** `proven` (types, model checking, SMT when it exists) · `exhaustive` (finite spaces fully enumerated) · `probabilistic` (schema-generated properties, simulation, fuzz, with seed counts) · `example` (hand cases, golden flows) · `monitored` (production only). The ledger lists every public function and spec clause with its highest rung and evidence path.

**Kernel requirements.** Conformance green · property tests for every exported pure function · mutation score >= 80% for `schema`, `reactive`, `store`, `router`; >= 70% elsewhere · a11y assertions in `ui`, `runtime-dom` · output budgets in `cli`, `check`.

**Mutation.** `pnpm mutate [--filter=@keel/<pkg>]` (turbo; nightly in CI) or `pnpm --filter @keel/<pkg> mutate` runs Stryker (vitest runner, incremental) with the shared factory `tooling/stryker.mjs`; each package has a 3-line `stryker.config.mjs`. Prints one trailer `ok|fail mutate <pkg> score 84.2% (threshold 80%)`; `KEEL_FORMAT=json` prints the NDJSON summary. The report is `packages/<pkg>/reports/mutation/mutation.json`; `pnpm ledger` (`keel ledger --write tooling/ledger/ledger.json`) records `mutationScore` per package from it. Thresholds are never lowered; a temporary floor needs a `TODO` and a backlog line.

**Conformance rules.** Written by `conformance-writer` from the spec section before implementation · imports public API only · lives in `packages/<pkg>/conformance/` · changes only via `rfc:NNNN` PRs (hook + CI).

**Evals.** `evals/` holds agent tasks with pass criteria. Metrics: converged ledger-green rate, iterations to green, tokens to green, unsafe count. Run weekly across >= 2 models; results committed to `evals/results/`.

**Determinism.** All kernel tests run under a seeded clock and PRNG via `ctx`. A test reading wall time fails lint.
