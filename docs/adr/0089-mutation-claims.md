# ADR-0089: mutation results are per-file ledger claims keyed by source sha256 (RFC 0082)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 2, 3 and 7.

**Context.** Stryker reports live in gitignored `packages/<pkg>/reports/`. `pnpm ledger` recorded one score per package when a report was on disk, with no link to the source it measured, and `--diff` never read it. Runs hang under load on the development machine, and nothing stopped two runs from starting together.

**Decision.** `keel ledger` turns each report into one claim per mutated file, `{ file, sha, killed, survived, noCoverage, score }`, `sha` being the sha256 of the source the report holds for that file. A claim is fresh while the file on disk has that hash; a package's score is over its fresh claims and its threshold is the report's `thresholds.break`. `--diff` reports E1713 when a package's fresh score is below its threshold or a threshold falls below the committed one, and W1714 per stale claim; each claim is a `ledger.mutation` record. `pnpm mutate` takes a machine-wide lock (E0010 for a second run), runs one package at a time, and the Keel reporter ends a run with no finished mutant for 10 minutes (E0011). `pnpm test` warns (W0012) while the lock is held; `pnpm check` never runs Stryker. The nightly and pull-request mutation jobs run `pnpm ledger --diff` after Stryker.

**Alternatives.**
- Committing Stryker reports, rejected: each embeds every mutated source and changes on every run.
- Per-function claims, rejected: one export per file makes the file the item's unit.
- Mutation inside `pnpm check`, rejected: minutes per package, and it hangs under load.

**Consequences.**
- `mutationScore` becomes `mutation.packages` in the ledger file; an old file still parses.
- Between mutation runs a changed file's claim is stale and its package score covers fewer files; CI never commits claims, the orchestrator does after each batch's mutation run.
- `stryker.config.mjs` files do not change.
