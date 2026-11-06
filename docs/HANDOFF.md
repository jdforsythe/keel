# Handoff (living)

Updated by `/handoff`. Read first on every fresh start.

```
health: pnpm check && pnpm test
active:
  - task: 0002-schema (covers 0002-0004), 0005-reactive (covers 0005-0006), 0009-ctx; all in this worktree, run in parallel via subagents
    plan: tasks/<id>/PLAN.md
    next: see each PLAN.md "Next action"
    blockers: none
  - task: 0001-factory (CLOSED 2026-11-06; CI not yet run remotely)
    branch: jdforsythe/test-impl
    worktree: /Users/jforsythe/orca/workspaces/keel/test-impl (Orca worktree; decision D1)
    plan: tasks/0001-factory/PLAN.md
    next: see PLAN.md "Next action"
    blockers: none
pending decisions: none
last updated: (initial)
```
