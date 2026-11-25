# Roadmap

Gates, not dates. A gate passes when its criteria are green in CI.

| Gate | Scope | Exit criteria |
| --- | --- | --- |
| G0 Factory | task 0001 | CI green on empty workspace; commands and hooks work; one eval runs end to end; output budgets enforced |
| G1 Kernel renders (passed 2026-11-06: evals/results/2026-11-06-golden-1-claude-sonnet-5-5.json, converged iter=1, $1.32) | schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, ctx | Agent builds golden app 1 (client-only) to ledger green from spec + skill; conformance green; eval baseline recorded |
| G2 Kernel full stack (passed 2026-11-06: apps/golden-1 api module + apps/inspector; tooling/smoke/persist.mjs, inspector.mjs) | thin server, thin services, inspector viewer | Golden app 1 has a real API; inspector viewer built in Keel |
| G3 Kernel freeze (criteria met 2026-11-07; kernel provisionally frozen by user decision 2026-11-09: every change goes through an RFC with an ADR, and the `frozen` status flip waits until the S stages have exercised the kernel; 74 of 78 kernel sections are conformance-covered, k.boundary, k.leave and k.scaffold are implemented and k.parity is proposed: docs/freeze-review.md, tasks/0034-freeze/PLAN.md) | all kernel sections | Every section conformance-covered; each extension point used by >= 1 stdlib module; two golden apps; evals improving |
| S1 Sessions (passed 2026-11-09: nightly run 42711189372 filed issue 1, closed by fba4633) | capture, ingest, replay, minimize, to-test, GitHub Action | Fix loop closes real bugs in Keel's own ingest service |
| S2 Values (passed 2026-11-10: evals/results/2026-11-10-golden-2-none.json) | money, temporal, text, i18n, message sets | Golden app 2 ships prices and dates in 3 locales |
| S3 Server depth (passed 2026-11-11: evals/results/2026-11-11-golden-1-api-none.json) | jobs, schedules, live loaders, split topology, generated Docker/CI, compat check | Topology split without source changes |
| S4 Realtime (passed 2026-11-12: evals/results/2026-11-12-golden-1-api-none.json) | live resources, channels, offline, conflicts | Multi-user replay under simulation finds injected race |
| S5 Correctness (passed 2026-11-13: evals/results/2026-11-13-golden-1-api-none.json) | statecharts, model checking, simulator, mutation in ledger | Every rung populated by real machinery |
| S6 Compliance (provisionally closed 2026-11-19: the internal evidence is in place; the external a11y audit and pen test are P1 gates, and S6 reopens if either fails) | a11y pack, CSP, PII redaction, evidence bundle | External a11y audit and pen test on golden app 3 |
| S7 UI modules (passed 2026-11-18: evals/results/2026-11-18-golden-2-catalog-none.json and evals/results/2026-11-18-golden-2-catalog-claude-sonnet-5-5.json) | headless components, tables | Golden app 2 catalog page: all widgets and a paged table, zero a11y violations in three locales; an agent builds a table page from the public docs |
| S8 Reach (passed 2026-11-18: tasks/0338-s8-reach/PLAN.md item -13; CI run 44291460485; evals/results/2026-11-18-golden-1-api-none.json) | db, workflows, Capacitor, Tauri, verification | Golden app 1 survives SIGKILL on std-db with a byte-equal stored row; a workflow resumes mid-step; Tauri and Android artifacts built in CI with a session replayed in the shell; Z3 proofs recorded as proven |
| P1 Go public | the kernel `frozen` flip; SVG system diagrams (kernel, stdlib, apps, the compile and check pipeline, resume) on brand; human explanations of what happens and why; agent documentation (skills, spec retrieval, ledger) checked by an eval; public site; launch checklist | A newcomer explains Keel's parts from the diagrams alone; an agent builds a golden app from the public docs; external a11y and security review of the site |

**S8 state.** Built: `@keel/std-db` (SQLite, Postgres), `@keel/std-workflows`, `@keel/std-capacitor`, `@keel/std-tauri`, `@keel/testing/prove`, `read` and `commit` on `ctx.storage`, `commitStores`, `keel build --target`, E1112. Each exit clause is shown: built golden-1 keeps a byte-equal stored row across a SIGKILL on SQLite and on Postgres 17, a list removal resumes after a SIGKILL inside a step and ends once, CI builds golden-1's `web` as a Tauri Linux binary and an Android debug APK, a recorded session replayed in the Linux Tauri shell gives the server state its sim replay gives, and the board's six transactions are `proven`. Not shown:
- A physical Android or iOS device, a release or signed build, a store upload or a Windows Tauri build.
- A two-user session replayed in a shell: the shell replays one user's half of the S4 race.
- A kill inside a store save, or power loss.
- A recorded session replayed in an Android emulator.
- A Postgres pool wait past the 10 s connect timeout.

subject: tasks/STAGES.md spec/00-map.md
verified: 5548044331e7dc4ebccbe43c4e7dc7989514e7f6
