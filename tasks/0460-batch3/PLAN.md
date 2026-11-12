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

## Verification
- [ ] `pnpm check` (with the format gate), `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] `pnpm exec biome format .` reports nothing

## Next action
Collect lanes T1-T6 as they report; commit each by explicit path.
