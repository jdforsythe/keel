# Task 0445: keyed rows (RFC 0090) and no-decision backlog items, batch 2

**Spec:** k.component, k.runtime, k.check, k.scaffold, k.topology, k.head · **Principles:** 1, 2, 5 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 (orchestrator, for the user to confirm or reverse; the user said to decide and keep moving) RFC 0090 is accepted with: Q1 yes, a keyed row keeps its nodes and a top-level read of the item does not re-render it; Q2 a kernel check rule, E1405, an error with a fix (WORKFLOW RFC default 6: enforcement over documentation); Q3 the hand-built `For` keeps its present behavior.
- D3 E1405 is specified in k.component Shape beside E1401; lane A owns the compiler rule files, lane C owns only `packages/compiler/test/clientBuild.test.ts` in the compiler.
- D4 (orchestrator) a `PORT` that cannot be bound is E1560 (the environment failing at startup), not a new code; k.topology Build says so (the section is at its 1,500-token limit, so the listening line is held by the server test only). The server prints `ok listening on port N` once listening. `keel build` counts every artifact it is responsible for, written or unchanged (k.cli is silent and at its token limit: the cli test holds it).
- D5 (orchestrator) the golden-1 verification line is met by the runtime-dom conformance file (element identity and `document.activeElement` across a refresh, an insert and a removal) and a golden-1 test that a toggle changes one checked state in an otherwise identical a11y tree; an app-level focus assertion needs a k.testing change (backlog 0446, an RFC), not taken in this batch. No browser pass was run.
- D2 wave 1 lanes, disjoint packages: (A) runtime-dom, reactive, ui, check: RFC 0090; (B) scaffold: 0437; (C) compiler, cli, server `start`: 0444, 0398, 0399, 0379 message; (F) router: 0433. Wave 2 after A and C land: 0409, 0431, 0440 (check, compiler), 0443 (tests locate the repo from the mutation sandbox), 0389.

## Steps
- [x] 1 RFC 0090 accepted, ADR-0113, k.component text (Control flow sentence, E1405 in Shape, two Conformance clauses; E1405 in k.check's fix list), conformance files (runtime-dom `for-keyed-rows-0090`, check `E1405-top-level-prop-read`, E1405 in `fixtures-by-code.ts` and `fix-diffs.test.ts`): committed bebbef9 (wip, tests red until lane A lands). The runtime-dom tests drive the `list` op from `@keel/runtime-dom/ops`.
- [ ] 2 wave 1 lanes: B (scaffold 0437), C (0444, 0398, 0399, 0379), F (router 0433) running; A (RFC 0090 implementation, from the held patches in `tasks/0432-friction-batch1/`) running
- [ ] 3 wave 2 lanes
- [ ] 4 reviewer and red-team; findings to the backlog
- [ ] 5 ledger, budgets, mutation for changed packages, backlog, handoff, push

- lane B reported (0437): `opProject.ts` writes `.gitignore` for every `project` run, test in `test/project-brand.test.ts`, scaffold tests 220 pass; budget bytes not read (measure at step 5); proposed k.scaffold clause: "`project` writes a `.gitignore` listing `node_modules`, `dist`, `.keel-dev/` and `.keel/sessions/`, and not `.keel/`" (not added yet). Changeset: scaffold patch.

- lane F reported (0433): `manifest` infers each entry's loader output and types `title`'s `data` from it (`types/RouteTitles.ts` new, `RouteDef<P>`), type tests in `test/titleData.types.test.ts`, router 272 pass, no bytes moved; golden-1 titles read `p.data` directly. Proposed k.head sentence: "A path route's `title` receives the route component's props with `data` typed as the value of its loader's `output` schema; a route without a loader receives `RouteProps`." (not added yet). Follow-up to file: `title`'s `params` and `search` stay `unknown`. Changeset: router patch.
- seen in passing (other lanes, check at collection): structure-lint on `packages/cli/src/internal/deployBuildWrites.ts` (two exports, lane C); budgets `@keel/check` 42,506 B of 42,496 B and `@keel/server` 17,417 B of 17,408 B.

- lane C reported (0444, 0398, 0399, 0379): compiler test spies `process.cwd` for the no-root case; cli `deployArtifactCount` (moved to its own file by the orchestrator for S0001); server `start.ts` listening line and E1560 busy port, test `test/startListen.test.ts`; W1557 names an https `KEEL_ORIGIN`. cli 557, server 475, compiler 938 pass. Server 17,417 B of 17,408 B: re-base at step 5 (D7 rule). Spec sentences added by the orchestrator: k.head (title `data` typed from `output`), k.scaffold (`.gitignore`), k.topology (D4). Changesets: cli patch, server patch.

- 0389 done: `packages/server/src/internal/stripHop.ts` is the one header list for both directions; a forwarded response drops hop-by-hop, `connection`-named, `content-encoding` and `content-length` headers; `test/forwardResponseHeaders.test.ts`; server 477 pass, 17,490 B (re-base at step 5). k.topology sentence corrected and the section trimmed to stay at 1,500 tokens. Changeset: server patch.

- lane A reported (RFC 0090), committed f6ccd57: both held patches applied unchanged; `for-keyed-rows-0090` 8/8; `@keel/ui` binds every prop given as a getter (`as` and `level` choose the tag and stay read-once), `test/keptRow.test.ts`; E1405 in `compiler/src/internal/rules/ruleTopLevelPropRead.ts`, one hit in the repo (golden-1 `ListPage.tsx`, fixed with the rule's fix). Bytes: runtime-dom 4,128, ui 3,453, compiler 28,153, check 42,489. Rule limits filed 0447. k.component E1405 sentence made exact.
- OPEN: lane F's manifest typing (530af9c) turned E1510/E1508 into E1751 in 9 check tests; sent back to the router agent.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] golden-1 list page: focus stays on the toggled control (test)

## Next action
Collect the router agent's E1510/E1508 fix and commit it. Then wave 2 rest (0409, 0431, 0440, 0443), then steps 4 and 5.
