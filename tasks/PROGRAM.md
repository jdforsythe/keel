# Program: S2-S8 as parallel lanes

One orchestrator, many agents. A lane is a set of packages no other lane touches during a batch. Kernel changes from any lane go to a single kernel agent per batch through an RFC (kernel provisionally frozen, tasks/0034-freeze/PLAN.md D8). Shared files are orchestrator-only: `spec/00-map.md` status lines, `tooling/budgets.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `docs/HANDOFF.md`. Mutation runs go alone (they hang under load).

## Shape of a stage
1. Design RFC (one opus agent, no code): contract, spec diff, conformance clauses, lane split. User accepts open questions.
2. Conformance first (conformance-writer per lane, skipped until implementation).
3. Implementation batch: one agent per lane, one kernel agent, all in parallel; reviewer + red-team at the end; in-batch regressions fixed before the push.
4. Golden-app proof named by the stage's exit criterion, run by an eval.

## Lanes by stage
| Stage | Lanes (packages) | Kernel touch expected | Exit proof |
| --- | --- | --- | --- |
| S1 Sessions | std-sessions (done), action + apps/sessions (0095) | none left | nightly loop closes a bug in apps/sessions |
| S2 Values | std-money (exists) · std-temporal · std-text · std-i18n; golden-2 lane | k.schema type registry, k.ui formatting hooks | golden-2 prices and dates in 3 locales (eval) |
| S3 Server depth | std-jobs · std-schedules · std-streams · topology split (server, compiler) · generated Docker/CI (cli, scaffold) · compat check (check) | k.server, k.module | split topology without source changes (eval) |
| S4 Realtime | std-live (resources) · std-channels · std-offline · std-conflicts | k.reactive, k.store, k.server | multi-user replay finds an injected race |
| S5 Correctness | std-statecharts · model checking (testing) · simulator (ctx, testing) · mutation in ledger (cli, tooling) | k.testing, k.ctx | every rung populated by real machinery |
| S6 Compliance | a11y pack (ui, testing) · CSP (server) · PII redaction (std-sessions, schema) · evidence bundle (cli) | k.ui, k.server | external a11y audit + pen test on golden app 3 |
| S7 UI modules | std-headless · std-tables | k.ui, k.component | |
| S8 Reach | std-db · std-workflows · Capacitor · Tauri · verification | k.store, k.ctx, k.server | |
| P1 Go public | diagrams · human docs · agent docs + eval · launch checklist · docs sweep (0229) | the `frozen` flip | newcomer explains Keel from the diagrams; agent builds a golden app from public docs |

Lanes within a stage run concurrently; stages run in order unless their lanes are disjoint and the user wants more parallelism (S2 and S3 share no packages and can overlap). Budget per batch: three to five implementation agents plus one kernel agent; more than that has produced stale-dir collisions and hung mutation runs on this machine.
