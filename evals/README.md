# Evals

```
pnpm eval --task <name> [--model <id>] [--runner claude|none] [--max-iter N] [--skill <name>] [--strict]
pnpm eval --skill <name> [--runner claude|none]
```

Tasks live in `evals/tasks/<name>/` (`TASK.md`, `spec-slice.txt`, `pass.ts` whose default export returns `true` on success). A task may carry `task.json` `{ "skill": "<name>" }` naming its default skill (golden-1: `keel`). Skill precedence for a task run: `--skill`, then `task.json`, then `keel-package-dev`. `--skill` without `--task` is the skill-eval mode. Skill evals live in `evals/skills/<skill>.json`: `{skill, maxTokens, prompt, expect[]}`.

**Runners.** `claude` (default when `--model` is given) loops up to `--max-iter` (default 5): `claude -p --output-format json` with TASK + spec slice + skill (plus the previous iteration's `pnpm check`/`pnpm test` output), then `pnpm check --quiet`, `pnpm test --quiet`, `pass.ts`. `none` skips the model and evaluates once, so CI can run end to end. Skill evals always check SKILL.md exists, has `name`/`description` frontmatter, and chars/4 <= `maxTokens`; with `claude` they also send the prompt and require every `expect` substring.

**Output.** Compact per `docs/OUTPUT.md`: `V0001` when not converged, `V0002` skill failure, then trailer `ok eval <task> converged=<bool> iter=<n> tokens=<in>/<out> unsafe=<u> (Xs)`. Exit 0 unless `--strict`.

**Results.** `evals/results/<date>-<task>-<model|none>.json`:
`{task, skill, specSections, model, runner, converged, iterations, tokens:{input,output}, costUsd, unsafeCount, checkTrailer, testTrailer, durationMs, startedAt}`. Input tokens include cache reads/writes. `unsafeCount` counts `unsafe(` under `packages/*/src` and `unsafe/`. Skill results: `<date>-skill-<skill>-<runner>.json`.
