# Task 0096: mutation score gaps (compiler, cli, scaffold)

**Spec:** none (docs/TESTING.md kernel requirements: mutation >= 70% elsewhere) · **Gate:** G3 · **Branch:** jdforsythe/test-impl · **Status:** open · **Evidence:** `packages/<pkg>/reports/mutation/mutation.json`

## Deliverables
- [x] compiler mutation score >= 70%: 88.2% (was 57.4%), run 8m30s
- [ ] cli mutation score >= 70% (was 59.1%; 316 more kills needed)
- [ ] scaffold mutation run completes under 15 min with a score >= 70%, or a config split that does
- [ ] ledger records all three scores; no threshold lowered; no `floor` added

## Steps
1. [x] Survivor lists per file extracted from the existing reports (scratchpad; compiler top: lowerFile 536, collectStyles 169, analyze 130, vite 101, shapeAt 97; cli top: readProject 86 nocov, unifiedDiff 68, lspHandle 65, toJsonSchema 65, scrubCode 57, bin 55 nocov, parseArgv 54).
2. [x] Parallel sonnet subagents write new unit tests under `packages/<pkg>/test/` targeting survivors; each owns distinct new files; none runs Stryker (shared `.stryker-tmp`); each verifies with `pnpm --filter @keel/<pkg> test` and `pnpm check`.
3. [ ] Scaffold: sonnet subagent profiles the vitest suite under Stryker and tunes (`mutate` globs, `disableTypeChecks`, timeout factors, or splitting heavy property tests) without lowering the threshold.
4. [ ] Rerun `pnpm --filter @keel/compiler mutate`, `@keel/cli`, `@keel/scaffold` sequentially; record scores here; iterate on the largest remaining files if under threshold.
5. [ ] Commit by explicit path; ledger regenerated; backlog 0096 checked; handoff.

## Decisions
- D1: Tests are added, thresholds untouched (docs/TESTING.md: thresholds are never lowered).
- D2: Subagents never run Stryker concurrently; the orchestrator runs each package's mutate alone.
- D3: New tests go in `test/`, not `conformance/` (no RFC needed; conformance is spec-bound).

## Verification
- [x] `pnpm --filter @keel/compiler mutate` trailer `ok mutate compiler score 88.2% (threshold 70%)`
- [ ] `pnpm --filter @keel/cli mutate` trailer `ok`
- [ ] `pnpm --filter @keel/scaffold mutate` trailer `ok` and wall time < 15 min
- [ ] `pnpm check && pnpm test` green; `unsafe` count unchanged

## Next action
Step 4: cli mutate running; scaffold agent finishing its tuned run; then ledger, backlog, handoff.
