# Workflow

**Unit of work.** One task from `tasks/BACKLOG.md`, sized to one context window, citing a spec section, with acceptance criteria.

**Loop.** `/next` (claim, worktree, branch, PLAN.md) -> `conformance-writer` writes tests from spec -> implement -> `pnpm check` -> `pnpm test` -> `/review` -> docs, spec status, changeset -> commit -> PR -> merge flips the backlog line.

**Parallelism.** One worktree per task under `.worktrees/`. `HANDOFF.md` lists all active worktrees. Same-package tasks are serialized. Worktrees share one git index, so every agent stages by explicit path (never `git add -A`) and only the orchestrator commits.

**Context discipline.** Checkpoint `PLAN.md` after each step. Subagents for exploration. `pnpm spec` for retrieval. Never read `.generated/` or build output.

**Humans.** Approve RFCs and ADRs, own security, decide freezes, pick design partners.

**Red team.** `red-team` subagent runs on schedule against merged work and PRINCIPLES.md, filing backlog items.

**Delegation.** The orchestrating agent keeps its context for thinking and decisions; it does not read code wholesale or do mechanical edits. Work is tiered by model and effort:

| Tier | Model / effort | Use for |
| --- | --- | --- |
| mechanical | haiku, high | scaffolds, renames, reading and summarizing, running commands, applying a known diff |
| routine | sonnet, medium | scripts, tooling, tests from a clear brief, conformance tests, reviews |
| design | opus, high (or the orchestrator) | kernel package design, spec interpretation, ADRs, anything with a judgment call |

Brief every subagent with: the files it owns, the files other agents own concurrently, the spec section, the verification command, and what to report back (trailer lines, files touched, unfinished items). Independent subagents run in parallel in one turn. Subagent definitions in `.claude/agents/` carry a `model:` so the tier is the default, not a choice.

verified: c7522f5e28b3cdfc1308c56d917f1698e394a635
