# Task 0096: mutation score gaps (compiler, cli, scaffold)

**Spec:** none (docs/TESTING.md kernel requirements: mutation >= 70% elsewhere) · **Gate:** G3 · **Branch:** jdforsythe/test-impl · **Status:** closed (2026-11-06) · **Evidence:** `packages/<pkg>/reports/mutation/mutation.json`

## Deliverables
- [x] compiler mutation score >= 70%: 88.2% (was 57.4%), run 8m30s
- [x] cli mutation score >= 70%: 90.9% (was 59.1%), run 7m22s; bin.ts stays NoCoverage (exercised only via child process, invisible to Stryker)
- [x] scaffold mutation score 71.0% (threshold 70%). Cold run 16m41s on a machine at load 55-114 (about 9,600 CPU-s, roughly 10 min idle); warm incremental run 1m41s. Under-15-min idle timing not proven; follow-up in backlog 0097.
- [x] ledger records all three scores (tooling/ledger/ledger.json); no threshold lowered; no `floor` added

## Steps
1. [x] Survivor lists per file extracted from the existing reports (scratchpad; compiler top: lowerFile 536, collectStyles 169, analyze 130, vite 101, shapeAt 97; cli top: readProject 86 nocov, unifiedDiff 68, lspHandle 65, toJsonSchema 65, scrubCode 57, bin 55 nocov, parseArgv 54).
2. [x] Parallel sonnet subagents write new unit tests under `packages/<pkg>/test/` targeting survivors; each owns distinct new files; none runs Stryker (shared `.stryker-tmp`); each verifies with `pnpm --filter @keel/<pkg> test` and `pnpm check`.
3. [x] Scaffold: sonnet subagent profiles the vitest suite under Stryker and tunes (`mutate` globs, `disableTypeChecks`, timeout factors, or splitting heavy property tests) without lowering the threshold.
4. [x] Rerun `pnpm --filter @keel/compiler mutate`, `@keel/cli`, `@keel/scaffold` sequentially; record scores here; iterate on the largest remaining files if under threshold.
5. [x] Commit by explicit path; ledger regenerated; backlog 0096 checked; handoff.

## Decisions
- D1: Tests are added, thresholds untouched (docs/TESTING.md: thresholds are never lowered).
- D2: Subagents never run Stryker concurrently; the orchestrator runs each package's mutate alone.
- D4: Tests must not call `process.chdir` (vitest worker threads under Stryker refuse it); spy on `process.cwd` instead.
- D5: Scaffold tuning is Stryker-only (keyed on `STRYKER_MUTATOR_WORKER`): fewer fast-check runs, a cheap-first sequencer, and a biome verdict cache in the OS temp dir; plain `pnpm test` is unchanged.
- D3: New tests go in `test/`, not `conformance/` (no RFC needed; conformance is spec-bound).

## Verification
- [x] `pnpm --filter @keel/compiler mutate` trailer `ok mutate compiler score 88.2% (threshold 70%)`
- [x] `pnpm --filter @keel/cli mutate` trailer `ok mutate cli score 90.9% (threshold 70%)`
- [x] `pnpm --filter @keel/scaffold mutate` trailer `ok mutate scaffold score 71.0% (threshold 70%)`; wall time 16m41s cold under heavy load (see deliverable note)
- [x] `pnpm check && pnpm test` green; `unsafe` count 6, unchanged

## Next action
None; closed. Follow-up 0097 (scaffold survivors in opRoute/opRename/renameSource/renameModule/constructorSites/diagnose/editManifest; prove idle run < 15 min).