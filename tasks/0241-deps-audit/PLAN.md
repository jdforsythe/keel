# Task 0241: dependency advisories (vitest 4, Stryker 10, audit workflow)

**Spec:** k.check Pipeline step 1 (rfc:0076, ADR-0065); k.cli `keel test` behavior unchanged · **Gate:** S1 leftovers · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-10)

## Deliverables
- [x] `pnpm audit` reports no advisory at any level (`No known vulnerabilities found`, also with `--prod`)
- [x] vitest ^4 (root, `@keel/cli`, `@keel/tooling`), `@stryker-mutator/core` and `vitest-runner` 10.x
- [x] a scheduled, non-blocking `pnpm audit --prod --audit-level=high` workflow, generated like the other workflows
- [x] one mutation run proves the Stryker 10 config: `ok mutate ctx score 76.8% (threshold 70%)`, run alone; `packages/scaffold/vitest.stryker.config.mjs` loads under vitest 4

## Steps
1. [x] Bump versions, `pnpm install`, fix config breaks (`vitest.workspace.ts`, reporter types, `startVitest`, the scaffold sequencer).
2. [x] Root `pnpm check`, `pnpm test`, `pnpm build`; `pnpm audit`.
3. [x] Overrides for any transitive leftover.
4. [x] Audit workflow through `tooling/generate.mjs`.
5. [x] One Stryker run alone (`packages/ctx` or the smallest), score at or above its threshold.
6. [x] Reviewer over the diff; commit; backlog line; handoff.

## Decisions
- D1: vitest goes to ^4 (4.1.12 carries every fix), as the backlog line planned. vitest 5 exists (5.1.0); a second major jump is not needed to clear the advisories and is left for its own line.
- D2: `vitest` stays under `dependencies` in `@keel/cli`: `keel test` calls `startVitest` at run time, so it is a real runtime dependency, and with 4.1.12 it carries no advisory. Moving it to a peer would make every app list vitest itself (a golden-app migration) for no gain.

- D3: vitest 4 has no `onFinished` reporter hook. Both reporters (`tooling/vitest-reporter.ts`, `keel test`) keep the `Vitest` instance from `onInit` and, in `onTestRunEnd`, hand `state.getFiles()` (the same task tree) to `testResults`, which is unchanged.
- D4 (kernel gap, rfc:0076, RFC defaults 1 and 3): the checker's type pass has no ambient `@types`; Node's types reached it only through vitest 2's own types, so with vitest 4 every node entry (`process.env`, `import.meta.dirname`) became E1751 under `keel check` (golden-1, golden-2 and apps/sessions; the `check.injected10` budget caught it at 672 of 600 tokens). The type pass now adds `@types/node` when it resolves from the project root (type references resolve from the root upward, never from the current directory) and nothing else. The apps with a node entry and the packages whose tests use Node names list `@types/node`; both scaffold `package.json` templates list it; the standalone template lists vitest ^4.1.12.
- D5: Node's declarations add about 0.3 s to each fresh TypeScript program (module-E1151 conformance: 556 ms without, 907 ms with). Apps paid this under vitest 2 already (their tests import vitest); in-memory checks in `@keel/check`, `@keel/scaffold` and `@keel/cli` tests pay it now. Those three packages run with `testTimeout` 15 s, and `tooling/turbo.mjs` runs test tasks four at a time (56 s for a forced full run, the same as ten at a time, which starved the type-check heavy tests past 5 s). A backlog line asks for the cost to be cut.
- D6: overrides `@stryker-mutator/core>minimatch ^11.0.1` and `typed-rest-client>qs ^6.16.1` live in `package.json` `pnpm.overrides`, which the pinned pnpm 9.12.0 reads (`pnpm-workspace.yaml` overrides are not read by 9.12.0: tried, the advisories came back). A newer pnpm launcher prints a warning on stderr that the field is ignored; the install it delegates to still applies it (`pnpm-lock.yaml` records both).
- D7: forced full runs after the change: green, green, one flake (`@keel/router` conformance/internal-subpath, a 200 ms dynamic import over 5 s on a busy machine), green. Not package specific; watch it.
- D8: `apps/sessions` reports 7 errors under `keel check` before and after this task (its `check` script runs `tsc` and biome only). Filed as a backlog line.
- D9: the ledger links a conformance test to its clause through the `// Spec: k.check, clause "..."` header; with it the ledger reads 484 items, 477 verified, 0 lowered, 0 uncovered. Backlog 0291-0294 filed.
- D10 (review): changes requested, then applied: a conformance case for a root that finds `@types/node` only in an ancestor directory; a run that ends without the vitest instance is a T0001 error in `keel test` and the repository reporter, never an empty green report; the `tooling/turbo.mjs` comment states the present. The reviewer's blocking item was the plan's unticked boxes, read before the mutation run was recorded.
- D11: not pushed. The red-team pass runs at the end of the S1 leftovers batch (WORKFLOW Batches), with 0219, 0237, 0248 and 0255.

## Verification
- [x] `pnpm check`, `pnpm test`, `pnpm build` green; ledger 0 lowered; unsafe 6 (`ok check 44 tasks` · `ok test 42 tasks` · `ok build 26 tasks` · `ok ledger --diff 484 items, 477 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`)
- [x] `pnpm audit` clean (`No known vulnerabilities found`)
- [x] mutation run on one package at threshold under Stryker 10 (ctx 76.8%)

## Next action
None for this task. Next work: `tasks/BACKLOG.md` S1 leftovers 0219, 0237 remainder, 0248, 0255; then the red-team pass over the batch (from 88e6479) and the push; then S2 per `tasks/PROGRAM.md`.
