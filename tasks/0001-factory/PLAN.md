# Task 0001: factory

**Spec/PRD:** docs/prd/00-factory.md · **Gate:** G0 · **Branch:** task/0001-factory

## Deliverables
- [ ] pnpm workspace, Turborepo, tsconfig.base.json strict profile, Biome
- [ ] scripts: check, test, build, eval, spec, ledger, handoff (compact output by default)
- [ ] tooling/: budgets.json, deps.json, structure-lint, output formatter lib
- [ ] .claude/: settings hooks, subagents, commands, skills (verify they load)
- [ ] evals/run.ts and one task; one skill eval
- [ ] CI workflow; docs freshness check
- [ ] packages/*/README.md stubs with contract headings

## Steps
1. Install toolchain; commit lockfile.
2. Write tooling/output.ts (diagnostic model + 3 formatters); use it in every script.
3. Structure lint + deps lint; wire into `pnpm check`.
4. Hooks; test the conformance-edit block with a dummy file.
5. Evals harness; run the sample task; commit results.
6. CI; run locally with act or push.
7. Update docs/HANDOFF.md; close plan.

## Decisions
(record here as made)

## Verification
- [ ] `pnpm check && pnpm test` green on empty workspace
- [ ] hook rejects conformance edit without rfc tag
- [ ] `pnpm eval --task sample` writes evals/results/*.json
- [ ] `pnpm check` output on 10 injected lint errors <= 600 tokens

## Next action
Step 1.
