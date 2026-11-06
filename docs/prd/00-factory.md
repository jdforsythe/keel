# PRD A: The factory

The repo, toolchain, and agent process that build Keel. Executed by task 0001. Gate G0.

## Goals
Any fresh agent reaches productive work in one read cycle. Every command is token-cheap by default. Conformance tests cannot be shaped by implementers. Context loss costs nothing.

## Requirements
1. **Toolchain.** Node 22 LTS, pnpm 9, Turborepo with remote cache, TypeScript 5.x strict profile (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`), Biome, Vitest + fast-check, Playwright, Stryker, changesets.
2. **Scripts.** `pnpm check|test|build|eval|spec|ledger|handoff`. All compact by default per OUTPUT.md. `pnpm spec <topic>` prints one spec section; `pnpm spec --map` prints the map.
3. **Structure lint.** One export per file; filename equals export; downward-only package imports (`tooling/deps.json`); no `any`/casts/`!`/`@ts-ignore` outside `unsafe/`; `unsafe(...)` requires a justification string; no wall-clock or `Math.random` in tests.
4. **Budgets.** `tooling/budgets.json`: token budgets for command output and spec sections, size budgets per package. CI fails on breach.
5. **CI.** check -> test -> build -> mutate (kernel, nightly) -> eval (weekly) -> budgets -> ledger. Affected-only via Turborepo.
6. **Hooks** (`.claude/settings.json`): format on edit; `pnpm check` before commit; block edits under `packages/*/conformance/` unless branch or commit carries `rfc:NNNN`; nudge `/handoff` after 40 tool calls.
7. **Subagents.** `conformance-writer` (spec section in, tests out, no access to implementation), `reviewer` (applies keel-review), `red-team` (applies keel-red-team), `explorer` (reads, summarizes, returns <= 300 tokens).
8. **Commands.** `/resume`, `/next`, `/handoff`, `/review`, `/rfc`.
9. **Skills.** Internal set in `.claude/skills/`; each ships an eval in `evals/skills/`.
10. **Evals harness.** `evals/run.ts`: runs a task with a model, a spec slice, and the skill; records converged state, iterations, tokens, unsafe count to `evals/results/`.
11. **Docs freshness.** A doc older than 50 commits in its package without a `verified:` bump fails check.

## Acceptance
CI green on the empty workspace · every script and command runs · one eval runs end to end · an injected conformance edit without an RFC tag is rejected · output budgets measured and enforced.
