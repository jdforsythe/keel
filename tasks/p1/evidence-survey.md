# Evidence survey

What the ledger and the evidence data say per package, read on 2026-11-25 from `tooling/ledger/ledger.json` and `tooling/ledger/evidence.json`, and the worklists that follow from it. The targets are in `tasks/p1/TODO.md`. The per-package figures themselves are in `evidence.json`; this file holds the findings and the order of work.

## Findings

- **Mutation.** Every package is at or above its gate. Against the targets: of tier 1, router (90.2) and schema (90.0) are there; store 89.9, std-sessions 89.0, std-postgres 87.9, reactive 86.5, forms 85.6, ctx 84.0, std-tokens 82.1, server 81.4, std-offline 78.5, std-db 78.0, std-conflicts 76.5 and check 73.1 are not. Of tier 2, cli 71.5, compiler 72.3, std-tables 72.4, ui 72.9, std-workflows 74.1, std-statecharts 75.2, testing 78.3, scaffold 78.7, std-headless 79.0, std-channels 79.4 and runtime-dom 79.9 are under 80. Survivors are justified in two packages only (router 34, std-postgres 5).
- **Where the survivors are.** Three packages hold most of them: check (4,142 survived, 758 not covered), compiler (3,453 and 1,015), cli (2,459 and 1,021); then testing (748 and 516), scaffold, server.
- **A vacuous 100.** std-geo and std-health score 100 with four or five mutated files and no survivors, at 78.6% lines and 25% branches, and 75% lines: the score says nothing there.
- **Coverage is a week old.** Every line and branch figure was measured at e9a667f on 2026-11-18; household and std-postgres are not measured. `tasks/COVERAGE.md` is older still (590 exports, 196 stale claims).
- **Exports with no evidence: 166, of which 135 are in `apps/household`** and 31 in packages (std-sessions 4, std-jobs 2, std-offline 2, one each in ctx, scaffold, std-conflicts, std-live, std-report, std-tables, std-temporal, std-text, std-timings, std-workflows). All are runtime values; the ledger does not list types. In household they are schemas (58), server loaders and actions (48), components (14), contracts (8) and helpers.
- **A11y items with no evidence: 608 of 940 distinct** (the ledger lists 1,120 because four route ids exist in more than one project and the item key carries no project). An item is one route against one WCAG criterion. Twenty-seven of the 47 route ids have no evidence for any criterion: shells, frames and routes no test renders. Four criteria (1.3.2, 1.4.3, 2.4.3, 4.1.2) have evidence on three routes only, all in golden-2; why is not yet known.
- **Clauses.** 1,348: 1,055 at `example`, 241 `probabilistic`, 6 `exhaustive`, 44 `proven`, 2 at `none` (k.parity). check's 26 clauses, scaffold's 36, server's 96 of 99, runtime-dom's 34 of 36 and std-channels' 33 sit at `example`.
- **Property tests.** Every package has some; `apps/sessions` has none.

## Worklists

### Mutation, by file (survived plus not covered; the file's own score)
1. compiler `vite.ts` 753 (55.0)
2. cli `review/reviewCommand.ts` 358 (31.0)
3. compiler `internal/handlerUses.ts` 350 (40.7)
4. compiler `globals/globalRefs.ts` 326 (44.1)
5. testing `internal/documentRoute.ts` 278 (0: no test covers it)
6. cli `review/codeEscapes.ts` 250 (66.4)
7. compiler `internal/collectStyles.ts` 209 (76.5)
8. compiler `internal/lowerFile.ts` 208 (86.4)
9. check `rules/noEagerElement.ts` 200 (66.0)
10. compiler `internal/sourceForm.ts` 186 (57.4)
11. check `internal/schemaMarks.ts` 168 (58.2)
12. compiler `internal/rules/ruleTopLevelPropRead.ts` 162 (61.5)
13. compiler `routeLiterals.ts` 148 (78.0)
14. std-tables `DataTable.ts` 125 (68.3)
15. cli `internal/testFacts.ts` 117 (84.4)
16. compiler `hosting/foreignRoutesDiags.ts` 115 (5.0)
17. router `internal/createRouterWith.ts` 115 (81.3)
18. check `internal/compat/compatChecks.ts` 113 (64.2)
19. check `rules/pathParamsMatch.ts` 110 (43.3)
20. ui `css/compileStyles.ts` 108 (68.1)
21. check `rules/noAmbientCapability.ts` 105 (70.3)
22. cli `internal/shellTargets.ts` 103 (42.5)
23. check `internal/annotateProps.ts` 102 (10.5)
24. check `internal/chainStoreIds.ts` 101 (67.4)
25. check `rules/passwordField.ts` 99 (59.1)

### Order of the hardening lanes
1. check first: it is the gate, it is furthest from its target, and a rule that a mutant can break without a test noticing is a rule that can be wrong. Its mutation run must work before this starts (backlog 1102).
2. The tier 1 packages near their target (store, std-sessions, std-postgres, reactive, forms, ctx, std-tokens, server): each a short lane.
3. std-offline, std-db, std-conflicts: data paths under 80.
4. compiler and cli by the file list above; `review/` and `vite.ts` first.
5. The rest of tier 2, then tier 3; std-geo and std-health get tests for their uncovered branches before their score means anything.

Mutation runs are one at a time on this machine. A hardening lane writes its tests from the surviving mutants its package's report lists, and its mutation run is queued on the main line.

### Evidence outside mutation
- household: a test that renders each route, and evidence for its 135 exports.
- The routes with no a11y evidence in the examples, the inspector and `apps/sessions`; the four criteria that stay at `none`; the a11y item key made distinct per project.
- The 31 package exports with no evidence.
- Coverage measured again on the current head, household and std-postgres included, and `tasks/COVERAGE.md` regenerated.
