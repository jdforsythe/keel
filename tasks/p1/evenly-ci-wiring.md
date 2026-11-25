# Evenly: the edits that put `apps/evenly` into the gate and CI

A list for the orchestrator. None of these edits is made. `apps/evenly` is a workspace package already (`pnpm-workspace.yaml` has `apps/*`).

Found by searching the tree for where `household` is named; the rest is discovered by directory and needs no edit.

## Needs an edit

1. `tooling/ci.source.json`, two `a11y reports for the ledger ...` steps (the `check` job near line 61 and the mutation job near line 600): add `--filter evenly` to the `pnpm ... --filter golden-1 --filter golden-2 --filter household ... exec keel test` command. `apps/evenly/reports/a11y.json` is written by `keel test`.
2. `tooling/ci.source.json`, a new step beside the household smoke (near line 255), once the smoke exists: `node --disable-warning=ExperimentalWarning tooling/smoke/evenly.mjs`. The design's smoke (`tooling/smoke/evenly.mjs --to <layer>`) is not written; layers 1 to 3 were browsed with a throwaway script (see `tasks/p1/evenly-findings.md`, 17). Until it exists, do not add this step.
3. `pnpm generate` after any edit to a `*.source.json`, so `.github/workflows/*` and `tooling/turbo.source.json` outputs are regenerated and committed.
4. `tooling/mutate-nightly.source.json` (line 206): add `--filter evenly` to the same `exec keel test` a11y step.
5. `tooling/ledger-fresh.mjs` line 6: the comment lists the apps whose `keel test` feeds `--a11y`; add `evenly` (a comment only, but it states what CI does).
6. `tooling/ledger/ledger.json` and `tooling/ledger/evidence.json`: run `pnpm ledger` (and the evidence update the repo uses for `apps/<name>` units, `tooling/evidence.mjs`) from a clean tree after the first CI a11y run, and commit the result. The ledger carries per-file rungs for household (`"pkg": "household"`); evenly's files appear as new records. Check that `pnpm ledger --diff` reports no lowered rung.
7. `tooling/deploy.source.json` `apps` list: add `apps/evenly` only if the site or a demo deploys it; the design does not say it does. Leave out until layer 7.
8. `docs/TESTING.md` and `tasks/COVERAGE.md` name household in tables; add an evenly row when the ledger entries land.

## Needs no edit (discovered)

- `tooling/turbo.mjs` (`workspaceDirs`): lists every directory under `packages`, `apps` and `examples` with a `package.json`; `apps/evenly` is in. Its `build`, `check` and `test` scripts are what `pnpm check`, `pnpm test` and `pnpm build` run through turbo.
- `tooling/structure-lint.mjs` (`appTests`): walks every `apps/*` test file for S0015; `apps/evenly/test` is in.
- `tooling/evidence.mjs`: units are `apps/<name>` directories with test files; `apps/evenly` is a unit.
- `pnpm-workspace.yaml`: `apps/*` already matches.

## Check before turning it on

- `apps/evenly` needs `fast-check` and `z3-solver` in devDependencies (already there); `pnpm install --frozen-lockfile` must pass, so commit `pnpm-lock.yaml` with the lane.
- `pnpm check` at the root must be run once with evenly present: biome and the voice lint (V0003) scan its `modules`.
- Verified here, in `apps/evenly`: `keel check` ok (46 files), `keel test` ok (12 tests), `keel build` ok (5 artifacts).
