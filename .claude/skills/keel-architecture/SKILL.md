---
name: keel-architecture
description: Read first in any Keel task. Package map, naming, boundaries, where things live, what never to do.
---
# Keel architecture skill

Load when starting any task. Keep under 600 tokens in context.

**Map.** Kernel packages in dependency order: schema, reactive, store, runtime-dom, compiler, router, forms, ui, check, scaffold, testing, server, services, cli, ctx. Imports point downward only (`tooling/deps.json`).

**Reach.** `ctx.storage` has `read` and `commit`; drivers go in `createCtx({ drivers })`. `@keel/std-db` (sqlite, postgres), `std-workflows`, `std-capacitor`, `std-tauri` are generated or server-side: app code never imports the drivers. `@keel/std-credentials` is server-side: passwords and tokens. `@keel/testing/prove` proves invariants with Z3.

**Where.** Spec: `spec/kernel/<id>.md` via `pnpm spec <id>`. Decisions: `docs/adr/`. Process: `docs/WORKFLOW.md`. Output rules: `docs/OUTPUT.md`. Current state: `docs/HANDOFF.md`.

**Never.** Rename glossary terms · add a second way to do a thing · edit `conformance/` without an RFC · use bare `Date`, `Math.random`, `fetch` in app or test code · print anything that violates OUTPUT.md · read generated output or `.worktrees/` of other tasks.

**Delegate.** haiku: mechanical · sonnet: routine scripts and tests · opus/self: design. Parallel when independent. Brief with owned files, spec id, verify command, report shape.

**Always.** One export per file · schema before code · conformance before implementation · checkpoint PLAN.md · cite the spec section and principle numbers in PRs.
