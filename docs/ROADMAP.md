# Roadmap

Gates, not dates. A gate passes when its criteria are green in CI.

| Gate | Scope | Exit criteria |
| --- | --- | --- |
| G0 Factory | task 0001 | CI green on empty workspace; commands and hooks work; one eval runs end to end; output budgets enforced |
| G1 Kernel renders (passed 2026-11-06: evals/results/2026-11-06-golden-1-claude-sonnet-5-5.json, converged iter=1, $1.32) | schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, ctx | Agent builds golden app 1 (client-only) to ledger green from spec + skill; conformance green; eval baseline recorded |
| G2 Kernel full stack (passed 2026-11-06: apps/golden-1 api module + apps/inspector; tooling/smoke/persist.mjs, inspector.mjs) | thin server, thin services, inspector viewer | Golden app 1 has a real API; inspector viewer built in Keel |
| G3 Kernel freeze (criteria met 2026-11-07 then re-audited by the ledger gate rfc:0049: 13/18 conformance-covered (backlog 0138 for the five), 6/6 extension points via std-* wave 0, golden-1 and golden-2 agent-built, evals/results/2026-11-07-*; kernel provisionally frozen by user decision 2026-11-09: every change goes through an RFC, the `frozen` status flip waits until the S stages have exercised the kernel; tasks/0034-freeze/PLAN.md D6, D8) | all kernel sections | Every section conformance-covered; each extension point used by >= 1 stdlib module; two golden apps; evals improving |
| S1 Sessions (passed 2026-11-09: nightly run 42711189372 filed issue 1, closed by fba4633) | capture, ingest, replay, minimize, to-test, GitHub Action | Fix loop closes real bugs in Keel's own ingest service |
| S2 Values (passed 2026-11-10: evals/results/2026-11-10-golden-2-none.json) | money, temporal, text, i18n, message sets | Golden app 2 ships prices and dates in 3 locales |
| S3 Server depth | jobs, schedules, live loaders, split topology, generated Docker/CI, compat check | Topology split without source changes |
| S4 Realtime | live resources, channels, offline, conflicts | Multi-user replay under simulation finds injected race |
| S5 Correctness | statecharts, model checking, simulator, mutation in ledger | Every rung populated by real machinery |
| S6 Compliance | a11y pack, CSP, PII redaction, evidence bundle | External a11y audit and pen test on golden app 3 |
| S7 UI modules | headless components, tables | Golden app 2 catalog page: all widgets and a paged table, zero a11y violations in three locales; an agent builds a table page from the public docs |
| S8 Reach | db, workflows, Capacitor, Tauri, verification | Golden app 1 survives SIGKILL on std-db with a byte-equal stored row; a workflow resumes mid-step; Tauri and Android artifacts built in CI with a session replayed in the shell; Z3 proofs recorded as proven |
| P1 Go public | the kernel `frozen` flip; SVG system diagrams (kernel, stdlib, apps, the compile and check pipeline, resume) on brand; human explanations of what happens and why; agent documentation (skills, spec retrieval, ledger) checked by an eval; public site; launch checklist | A newcomer explains Keel's parts from the diagrams alone; an agent builds a golden app from the public docs; external a11y and security review of the site |

verified: 799b0d37c8ae086faa4a15c09270965dc0a50f80
