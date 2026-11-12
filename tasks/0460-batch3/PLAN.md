# Task 0460: batch 3: formatter gate, follow-ups of batch 2, RFC 0091 small kernel shapes

**Spec:** k.check, k.head, k.router, k.topology, k.testing, k.component, k.runtime, k.schema, k.forms, k.cli, k.server · **Principles:** 1, 5, 12 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 (user, 2026-11-12: "finish up with 438 files") the seven files of 0438 are committed as the formatter writes them (6cfe27f): line wraps only. The cause is fixed in lane T1: generated and scratch paths leave Biome's view and `pnpm check` gains a repo-wide format gate.
- D2 (orchestrator) the mutation run of batch 2 (`pnpm mutate:changed --base e192395`) keeps running while these lanes work, on the user's instruction to work concurrently; lanes may slow it and its packages are measured on their state when each run starts.
- D3 (orchestrator) the items that need a kernel shape (0446, 0394, 0395, 0377, 0387, 0449, 0450) go through one RFC, 0091, drafted by a design agent under the WORKFLOW RFC defaults; the orchestrator accepts it and records each answer for the user to confirm or reverse.

## Steps
- [x] 0 commit the seven 0438 files (6cfe27f)
- [ ] 1 wave 1 lanes (running): T1 tooling: `biome.json` ignores, `tooling/format-check.mjs` in `pnpm check`, the two rfc:0090 conformance files formatted (0438, 0451) · T2 router: `title` `params` and `search` typed (0448) · T3 server: HEAD keeps `content-length` (0458); runtime-dom: resume-then-refresh keyed-row test (0459) · T4 check: E1005 names the command and prints after source diagnostics (0376) · T5 testing: `landmark-unique` (0397) · T6 design: `docs/rfc/0091-friction-batch3.md`
- [ ] 2 record batch 2's mutation scores when its run ends (tasks/0445-batch2/PLAN.md Next action)
- [ ] 3 accept RFC 0091, ADR, spec text, conformance-writer, implementation lanes
- [ ] 4 reviewer and red-team; findings to the backlog
- [ ] 5 ledger, budgets, changesets, backlog, handoff, push

## Notes
- T1 done: `tooling/format-check.mjs` (F0001 would reformat, F0002 unreadable; `fix:` names the command), wired into root `check`; `biome.json` ignores `**/.keel/**`, `**/reports/**`, `**/.stryker-tmp/**`; `docs/WORKFLOW.md` Format paragraph; tooling tests 18 pass. The gate fails on any lane's unformatted new file, so each lane's files are formatted by path before its commit.
- T3 done: a forwarded HEAD response keeps the peer's `content-length` unless it carried a `content-encoding` (server 482 pass, 17,556 B of 17,664); `runtime-dom/test/keyed-rows-resume.test.ts` (3 tests, one property) passes: a resumed list keeps row nodes and focus across a refresh, an insert and a removal. No finding.
- T5 done, UNCOMMITTED on purpose: `landmark-unique` in `packages/testing/src/internal/axe.ts` (rule id in `Violation.ts`, `test/landmark-unique.test.ts`, README rule list; testing 295 pass; its tests were written after the code). It finds a real defect: golden-2 has three unnamed `nav` landmarks (`BoxShell.tsx` `recipes.nav`, `recipes.locales`; `RecipeList.tsx` `recipes.filters`), 10 golden-2 tests fail, and `@keel/ui` `Box` has no prop to name a landmark. The rule is committed together with the `Box` name prop, which is RFC 0091 item G.

## Verification
- [ ] `pnpm check` (with the format gate), `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] `pnpm exec biome format .` reports nothing

## Next action
Collect lanes T1-T6 as they report; commit each by explicit path.
