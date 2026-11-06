# Workflow

**Unit of work.** One task from `tasks/BACKLOG.md`, sized to one context window, citing a spec section, with acceptance criteria.

**Loop.** `/next` (claim, worktree, branch, PLAN.md) -> `conformance-writer` writes tests from spec -> implement -> `pnpm check` -> `pnpm test` -> `/review` -> docs, spec status, changeset -> commit -> PR -> merge flips the backlog line.

**Parallelism.** One worktree per task under `.worktrees/`. `HANDOFF.md` lists all active worktrees. Same-package tasks are serialized.

**Context discipline.** Checkpoint `PLAN.md` after each step. Subagents for exploration. `pnpm spec` for retrieval. Never read `.generated/` or build output.

**Humans.** Approve RFCs and ADRs, own security, decide freezes, pick design partners.

**Red team.** `red-team` subagent runs on schedule against merged work and PRINCIPLES.md, filing backlog items.
