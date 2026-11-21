# Roadmap

Gates, not dates. A gate passes when its criteria are green in CI.

| Gate | Scope | Exit criteria |
| --- | --- | --- |
| G0 Factory | task 0001 | CI green on empty workspace; commands and hooks work; one eval runs end to end; output budgets enforced |
| G1 Kernel renders (passed 2026-11-06: evals/results/2026-11-06-golden-1-claude-sonnet-5-5.json, converged iter=1, $1.32) | schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, ctx | Agent builds golden app 1 (client-only) to ledger green from spec + skill; conformance green; eval baseline recorded |
| G2 Kernel full stack (passed 2026-11-06: apps/golden-1 api module + apps/inspector; tooling/smoke/persist.mjs, inspector.mjs) | thin server, thin services, inspector viewer | Golden app 1 has a real API; inspector viewer built in Keel |
| G3 Kernel freeze (criteria met 2026-11-07; kernel provisionally frozen by user decision 2026-11-09: every change goes through an RFC with an ADR, and the `frozen` status flip waits until the S stages have exercised the kernel; 54 of 56 kernel sections are conformance-covered, k.formats is implemented and k.shell is proposed: docs/freeze-review.md, tasks/0034-freeze/PLAN.md) | all kernel sections | Every section conformance-covered; each extension point used by >= 1 stdlib module; two golden apps; evals improving |
| S1 Sessions (passed 2026-11-09: nightly run 42711189372 filed issue 1, closed by fba4633) | capture, ingest, replay, minimize, to-test, GitHub Action | Fix loop closes real bugs in Keel's own ingest service |
| S2 Values (passed 2026-11-10: evals/results/2026-11-10-golden-2-none.json) | money, temporal, text, i18n, message sets | Golden app 2 ships prices and dates in 3 locales |
| S3 Server depth | jobs, schedules, live loaders, split topology, generated Docker/CI, compat check | Topology split without source changes |
| S4 Realtime (passed 2026-11-12: evals/results/2026-11-12-golden-1-api-none.json) | live resources, channels, offline, conflicts | Multi-user replay under simulation finds injected race |
| S5 Correctness | statecharts, model checking, simulator, mutation in ledger | Every rung populated by real machinery |
| S6 Compliance (provisionally closed 2026-11-19: the internal evidence is in place; the external a11y audit and pen test are P1 gates, and S6 reopens if either fails) | a11y pack, CSP, PII redaction, evidence bundle | External a11y audit and pen test on golden app 3 |
| S7 UI modules (passed 2026-11-18: evals/results/2026-11-18-golden-2-catalog-none.json and evals/results/2026-11-18-golden-2-catalog-claude-sonnet-5-5.json) | headless components, tables | Golden app 2 catalog page: all widgets and a paged table, zero a11y violations in three locales; an agent builds a table page from the public docs |
| S8 Reach (built; storage, workflow and proof parts met by the `golden-1-api` eval; Tauri on Linux and macOS, Android and iOS shells build in CI; a session replays in the Linux Tauri shell only) | db, workflows, Capacitor, Tauri, verification | Golden app 1 survives SIGKILL on std-db with a byte-equal stored row; a workflow resumes mid-step; Tauri and Android artifacts built in CI with a session replayed in the shell; Z3 proofs recorded as proven |
| P1 Go public | the kernel `frozen` flip; SVG system diagrams (kernel, stdlib, apps, the compile and check pipeline, resume) on brand; human explanations of what happens and why; agent documentation (skills, spec retrieval, ledger) checked by an eval; public site; launch checklist | A newcomer explains Keel's parts from the diagrams alone; an agent builds a golden app from the public docs; external a11y and security review of the site |

**S8 state.** Built: `@keel/std-db` (SQLite, Postgres), `@keel/std-workflows`, `@keel/std-capacitor`, `@keel/std-tauri`, `@keel/testing/prove`, `read` and `commit` on `ctx.storage`, `commitStores`, `keel build --target`, E1112. The root `pnpm check`, `pnpm test` and `pnpm build` are green and the ledger holds 55 `proven` items. The `golden-1-api` eval converges: golden-1 on SQLite keeps a byte-equal stored row across a SIGKILL, six board transactions are proven, and the planted proof and stored-data twins fail as planted. Not verified:
- Native shells beyond debug builds. CI builds golden-1 as a Tauri app on Linux and macOS, as a debug APK and as an unsigned iOS Simulator app; the Linux Tauri job replays a recorded session and drains the outbox after a kill, and the macOS and iOS jobs launch the app, read through the native client and keep a cookie across a kill and a reboot. No release or signed build and no Windows build has run, the APK has run on no device, and no session has replayed in a macOS or iOS shell (WKWebView has no WebDriver).
- Postgres under concurrency. The two-connection checks (advisory locks, read committed visibility, connection loss, TLS) ran on PGlite only; a real Postgres 17 service has not run them.
- A session replayed in a macOS or iOS shell.
The S8 exit criterion stays open until those three run: the storage, workflow and proof parts are met, the shell part is not.

verified: 4afc5913b0cc2041920660fce553519b20474b8c
