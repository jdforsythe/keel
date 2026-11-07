# RFC 0038: Conformance completion k.ctx, k.testing: real `keel test` and `keel ledger` runs

Status: accepted (ADR-0027)

## Problem
Backlog 0107. Two remainders block the flips. rfc:0032 left k.ctx "`keel test` runs under sim by default" asserted only for the env contract: no test ran a real `keel test` and saw a sim ctx. rfc:0036 left k.testing clauses 8 and 9 partial. Their tests call the `ledger()` and `ledgerDiff()` engines, which proxies a CLI run, because testing may not import cli. Two smaller defects:
- The k.ctx Conformance paragraph was prose, so `keel ledger` (which counts `- ` bullets) gave k.ctx no clause items.
- The ledger's unsafe count missed `unsafe<T>(...)`, the form with explicit type arguments.

## Proposal
1. cli conformance runs the real binary (`node packages/cli/src/bin.ts`) as a child process. It runs over temp projects under the OS tmpdir, whose `node_modules` links `@keel/*` and the toolchain. The child env drops `VITEST*` and every `KEEL_*`, so only `keel` can set them.
2. k.ctx Conformance becomes one bullet per sentence (6 clauses). The last clause states what a test observes: "a ctx created with no options inside a test is sim, with seed 0" (the default seed in packages/ctx/README.md).
3. `buildLedger` counts `unsafe<T>(...)` calls. `function unsafe<T>(` is still not counted. The repository count is unchanged (0 such calls).

Clause to test (strict verdict, task 0034 D1; D2 allows another package's conformance dir):

| section | # | clause | test | verdict |
| --- | --- | --- | --- | --- |
| k.ctx | 1 | sim `after` resolves at the deadline, abort rejects | `ctx/clock-after` | covered |
| k.ctx | 2 | sim `random.id` deterministic, parses with `s.id` | `ctx/random-id` | covered |
| k.ctx | 3 | register before or after ctx, every mode | `ctx/register-order` | covered |
| k.ctx | 4 | sim deterministic by seed | `ctx/sim-determinism`, `ctx/sim-clock` | covered |
| k.ctx | 5 | three implementations per capability | `ctx/three-implementations` | covered |
| k.ctx | 6 | `keel test` runs under sim, seed 0 | `cli/test-sim-ctx`: `keel test` on a temp project whose test records a registered probe's mode, clock, net and uuids from `createCtx({})`; they are sim, equal a `seed: 0` sim ctx, and `KEEL_TEST=1`. Control: plain vitest on the same project sees `real` and fails. Env half: `ctx/keel-test-env-sim` | covered |
| k.testing | 1-7 | | as rfc:0036 | covered |
| k.testing | 8 | example -> probabilistic | `cli/ledger-rung-promotion-cli`: `keel test` passes (1, then 2 tests), `keel ledger` gives `example`, then `probabilistic` with evidence `property runs 100 seed 1337`; 99 runs or no seed stays `example`. Engine: `testing/ledger-real-runs`, `ledger-rung-promotion` | covered |
| k.testing | 9 | lowered rung -> `--diff` E1706 | `cli/ledger-diff-e1706-cli`: `.keel/ledger.json` is written by `keel ledger --write` while the export is `probabilistic`. Removing the property gives E1706 `probabilistic -> example`, exit 1. One `unsafe(...)` or `unsafe<T>(...)` gives E1706 `unsafe count up 0 -> 1`. Unchanged or restored gives ok, exit 0 | covered |

Rules codes (D3, not blocking): E1601 and E1701-E1706 have fixtures. W1706 is asserted only in `cli/test/mutation-cmd-ledger`. Backlog 0109 holds the destructured `container` gap in E1701.

## Alternatives
- Spawn `keel test` from ctx or testing conformance: deps order puts cli last (S0003; ADR-0021 assigns CLI halves to cli conformance).
- Call `run()` in-process: `keel test` would set `KEEL_TEST` in the test runner's own process, and the control run could not be separated.
- Hand-write the committed ledger file: the stored file would then not be what `keel ledger --write` emits.
- Keep the k.ctx prose: its clauses stay invisible to the ledger.

## Spec diff
- k.ctx: status `conformance-covered`. Conformance is split into 6 bullets, and the last bullet adds the observable (no options, sim, seed 0).
- k.testing: status `conformance-covered`. No clause text change: the testing headers quote it exactly.
- spec/00-map.md rows k.ctx and k.testing: `conformance-covered`.

## Conformance diff
Added only, all in packages/cli/conformance: `test-sim-ctx.test.ts`, `ledger-rung-promotion-cli.test.ts`, `ledger-diff-e1706-cli.test.ts`, and the support files `test-sim-project.ts` and `ledger-fixture.ts`. No existing assertion changed.

Ledger: k.ctx#1-6 are new items. #6 is held by the cli test. #1-5 stay `none` until the ctx suite's headers use `// Spec: k.ctx, clause "..."`. That is a header-only follow-up, and none of these items is a regression.

## Migration
None. `keel ledger` reports one more unsafe use for each `unsafe<T>(...)` call in a project.

## Token impact
k.ctx is about 15 tokens longer (bullets and the seed phrase). k.testing is unchanged.
