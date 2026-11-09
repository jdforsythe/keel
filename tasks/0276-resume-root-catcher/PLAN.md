# Task 0276 + 0277: resume root catcher, intrinsic call imports

**Spec:** k.errors (root boundary under `resume`) · k.component (intrinsics called as functions) · **Gate:** S1 exit (0272) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-09; S1 exit met)

## Deliverables
- [x] 0276 each island `resume` resumes has the root catcher: a throwing binding or handler reports `keel.unexpected` to the ctx and renders the root fallback in place of the island
- [x] 0277 `lowerFile` keeps a `@keel/runtime-dom` import whose bindings are called as functions
- [x] rfc:0075 + ADR-0064, conformance (`runtime-dom/conformance/resume-root-catcher.test.ts`, `compiler/conformance/intrinsic-call-import.test.ts`), changeset, migration note if any

## Steps
1. [x] Kernel agent: RFC 0075, ADR-0064, spec text, conformance through `conformance-writer`, implementation (wip f15db47; its design decision is D8 in tasks/0253-s1-exit-path/PLAN.md).
2. [x] Root `pnpm check`, `pnpm test`; ledger 0 lowered; unsafe 6; budgets.
3. [x] Reviewer + red-team over the batch diff; findings to `tasks/BACKLOG.md`; commit `rfc:0075`; push.
4. [x] Drill rerun: build apps/sessions, serve on 4200 behind the tunnel, mint a reader and commit its hash, set `KEEL_SESSIONS_URL`, click "Show limits" in a real browser, dispatch the nightly, confirm the filed `keel-session` issue.
5. [x] Fix the planted `limitLine` defect (apps/sessions/modules/ops/Home.ts) with the emitted session test; close the issue with the fix commit; delete `KEEL_SESSIONS_URL`; stop the service and tunnel; close 0272.

## Decisions
- D1: docs-freshness D0001 on docs/ARCHITECTURE.md and docs/freeze-review.md cleared by a verified bump at eb0e615. ARCHITECTURE read against the tree and accurate. freeze-review is the dated G3 audit that RFCs 0020-0045 cite as evidence; its content is kept as filed and it goes in the 1.0 sweep (0229).
- D2: red-team 0278-0281 filed. 0278, 0279, 0280 and the reviewer's findings (property test, history wording, two untested edges) are fixed as an amendment to rfc:0075 before the push; 0281 holds the unconfirmed leads.
- D3 (0280, RFC default 4): a handler's `data.at` holds only an id the compiler knows, never a runtime DOM `id`; the kernel agent picks the smallest mechanism and k.errors states it.
- D4 (0280 mechanism, rfc:0075 amended): a handler's `data.at` is the id `on` was registered under, else the nearest `data-k` stamp, else `""`. The compiler wraps a k.ui base element with a literal `id` so its stamp is that id; an id from an expression is never stamped. Bindings and structural ops still read the runtime `id` (0282).
- D5: `@keel/compiler` measures 26,332 B against 26 kB (26,624 B); no re-base.
- D6 (drill rerun, 2026-11-09): rfc:0075 pushed at 46093b9, reader hash at 3aedf0d. Service on 4200 behind a Cloudflare quick tunnel (secret, token and URL in the job temp directory, not in the repo); repo variable `KEEL_SESSIONS_URL` and secret `KEEL_SESSIONS_TOKEN` set. A real browser click rendered the root fallback and uploaded the session (POST /sessions 303): 0276 holds live. Nightly run 42706609718 ingested 1 fingerprint and created no issue: replay reproduces the error with another `data.at` (E2004), filed as 0283. Session kept at apps/sessions/.keel/sessions/1a9e17423979-0.json (untracked).
- D7 (0283, rfc:0075 amended): the cause was in `@keel/reactive`. A computed keeps a throw as its outcome until a source changes: one run per commit, every reader's `get()` rethrows it, the first value after a throw always counts as a change. A throw surfacing at no element has `data.at` the stamp at the root's place, else `""`, under `mount` and `resume`. Local live check at 7d78734: click reported `ops.home.limits.list`, session fb142676235c ingested and `keel session replay` reproduced it. Reactive mutation score 84.7% (threshold 80%).
- D8: docs-freshness verified bump on GLOSSARY and VOICE, both read and accurate.
- D9 (S1 exit, 2026-11-09): rfc:0075 pushed at 219e2cb after reviewer approval; red-team 0288-0290 filed for S2. A real browser click on the deployed page reported `keel.unexpected` at `ops.home.limits.list` and uploaded the session; nightly run 42711189372 (`ok session action 1 fingerprints, 1 created`) filed issue 1 with a session test; that test failed on the planted defect and passes at fba4633, which closed the issue. A click on the fixed page shows no fallback and posts nothing. `KEEL_SESSIONS_URL` deleted, service and tunnel stopped; the repo secret `KEEL_SESSIONS_TOKEN` holds a token whose signing secret is gone. apps/sessions/test/resumeReplay.test.ts uses its own page for the binding throw.

## Verification
- [x] `pnpm check`, `pnpm test` green; ledger 0 lowered, 0 uncovered; unsafe 6 (`ok check 44 tasks` · `ok test 42 tasks` · `ok ledger --diff 483 items, 476 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`)
- [x] nightly run files one `keel-session` issue for the planted error; the emitted test fails before the fix and passes after; issue closed

## Next action
None for this task. Next work: `tasks/BACKLOG.md` S1 leftovers (0241, 0219, 0237 remainder, 0248, 0255), then S2 per `tasks/PROGRAM.md`.
