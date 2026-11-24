# RFC 0221: k.scaffold, std.sessions and std.postgres split so every section fits 3,100 tokens

Status: accepted (ADR-0243), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.scaffold, std.sessions, std.postgres, the map, the std index; adds k.scaffold-service, std.sessions-served, std.postgres-changes. Changes no behaviour.

## For the operator
- Seams: k.scaffold gives its service operation (Service, its edits, E1358, eight clauses) to k.scaffold-service, as it gave the shell operation to k.scaffold-shell. std.sessions gives replay and `to-test` of a page a `node` deployable serves (Served pages, the `node` `to-test` file, three clauses) to std.sessions-served. std.postgres gives `changed`, its wire form and `follow` (three API items, E2460, six clauses) to std.postgres-changes.
- std.postgres is split as well: at 3,104 tokens it is over 3,100.
- The map drops its sentence restating the budgets (`tooling/budgets.json` holds them, and it read 1,500 and 3,400); that keeps it under 1,500 with the new row, with no re-base.
- `docs.map` (the `keel docs` index) is re-based from 1,520 to 1,560 for the three new rows.
- The map plus the largest section is 1,497 + 3,004 (k.shell) = 4,501, over principle 8's 4,000. Holding that sum needs sections of at most about 2,500 tokens or a smaller map; not done here.

## Problem
Principle 8 says no task needs more than 4k tokens of spec in context. `spec.section` and `docs.section` were re-based to 3,400 for k.scaffold (3,387 tokens). std.sessions (3,171) and std.postgres (3,104) were also above 3,100.

## Proposal
Split each along a seam that is already a unit of its text, moving prose and Conformance bullets word for word.

| section | before | after | new section | size |
| --- | --- | --- | --- | --- |
| k.scaffold | 3,387 | 2,173 | k.scaffold-service | 1,362 |
| std.sessions | 3,171 | 2,326 | std.sessions-served | 936 |
| std.postgres | 3,104 | 2,467 | std.postgres-changes | 732 |

Each source keeps a one-line pointer where the text left (Generators' `service` line, `**Served pages.**`, the `node` `to-test` item, the API item for `changed` and `follow`, the E1358 and E2460 entries in Rules). Each new section opens with one sentence naming its source section. `spec.section` and `docs.section` return to 3,100; the largest section is then k.shell at 3,004.

### Status of a half
A new section carries the status its clauses had: all three sources were `conformance-covered`, and every moved clause has a conformance test, so each half is `conformance-covered`. The ledger keys clauses `section#n` from the `// Spec:` headers; until the headers below cite the new ids, the moved clauses read `none` under the new ids and E1707 can fire for them. The ledger regenerates on the main line after the headers move; it is not edited by hand.

## Alternatives
- Raise the budgets so map plus largest section is 4,000: the operator kept principle 8 and the 3,100 section budget (D134).
- Split k.scaffold's Codemods or Rules instead: they are short, and the service operation is the one self-contained unit, as the shell was.
- Re-base `spec.map` to fit the new row: the map's budget sentence duplicated `budgets.json` and was already stale.

## Spec diff
Applied in this commit. Text moved unchanged; renumbered:

| old | new |
| --- | --- |
| k.scaffold#16 to #20 | k.scaffold-service#1 to #5 |
| k.scaffold#21, #22, #23 | k.scaffold#16, #17, #18 |
| k.scaffold#24, #25, #26 | k.scaffold-service#6, #7, #8 |
| std.sessions#16, #17, #18 | std.sessions-served#1, #2, #3 |
| std.sessions#19 | std.sessions#16 |
| std.postgres#18 to #23 | std.postgres-changes#1 to #6 |

Every other clause keeps its number. Also: `spec/00-map.md` (row k.scaffold-service; E135x and E245x owners), `spec/std/README.md` (two rows; std.postgres's line), `tooling/docs-owners.json`, `docs/freeze-review.md`, k.openapi and std.channels cross-references, the keel-testing and keel-data skills, three package READMEs' Spec lines.

## Conformance diff
No new clause. The conformance writer re-points the `// Spec:` headers (section id; the quoted text is unchanged) in:
- `packages/scaffold/conformance/`: `service-base-node`, `service-base-client`, `E1358-service-needs-reason`, `service-base-e1052`, `service-base-e1353`, `service-name`, `cli-service-flags` (Conformance, Service and Rules quotes to k.scaffold-service).
- `packages/std-sessions/conformance/`: `to-test-served`, `replay-served`, `replay-served-user` (Served pages, the `node` `to-test` item and the clauses to std.sessions-served; `to-test-served`'s other quotes stay std.sessions).
- `packages/std-postgres/conformance/`: `changed-after-commit-0192`, `follow-key-filter-0192`, `follow-cross-process-0192`, `changed-e2460-0192`, `listen-application-name-0194`, `follow-lost-0192` (Conformance, API, wire form and Rules quotes to std.postgres-changes; Modes quotes stay std.postgres).

For a builder, code comments citing a moved part: `packages/scaffold/src/internal/opService.ts`, `src/templates/apiSchemaTs.ts`, `src/templates/apiServerTs.ts`, `test/connectOrigin.property.test.ts` ("k.scaffold Service"); `packages/std-postgres/src/server/internal/payloadOf.ts` ("std.postgres Wire form"), `src/server/ChangedChannel.ts`, `src/server/FollowEvent.ts`, `src/tools/changedParams.ts`.

## Migration
None.

## Token impact
Largest section 3,387 to 3,004; map 1,478 to 1,497 (budget 1,500); `docs.map` 1,555 (budget 1,560).
