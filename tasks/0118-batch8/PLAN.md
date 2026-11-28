# Task 0118-0120 + 0182: batch 8

**Spec:** k.cli k.module (0118) · k.server k.module (0119) · k.component k.server k.scaffold (0120) · k.server k.ui (0182) · **Gate:** G3 (0119 feeds S1) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0118 (agent A done: keel check/build/MCP/LSP import each `@keel/std-*` in `deps` first; `check()` stays sync; E1159 for an unimportable dep) `keel check` imports the stdlib packages named in a module's `deps` before running rules so their rules (E2101) and `std` config schemas register (cli, check)
- [x] 0119 (agent A done: rfc:0066, ADR-0055; `.keel/std.json` `{[pkg]:{[moduleId]:config}}` always written and compared; `createApp({ std: '.keel/std.json' })`; `stdConfig(ctx, pkg, Config)` from `@keel/compiler/std/stdConfig`; E1158 at build and createApp, E1160 for a missing/malformed/edited artifact; budgets compiler 26 kB, server 14 kB (D7); gap 0189 filed) runtime path for `std` manifest config: a `.keel/std.json` artifact (or equivalent) built by the compiler and passed to `createApp`; std-sessions needs it (server, compiler)
- [x] 0120 (agent C done: rfc:0068, ADR-0057; isComponentFile shared by E1752/E1104 so `.ts` components export Props/uses; empty JSON body decodes as `{}` then 422 keel.fields per missing field; scaffold project writes under `<name>/`; resource unwraps a resolved Result; import-order documented in keel-api skill and slices; pass.ts and briefs grade the ledger; golden-1 brief matches the scaffold; golden-1-api `--runner none` converged=false only on five exports at rung none → 0190; undefined action → 0191) eval gaps: `.ts` api components may export `Props` (E1104/E1752 rule), empty JSON POST body is a specified 4xx, `keel scaffold project <name> --workspace` writes into `<name>/`, a resource reaches its error state without `Promise.reject`, routes.ts and *.server.ts import order documented or broken, briefs grade the ledger, golden-1 client brief scripts match the scaffold (spec, scaffold, server, evals)
- [x] 0182 (agent B done: rfc:0067, ADR-0056; a base element writes `data-k=""` when it has an event prop, a field, or a signal/computed in value/checked/disabled/style/child; server island rule unchanged; eager children cannot resume in place, documented, follow-up 0188; ui 3,104 B) a route component built only from `@keel/ui` elements is marked and resumed as an island (server, ui, compiler)

## Steps
1. [x] PLAN; three agents in parallel: A 0118 + 0119 (cli, check, compiler artifacts, server createApp/std config); B 0182 (server documentHtml/islandIn/dom, ui, compiler lowering); C 0120 (scaffold, evals briefs, spec k.component rule text, server jsonBody only, docs).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 432 items, 392 verified, 6 unsafe, 0 lowered, 0 uncovered`; k.server 1,498 tokens. Reviewer + red-team running.
3. [x] 0192/0193/0195/0196/0197/0198 fixed in-batch (exports read with node/import/default conditions; successes cached only; non-finite config E1158 after a JSON round trip; Vite dev imports deps and warns before rewriting std.json; one isComponentFile for E1104/E1752; ok/err carry Symbol.for("keel.result") and resource unwraps only those, Settled<T> exported); final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 434 items, 394 verified, 6 unsafe, 0 lowered, 0 uncovered`; one commit tagged rfc:0066 rfc:0067 rfc:0068; 0097 scaffold mutate started in the background after the push.

## Decisions
- D1: Ownership within packages/server: A owns createApp.ts, AppOptions, std config loading; B owns documentHtml, islandIn, dom/**; C owns jsonBody/body parsing and its status mapping. Within packages/compiler: A owns artifacts (std.json, artifactHashes, vite, buildRoutes); B owns lowering. Shared spec files edited on owned lines only, re-read before saving.
- D2: RFC numbers reserved: 0066 (A, std config runtime), 0067 (B, ui-only island roots), 0068 (C, only if the empty-body status or Props-in-.ts rule needs a clause).

- D3: reviewer approved. Red-team batch 8 filed 0192-0198; in-batch fixes: 0192 (resolve/import mismatch), 0193 (failure cache), 0195 (non-finite config), 0196 (Vite dev rewrite drops E1158) agent A; 0197 (component-file definition shared and narrowed), 0198 (resource unwraps only branded keel Results, typing restored) agent C. 0194 (LSP/MCP import workspace std packages without a trust prompt) is a human decision: the `@keel/std-*` name gate and the trust level are recorded in THREAT-MODEL and RFC 0066; the line stays open.

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro; golden-1-api `--runner none` fails only on five exports at rung none (0190) is a failing-then-passing test; `pnpm eval` golden-1-api converges or the remaining gap is a backlog line

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1496 files` · `ok budgets 46 measured` · `ok ledger --diff 434 items, 394 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 9: 0190, 0191, 0188, 0189, then S1 sessions 0091-0095; 0194 awaits a human decision; 0097 running.