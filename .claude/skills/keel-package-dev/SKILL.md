---
name: keel-package-dev
description: How to implement or change a kernel package: layout, strict TS profile, rung requirements, exports, changesets.
---
# Package development

**Layout.** `packages/<pkg>/src/<Export>.ts` one export per file · `index.ts` re-exports only · `conformance/` (read-only to you) · `test/` properties and examples · `unsafe/` the only place for casts, `any` and suppressions in code that runs, each inside `unsafe(reason, () => ...)` whose reason (8 words or more, E1760) states the invariant that makes it safe and where it is enforced; a call holding none of them is S0014 (a runtime technique with no type escape is ordinary code in `src/`, its hazard in a comment); the file's other lines are checked as app code · `test/<name>.test-d.ts` or `conformance/<name>.test-d.ts` a negative type test, described `@ts-expect-error` lines, type-checked by `check`, never run or imported (E1761).

**Procedure.** `pnpm spec` (the areas), `pnpm spec <area>`, `pnpm spec <id>` (`--for <code, name or term>` finds one) -> read the conformance suite's test names (not bodies) -> implement smallest slice -> `pnpm check` -> `pnpm test --filter <pkg>` -> property tests for every exported pure function -> `pnpm mutate --filter <pkg>` if touching schema/reactive/store/router -> changeset -> update README contract.

**Output.** Any logging uses `@keel/tooling/output`. No `console.log`.

**Done.** Conformance green, properties present, mutation at threshold, ledger not regressed, README updated.
