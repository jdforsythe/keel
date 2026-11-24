---
name: keel-package-dev
description: How to implement or change a kernel package: layout, strict TS profile, rung requirements, exports, changesets.
---
# Package development

**Layout.** `packages/<pkg>/src/<Export>.ts` one export per file · `index.ts` re-exports only · `conformance/` (read-only to you) · `test/` properties and examples · `unsafe/` the only place for casts, `any` and suppressions, each inside `unsafe(reason, () => ...)`; the file's other lines are checked as app code.

**Procedure.** `pnpm spec <id>` -> read the conformance suite's test names (not bodies) -> implement smallest slice -> `pnpm check` -> `pnpm test --filter <pkg>` -> property tests for every exported pure function -> `pnpm mutate --filter <pkg>` if touching schema/reactive/store/router -> changeset -> update README contract.

**Output.** Any logging uses `@keel/tooling/output`. No `console.log`.

**Done.** Conformance green, properties present, mutation at threshold, ledger not regressed, README updated.
