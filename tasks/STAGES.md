# Stage status

This file records how done each gate (G0 to G3, `docs/ROADMAP.md`) and each stage (S1 to S8 and P1, `tasks/PROGRAM.md` "Lanes by stage") is, so nobody has to re-derive it. Update the row and the section when a stage's status changes.

Each verdict comes from four sources, in this order: the exit criterion where it is defined (`tasks/PROGRAM.md` exit proof column, `docs/ROADMAP.md`, the stage's design RFC in `docs/rfc/`); the line in `docs/HANDOFF.md` or the stage task's `PLAN.md` that records the exit as met; the eval result under `evals/results/` that is the proof, read for its `converged` value; and the stage task's Verification checkbox. A stage is CLOSED only when a line records the exit as met. Where two lines disagree, the newer by date wins and both are cited. `docs/HANDOFF.md` lists its newest lines first.

Verdicts: CLOSED (exit met and recorded) · BUILT, EXIT NOT RECORDED · BUILT, EXIT WAITS ON SOMETHING EXTERNAL · OPEN · NOT STARTED.

Open backlog counts are unchecked lines in `tasks/BACKLOG.md` matched to a stage by section heading and by the package tail (`· std-offline · std.offline`), then corrected by hand where a section holds another stage's lines (the "Red team: S7 UI modules" section holds S8 shell, std-db and std-credentials lines 0607 to 0641). The stage-tracking lines 0230, 0311, 0312, 0337 and 0338 are left out of the counts. High or medium means the line says high, medium, low-medium or medium-low; only 13 of the 230 open lines carry any severity word, so most red-team lines count as low or unmarked. 86 open lines name only kernel packages and belong to no stage; three of them are high or medium: 0701 (high: no push or pull request CI run has passed since 2026-11-06), 0771 (medium: `dispose` on the shared `Ctx` lets any island cut page-wide `net` events), 0258 (medium: E1303 misses ordinary reducer shapes).

## Summary

| Stage | Verdict | Exit criterion | Evidence | Open: high or medium / low |
| --- | --- | --- | --- | --- |
| G0 Factory | CLOSED | CI green on empty workspace, one eval end to end | `tasks/0001-factory/PLAN.md` CLOSED, 2026-11-06 | kernel lines only |
| G1 Kernel renders | CLOSED | agent builds golden app 1 to ledger green | `docs/ROADMAP.md` "passed 2026-11-06"; `evals/results/2026-11-06-golden-1-claude-sonnet-5-5.json` converged true | kernel lines only |
| G2 Kernel full stack | CLOSED | golden app 1 has a real API; inspector in Keel | `docs/ROADMAP.md` "passed 2026-11-06" | kernel lines only |
| G3 Kernel freeze | BUILT, EXIT WAITS ON SOMETHING EXTERNAL | every section covered, then `frozen` | `docs/ROADMAP.md` "criteria met 2026-11-07" and "38 of 40"; `tasks/0034-freeze/PLAN.md` open | 0034, 0349 |
| S1 Sessions | CLOSED | nightly loop closes a bug in apps/sessions | `docs/HANDOFF.md` "S1 EXIT MET (2026-11-09" | 1 / 13 |
| S2 Values | CLOSED | golden-2 prices and dates in 3 locales | `docs/ROADMAP.md` "passed 2026-11-10"; `evals/results/2026-11-10-golden-2-none.json` converged true | 5 / 16 |
| S3 Server depth | CLOSED | split topology without source changes | `tasks/0309-s3-server-depth/PLAN.md` CLOSED 2026-11-11; `evals/results/2026-11-11-golden-1-api-none.json` converged true | 0 / 27 |
| S4 Realtime | CLOSED | multi-user replay finds an injected race | `docs/HANDOFF.md` "S4 EXIT MET"; `evals/results/2026-11-12-golden-1-api-none.json` converged true | 0 / 19 |
| S5 Correctness | CLOSED | every rung populated by real machinery | `docs/HANDOFF.md` "S5 CLOSED (2026-11-13" and "S5 EXIT MET"; `evals/results/2026-11-13-golden-1-api-none.json` converged true | 0 / 6 |
| S6 Compliance | BUILT, EXIT WAITS ON SOMETHING EXTERNAL | external a11y audit and pen test on golden app 3 | `docs/HANDOFF.md` "EXIT PROOF OPEN, all the user's" (2026-11-13) | 0 / 19 |
| S7 UI modules | BUILT, EXIT WAITS ON SOMETHING EXTERNAL | catalog page passes the a11y pack; an agent builds it | `evals/results/2026-11-18-golden-2-catalog-none.json` converged true; agent build not run | 0 / 7 |
| S8 Reach | CLOSED | SIGKILL survival, workflow resume, shells in CI, proofs | `tasks/0338-s8-reach/PLAN.md` item -13, CLOSED 2026-11-18: CI run 44291460485 (`shell-tauri` replay and outbox session), `built-smokes`, `postgres`, `shell-android`; `evals/results/2026-11-18-golden-1-api-none.json` converged true; limits: restart eval's Postgres branch not in CI (0823), one-user replay (0825), no iOS, device, signing or Windows Tauri (0810, 0820, 0824), cookie lifetime (0811) |
| P1 Go public | NOT STARTED | newcomer explains Keel from the diagrams; agent builds a golden app from public docs | no task directory | 0 / 6 |

## G0 Factory

1. Exit criterion, `docs/ROADMAP.md`: "CI green on empty workspace; commands and hooks work; one eval runs end to end; output budgets enforced".
2. Met. `tasks/0001-factory/PLAN.md` ends "CLOSED. Remaining: CI has not run remotely (no push yet)." and ticks all four Verification boxes; git dates the plan 2026-11-06. The ROADMAP row carries no "passed" note. The CI part was proven locally only: backlog 0701 (high) says no push or pull request CI run has passed among the 27 the repository lists.
3. Built: the workspace, `tooling/`, `.claude/`, `evals/run.ts`.
4. Open: 0701 is the line that matters; it waits on the user's decision on CI cost.
5. Verdict: CLOSED, with the remote CI caveat above.

## G1 Kernel renders

1. Exit criterion, `docs/ROADMAP.md`: "Agent builds golden app 1 (client-only) to ledger green from spec + skill; conformance green; eval baseline recorded".
2. Met. `docs/ROADMAP.md` reads "passed 2026-11-06: evals/results/2026-11-06-golden-1-claude-sonnet-5-5.json, converged iter=1"; that file holds `converged: true`. `tasks/0027-golden-app/PLAN.md` leaves "Baseline results committed for two models; `unsafe=0`" unticked. The latest run of the same task, `evals/results/2026-11-17-golden-1-none.json`, holds `converged: false`: backlog 0429 says its `pass.ts` expects client-only files the app no longer has.
3. Built: the 13 kernel packages the ROADMAP row names, all under `packages/`, and `apps/golden-1`.
4. Open: 0429 (the `golden-1` eval task is stale).
5. Verdict: CLOSED.

## G2 Kernel full stack

1. Exit criterion, `docs/ROADMAP.md`: "Golden app 1 has a real API; inspector viewer built in Keel".
2. Met. `docs/ROADMAP.md` reads "passed 2026-11-06: apps/golden-1 api module + apps/inspector; tooling/smoke/persist.mjs, inspector.mjs". Both smoke files and both apps exist.
3. Built: `packages/server`, `packages/services`, `apps/golden-1/modules/api`, `apps/inspector`.
4. Open: no stage-specific lines.
5. Verdict: CLOSED.

## G3 Kernel freeze

1. Exit criterion, `docs/ROADMAP.md`: "Every section conformance-covered; each extension point used by >= 1 stdlib module; two golden apps; evals improving".
2. Not met as written. `docs/ROADMAP.md` says "criteria met 2026-11-07" in the same cell that says "38 of 40 kernel sections are conformance-covered, k.hosting is implemented and k.shell proposed". `tasks/0034-freeze/PLAN.md` has Status "open" and every Verification box unticked, including "`spec/00-map.md`: every kernel row `frozen`". Its D8 (2026-11-09, user) makes the kernel provisionally frozen and holds the `frozen` flip "until the S stages (S1-S8) have exercised the kernel".
3. Built: the review, `docs/freeze-review.md`; the stdlib packages cover the extension points.
4. Open: 0034 itself; 0349 (k.topology clauses 2, 6 and 9 have no evidence). The flip is also launch checklist item 0223 in P1.
5. Verdict: BUILT, EXIT WAITS ON SOMETHING EXTERNAL: the user's hold on the `frozen` flip, plus the two sections not yet conformance-covered.

## S1 Sessions

1. Exit criterion, `tasks/PROGRAM.md`: "nightly loop closes a bug in apps/sessions"; `docs/ROADMAP.md`: "Fix loop closes real bugs in Keel's own ingest service".
2. Met. `docs/HANDOFF.md`: "S1 EXIT MET (2026-11-09, tasks/0276-resume-root-catcher/PLAN.md, rfc:0075 ADR-0064): ... nightly run 42711189372 filed issue 1 ... passes at fba4633, which closed the issue." `docs/ROADMAP.md` agrees: "passed 2026-11-09". `tasks/0276-resume-root-catcher/PLAN.md` ticks "nightly run files one `keel-session` issue for the planted error". Two older lines of the same date disagree: "The strict S1 exit (a nightly-filed issue closed by a fix) is NOT met" and "S1 EXIT WAITS ON THE USER: deploy apps/sessions at a public https URL". Both sit below the EXIT MET line, so the EXIT MET line is newer. The handoff also notes `KEEL_SESSIONS_URL` is deleted, so the nightly skips itself today.
3. Built: `packages/std-sessions` (src, test, conformance), `apps/sessions`, the GitHub Action `@keel/std-sessions/action`; rfc:0070 to rfc:0078.
4. Open: 1 high or medium, 13 low. The ones that matter: 0506 (`replayGroup` starts one worker per user with no bound and no timeout), 0296 (medium: Node globals type-check in client components).
5. Verdict: CLOSED.

## S2 Values

1. Exit criterion, `tasks/PROGRAM.md`: "golden-2 prices and dates in 3 locales (eval)"; rfc:0079 section 6 names `pnpm eval --task golden-2 --runner none --strict` as the proof.
2. Met. `docs/ROADMAP.md`: "passed 2026-11-10: evals/results/2026-11-10-golden-2-none.json"; that file holds `converged: true`, and the latest, `evals/results/2026-11-18-golden-2-none.json`, also holds `converged: true`. `docs/HANDOFF.md`: "S2 VALUES CLOSED IN CODE AND PUSHED (2026-11-10, de9e0d7 ...) golden-2 in en-US/de-DE/ja-JP with the eval converged". `tasks/0307-s2-values/PLAN.md` ticks every Verification box.
3. Built: `std-money`, `std-temporal`, `std-text`, `std-i18n`, `std-messages` under `packages/`, each with src, test and conformance; `apps/golden-2`; rfc:0079.
4. Open: 5 high or medium, 16 low. The ones that matter: 0321 (medium: `TimeZone` rejects the current IANA names and accepts the legacy ones), 0323 (medium: E1758 misses common host-zone reads), 0327 (low-medium: error documents get the default head and lose the locale).
5. Verdict: CLOSED.

## S3 Server depth

1. Exit criterion, `tasks/PROGRAM.md`: "split topology without source changes (eval)"; rfc:0080 section 8 names `pnpm eval --task golden-1-api --runner none --strict` as the proof.
2. Met. `tasks/0309-s3-server-depth/PLAN.md` ticks "exit eval `golden-1-api` converged" and ends "CLOSED (2026-11-11)". `docs/HANDOFF.md`: "S3 SERVER DEPTH CLOSED IN CODE (2026-11-11 ...) eval `golden-1-api` converged (in-process and built split proofs)". `evals/results/2026-11-11-golden-1-api-none.json` holds `converged: true`. The ROADMAP S3 row carries no "passed" note, and the handoff line adds "Not run by anyone: Docker/compose, the topology split by hand".
3. Built: `std-jobs`, `std-schedules` (src, test, conformance), k.compat, k.topology, the generated `dist/<name>/server.mjs` entries; rfc:0080, with follow-ups rfc:0086, rfc:0087, rfc:0092. std-streams was dropped by design.
4. Open: 0 high or medium, 27 low. The ones that matter: 0349 (k.topology clauses lack evidence), 0353 (one `KEEL_SECRET` signs caller cookies for every deployable), 0364 (no cap on concurrent event streams per deployable).
5. Verdict: CLOSED.

## S4 Realtime

1. Exit criterion, `tasks/PROGRAM.md`: "multi-user replay finds an injected race"; rfc:0081 section 7 names the `golden-1-api` eval as the proof.
2. Met. `docs/HANDOFF.md`: "S4 EXIT MET: `pnpm eval --task golden-1-api --runner none --strict` ended `converged=true` (401.6 s ... the planted-race twin; `evals/results/2026-11-12-golden-1-api-none.json`)"; that file holds `converged: true`. `docs/ROADMAP.md`: "passed 2026-11-12". `tasks/0310-s4-realtime/PLAN.md` ticks "exit eval green" and records "closed 2026-11-12".
3. Built: `std-live`, `std-channels`, `std-offline`, `std-conflicts` (src, test, conformance), k.sync; rfc:0081, with rfc:0127 and rfc:0128 in progress in the working tree.
4. Open: 0 high or medium, 19 low. The ones that matter: 0501 (a stored outbox entry goes to its stored `origin` unchecked and carries no owner), 0503 (the stream cap has no per-caller share), 0741 (`logLimit: 0` disables write-key dedupe; rfc:0128 addresses it).
5. Verdict: CLOSED.

## S5 Correctness

1. Exit criterion, `tasks/PROGRAM.md`: "every rung populated by real machinery"; rfc:0082 section 6 adds the `golden-1-api` eval and `pnpm ledger --diff`.
2. Met. `docs/HANDOFF.md`: "S5 CLOSED (2026-11-13 ...) S5 EXIT MET: the committed ledger counts items on every rung (836 items ... 36 proven, 13 exhaustive, 235 probabilistic, 724 example, 4 monitored ...)". `evals/results/2026-11-13-golden-1-api-none.json` holds `converged: true`. `tasks/0311-s5-correctness/PLAN.md` has Status "closed (2026-11-13)" and ticks the exit proof; its second box, "NOT DONE: mutation runs", stays unticked. The ROADMAP S5 row carries no "passed" note, and backlog tracking line 0311 is unticked.
3. Built: `std-statecharts` (src, test, conformance), k.sim, k.model, k.ledger, `std-sessions/monitor`; rfc:0082.
4. Open: 0 high or medium, 6 low, all mutation tooling. The one that matters: 0625 (mutation scores fell on 2026-11-16, testing 87.7 to 78.2, while staying at threshold).
5. Verdict: CLOSED.

## S6 Compliance

1. Exit criterion, `tasks/PROGRAM.md`: "external a11y audit + pen test on golden app 3"; rfc:0083: "The stage exits when the re-test report has no open Level A or AA failure and the pen test no high or critical finding."
2. Not met. `docs/HANDOFF.md`: "S6 BATCH CLOSED (2026-11-13 ...) EXIT PROOF OPEN, all the user's: the golden-3 agent build (`pnpm eval --task golden-3 --runner claude --strict`), the accessibility audit and the pen test." `tasks/0312-s6-compliance/PLAN.md` leaves "exit proof: golden app 3 ... the external audit and pen test (user)" unticked. No `apps/golden-3` exists, and `evals/results/2026-11-17-golden-3-none.json` holds `converged: false`.
3. Built: k.privacy, k.security, k.a11y, k.evidence, `docs/COMPLIANCE.md`, the golden-3 eval task; rfc:0083, rfc:0093, rfc:0095, and the `req` path and reveal work through rfc:0126.
4. Open: 0 high or medium, 19 low. The ones that matter: 0739 (a revealed `Secret` is not frozen), 0753 (`.pii()` route params written raw in the `req` path), 0569 (client source maps served). Commit 99569e2a implements rfc:0126, which covers 0739 and 0753, and both lines are still unticked.
5. Verdict: BUILT, EXIT WAITS ON SOMETHING EXTERNAL: the golden-3 agent build, which the user starts; an external accessibility audit; an external pen test.

## S7 UI modules

1. Exit criterion, `docs/ROADMAP.md`: "Golden app 2 catalog page: all widgets and a paged table, zero a11y violations in three locales; an agent builds a table page from the public docs". rfc:0084 section 6 adds "two browser engines" and the widget charts' `explore` rungs. `tasks/PROGRAM.md` leaves the exit proof column empty.
2. Partly met. `docs/HANDOFF.md`: "S7 CLOSED (2026-11-14 ...) `golden-2-catalog` eval stops only at the WebKit browser pass (0575)", which closes the batch, not the exit. `evals/results/2026-11-14-golden-2-catalog-none.json` holds `converged: false`. Backlog 0575 is now ticked ("2026-11-17: WebKit 2388"), and `evals/results/2026-11-18-golden-2-catalog-none.json` holds `converged: true`. `tasks/0337-s7-ui-modules/PLAN.md` still has Status "open" and leaves "exit proof: ... the agent build (`--runner claude`) is the user's to start" unticked. No line records the agent build.
3. Built: `std-headless`, `std-tables` (src, test, conformance), golden-2's `recipes.catalog`; rfc:0084, rfc:0097 to rfc:0099.
4. Open: 0 high or medium, 7 low. The one that matters: 0600 (a sort or pager link activated during a `TableSearch` load re-applies the old `q`).
5. Verdict: BUILT, EXIT WAITS ON SOMETHING EXTERNAL: the agent build of the table page from the public docs (`--runner claude`), which the user starts.

## S8 Reach

1. Exit criterion, rfc:0085 section 9: "golden-1 on std-db survives SIGKILL with byte-equal stored state on SQLite and on Postgres, a list removal resumes after a SIGKILL inside a step and ends once, golden-1's `web` ships from CI as a Tauri Linux binary and an Android debug APK, a recorded session replayed inside the Tauri shell gives the server state its sim replay gives, and the board's map-based transactions are `proven`." `tasks/PROGRAM.md` leaves the exit proof column empty.
2. History: recorded closed, reopened on 2026-11-18 because the stage's own design RFC had unmet clauses (shells in CI, Postgres), then closed again the same day on the evidence of point 5. The older handoff line "S8 BUILT, EXIT OPEN (2026-11-15 ...)" and the undated `docs/ROADMAP.md` "S8 state" paragraph describe the state before the shell and Postgres parts ran.
3. Built: `std-db`, `std-workflows`, `std-capacitor`, `std-tauri`, `std-credentials` (src, test, conformance), `@keel/testing/prove`, `keel build --target`; rfc:0085, rfc:0100, and the follow-up RFCs through rfc:0129 under task 0338.
4. Open: the limits of point 5, carried as backlog lines 0810 (done), 0811, 0820, 0823 to 0829, plus the resume follow-ups 0482, 0833, 0834 and 0835. The earlier highs 0607, 0609, 0610 and 0694 are shown (`tasks/0338-s8-reach/PLAN.md` item -13); 0648 (medium, a security choice on rehashing stored credentials) stays open.
5. Verdict: CLOSED on 2026-11-18 on the evidence in `tasks/0338-s8-reach/PLAN.md` item -13: all five exit clauses shown, four with a stated limit carried as backlog lines (0810, 0811, 0820, 0823 to 0829).

## P1 Go public

1. Exit criterion, `tasks/PROGRAM.md`: "newcomer explains Keel from the diagrams; agent builds a golden app from public docs"; `docs/ROADMAP.md` adds "external a11y and security review of the site".
2. Not met. No task directory exists under `tasks/`, and `docs/diagrams/` does not exist.
3. Built: nothing yet.
4. Open: 0 high or medium, 6 low: 0220 (diagrams), 0221 (human docs), 0222 (agent docs), 0223 (launch checklist, including the kernel `frozen` flip), 0229 (docs sweep for 1.0), 0749 (correctness evidence raised before release).
5. Verdict: NOT STARTED.
