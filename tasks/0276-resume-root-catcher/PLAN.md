# Task 0276 + 0277: resume root catcher, intrinsic call imports

**Spec:** k.errors (root boundary under `resume`) · k.component (intrinsics called as functions) · **Gate:** S1 exit (0272) · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Deliverables
- [ ] 0276 each island `resume` resumes has the root catcher: a throwing binding or handler reports `keel.unexpected` to the ctx and renders the root fallback in place of the island
- [ ] 0277 `lowerFile` keeps a `@keel/runtime-dom` import whose bindings are called as functions
- [ ] rfc:0075 + ADR-0064, conformance (`runtime-dom/conformance/resume-root-catcher.test.ts`, `compiler/conformance/intrinsic-call-import.test.ts`), changeset, migration note if any

## Steps
1. [ ] Kernel agent (in flight, id ac6c945360de46bc0, started before the context reset): RFC, spec text, conformance through `conformance-writer`, implementation.
2. [ ] Root `pnpm check`, `pnpm test`; ledger 0 lowered; unsafe 6; budgets.
3. [ ] Reviewer + red-team over the batch diff; findings to `tasks/BACKLOG.md`; commit `rfc:0075`; push.
4. [ ] Drill rerun: build apps/sessions, serve on 4200 behind the tunnel, mint a reader and commit its hash, set `KEEL_SESSIONS_URL`, click "Show limits" in a real browser, dispatch the nightly, confirm the filed `keel-session` issue.
5. [ ] Fix the planted `limitLine` defect (apps/sessions/modules/ops/Home.ts) with the emitted session test; close the issue with the fix commit; delete `KEEL_SESSIONS_URL`; stop the service and tunnel; close 0272.

## Decisions
- D1: docs-freshness D0001 on docs/ARCHITECTURE.md and docs/freeze-review.md cleared by a verified bump at eb0e615. ARCHITECTURE read against the tree and accurate. freeze-review is the dated G3 audit that RFCs 0020-0045 cite as evidence; its content is kept as filed and it goes in the 1.0 sweep (0229).

## Verification
- [ ] `pnpm check`, `pnpm test` green; ledger 0 lowered, 0 uncovered; unsafe 6
- [ ] nightly run files one `keel-session` issue for the planted error; the emitted test fails before the fix and passes after; issue closed

## Next action
Wait for the kernel agent's report; then step 2.
