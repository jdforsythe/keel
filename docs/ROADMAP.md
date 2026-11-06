# Roadmap

Gates, not dates. A gate passes when its criteria are green in CI.

| Gate | Scope | Exit criteria |
| --- | --- | --- |
| G0 Factory | task 0001 | CI green on empty workspace; commands and hooks work; one eval runs end to end; output budgets enforced |
| G1 Kernel renders | schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, ctx | Agent builds golden app 1 (client-only) to ledger green from spec + skill; conformance green; eval baseline recorded |
| G2 Kernel full stack | thin server, thin services, inspector viewer | Golden app 1 has a real API; inspector viewer built in Keel |
| G3 Kernel freeze | all kernel sections | Every section conformance-covered; each extension point used by >= 1 stdlib module; two golden apps; evals improving |
| S1 Sessions | capture, ingest, replay, minimize, to-test, GitHub Action | Fix loop closes real bugs in Keel's own ingest service |
| S2 Values | money, Temporal, text, i18n | Golden app 2 ships prices and dates in 3 locales |
| S3 Server depth | jobs, schedules, streams, split topology, generated Docker/CI, compat check | Topology split without source changes |
| S4 Realtime | live resources, channels, offline, conflicts | Multi-user replay under simulation finds injected race |
| S5 Correctness | statecharts, model checking, simulator, mutation in ledger | Every rung populated by real machinery |
| S6 Compliance | a11y pack, CSP, PII redaction, evidence bundle | External a11y audit and pen test on golden app 3 |
| S7 UI modules | headless components, tables | |
| S8 Reach | db, workflows, Capacitor, Tauri, verification | |
