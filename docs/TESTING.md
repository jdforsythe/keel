# Testing and the ledger

**Rungs.** `proven` (types, model checking, SMT when it exists) · `exhaustive` (finite spaces fully enumerated) · `probabilistic` (schema-generated properties, simulation, fuzz, with seed counts) · `example` (hand cases, golden flows) · `monitored` (production only). The ledger lists every public function and spec clause with its highest rung and evidence path.

**Kernel requirements.** Conformance green · property tests for every exported pure function · mutation score >= 80% for `schema`, `reactive`, `store`, `router`; >= 70% elsewhere · a11y assertions in `ui`, `runtime-dom` · output budgets in `cli`, `check`.

**Conformance rules.** Written by `conformance-writer` from the spec section before implementation · imports public API only · lives in `packages/<pkg>/conformance/` · changes only via `rfc:NNNN` PRs (hook + CI).

**Evals.** `evals/` holds agent tasks with pass criteria. Metrics: converged ledger-green rate, iterations to green, tokens to green, unsafe count. Run weekly across >= 2 models; results committed to `evals/results/`.

**Determinism.** All kernel tests run under a seeded clock and PRNG via `ctx`. A test reading wall time fails lint.
