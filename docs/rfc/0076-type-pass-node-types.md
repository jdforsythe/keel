# RFC 0076: the type pass loads Node's types when the project has them

Status: accepted (ADR-0065, 2026-11-10). Applies WORKFLOW RFC default 1 (a gap in the kernel is met by a kernel change, not a workaround) and default 3 (one execution path). No app-facing API changes.

## Problem
`keel check` step 1 type-checks a project with no ambient `@types`. A node deployable's entry (`server.ts`) reads `process.env` and `import.meta.dirname`, and tests import `node:` modules, so those files need Node's types. Nothing in the kernel provides them: they reach the program only when some file imports a package whose own types reference `node`. The test runner did that for every project with a test, so the gap was invisible; a runner whose types no longer reference `node` turns every node entry into E1751 (`TS2591 Cannot find name 'process'`), while `tsc` on the same project passes because a `tsconfig.json` loads every visible `@types` package.

## Proposal
The type pass loads `@types/node` when it resolves from the project root (the root's `node_modules` or an ancestor's), and loads nothing else ambient. A project without `@types/node` has no Node types, and a file that uses them reports E1751, as any missing declaration does. The new-project template lists `@types/node` in `devDependencies`, so a new project has them.

The lookup is the TypeScript type-reference resolution from the root, so a project finds its own copy or one an ancestor directory holds.

## Alternatives
- **`/// <reference types="node" />` in each file that needs it.** Local, but every entry and every test that touches `node:` needs the line, existing apps need a migration, and nothing tells the author to add it except the E1751 it prevents.
- **Load Node's types only when `topology.ts` declares a node deployable.** A client-only project's tests read fixtures with `node:fs` and would fail the check.
- **Load every visible `@types` package, as `tsc` does.** The check would depend on whatever a workspace hoists; the type pass stays closed to one named package.
- **Keep relying on a dependency's types.** That is the defect.

## Spec diff
- **k.check** Pipeline step 1: "Parse (oxc) and TS strict type check." becomes "Parse (oxc) and TS strict type check. The only ambient types are Node's, loaded when `@types/node` resolves from the project root." **Conformance**: "A file reading `process.env` and importing `node:path` checks clean in a project whose root resolves `@types/node` and reports E1751 in one whose root does not."
- **k.scaffold** `project`: unchanged text; the `package.json` it names lists `@types/node`.

## Conformance diff
- Added `packages/check/conformance/node-types-0076.test.ts`.

## Migration
A project with a node entry or tests that use Node names lists `@types/node` in `devDependencies`; the apps in this repository do. A project created before this change adds `@types/node` to `devDependencies` if its check reports `TS2591` on a Node name.

## Token impact
k.check gains 34 words across the step and the clause; it stays under the 1,500 token section limit.
