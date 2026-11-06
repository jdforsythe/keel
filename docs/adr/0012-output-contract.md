# ADR-0012: Agent-first output contract

**Status:** accepted
**Context.** Tool output is the agent's primary input and the largest avoidable token cost.
**Decision.** One diagnostic shape; compact by default on non-TTY; silent success; grouped and capped; fix diffs; stable codes; token budgets in CI. Applies to Keel's own build from task 0001.
**Alternatives.** Pretty by default with `--json` opt-in (agents forget; humans are the minority reader).
**Consequences.** `tooling/budgets.json` is a gate; every new command ships a formatter for all three modes.
