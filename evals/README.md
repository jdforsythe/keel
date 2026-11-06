# Evals

`pnpm eval --task <name> --model <id>` runs an agent on a task with the spec slice and skill, then records converged state, iterations, tokens, and unsafe count to `evals/results/<date>-<task>-<model>.json`. Tasks live in `evals/tasks/<name>/` with `TASK.md`, `spec-slice.txt`, and `pass.ts`.
