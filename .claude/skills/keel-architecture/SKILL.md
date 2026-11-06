---
name: keel-architecture
description: Read first in any Keel task. Package map, naming, boundaries, where things live, what never to do.
---
# Keel architecture skill

Load when starting any task. Keep under 600 tokens in context.

**Map.** Kernel packages in dependency order: schema, reactive, store, compiler, runtime-dom, router, forms, ui, check, cli, scaffold, testing, server, services, ctx. Imports point downward only (`tooling/deps.json`).

**Where.** Spec: `spec/kernel/<id>.md` via `pnpm spec <id>`. Decisions: `docs/adr/`. Process: `docs/WORKFLOW.md`. Output rules: `docs/OUTPUT.md`. Current state: `docs/HANDOFF.md`.

**Never.** Rename glossary terms · add a second way to do a thing · edit `conformance/` without an RFC · use bare `Date`, `Math.random`, `fetch` in app or test code · print anything that violates OUTPUT.md · read generated output or `.worktrees/` of other tasks.

**Always.** One export per file · schema before code · conformance before implementation · checkpoint PLAN.md · cite the spec section and principle numbers in PRs.
