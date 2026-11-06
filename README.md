# Keel

A full-stack web framework whose primary author is a coding agent.

One way to do each thing. Incorrect code fails to compile. The hard parts are built in. Every bug arrives with its own reproduction. The framework reports what it has proven, what it has tested, and what it has merely run.

**Status:** pre-0.1. The kernel is being built from this kit. Nothing is stable.

Humans start at `docs/VISION.md` then `docs/ROADMAP.md`. Agents start at `CLAUDE.md`.

Layout: `docs/` (PRDs, principles, ADRs, process) · `spec/` (the product: kernel and stdlib sections with status) · `tasks/` (backlog, per-task plans) · `packages/` (kernel) · `evals/` (agent benchmark) · `tooling/` (budgets, dependency rules) · `.claude/` (skills, subagents, commands, hooks).

First run: `pnpm install && pnpm check`, then open Claude Code and run `/resume`.
