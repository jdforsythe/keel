# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - G1 state (2026-11-06): 14 of 15 kernel sections implemented and reviewed (k.server has only the topology() slice; k.services not started; both G2). Root `pnpm check` and `pnpm test` green (31 check tasks, 29 test tasks).
  - golden app 1 (apps/golden-1, todos): builds, 32 tests green, `keel check` clean, eval `--runner none` converged; verified in headless Chromium via tooling/smoke/*.mjs: add list, client-side navigate, add todo, toggle, Undo all work; Suggestions shows the Match error case (no backend).
  - in flight: eval baseline with a real model in an isolated worktree (`pnpm eval --task golden-1 --model claude-sonnet-5-5 --runner claude`); result lands in evals/results/.
  - next: 0036 mutation testing (definition of done gap), 0042 ledger over apps, 0048 scaffold output fixes, 0047 lint consolidation, 0043/0044/0045 RFCs, then G2 (0028 server, 0029 services, 0031 inspector, 0032 real API).
  - process: rfc:0000 pre-implementation fixes; RFCs 0001-0009 in docs/rfc; delegation tiers in docs/WORKFLOW.md; cli last in deps order.
  blockers: none
pending decisions: none
last updated: (initial)
```
