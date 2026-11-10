# RFC 0077: `routeLiterals` reads a spread of a `deps` package's routes

Status: accepted (ADR-0066, 2026-11-10). Applies WORKFLOW RFC default 1 (a stdlib need that exposes a kernel gap is met by a kernel change), default 2 (one way per thing) and default 3 (reuse the existing execution path). No app-facing API changes.

## Problem
`keel check` compares a `routes.json` beside a `routes.ts` with the literals `routeLiterals` reads from the manifest, without running it. Any spread in the manifest object opens the id set: the routes read before it are unread and the spread is named `<file> ids`, so the check reports W1005. A stdlib package ships its routes as a `routes` export the app spreads, as `apps/sessions/modules/ops/routes.ts` does with `...sessions.routes` from `@keel/std-sessions/routes`. Every app that mounts std routes warns W1005 on a clean `routes.json`, and the routes before the spread lose their E1005 comparison.

## Proposal
A spread `...x.routes` in a manifest object, where `x` is `routes` imported by name from a package the module lists in `deps` (`modules/<m>/module.ts`, read statically), reads as that export's literals. The compiler resolves the import specifier from the module's folder with the resolver the std import step already uses (the first `node_modules/<pkg>/package.json` in the folder or an ancestor, then its `exports` by the conditions `node`, `import`, `default`), parses the file it names, and reads `export const routes = manifest({...})` there by the same rule as the app's own manifest: literal ids, `path`, `layout`, guard `redirect` (declared there or imported from a relative module of the package), and the verbs of `routes.actions({...})` in that file. A project file that reads `actions` off the imported binding unreads those actions, as it does for a project manifest. Fragment ids join the table in source order, so a later entry overrides an earlier one, as object spread does.

Any other spread keeps the id set open: a package not in `deps`, a binding not imported from a package, an export that is not a literal manifest, a specifier that does not resolve, or a spread inside the fragment. W1005 then names the spread by its source text (`modules/ops/routes.ts ...sessions.routes`) instead of `<file> ids`. `routeLiterals` takes a `root` option, the directory the file paths are relative to, which defaults to `process.cwd()` as `check()`'s own `root` does.

The compiler reads the package's files and never imports or runs them.

## Alternatives
- **Read a `routes.json` the package ships.** A second source for the same table (default 2): the package would have to generate and publish it in step with its `routes.ts`, and `@keel/std-sessions` ships none. Rejected.
- **Accept both the source and a shipped `routes.json`.** Two ways to read one fragment. Rejected under default 2.
- **Evaluate the app's `routes.ts` in `keel check`, as the build does.** `keel check` reads without running app code. Rejected.
- **Resolve with `createRequire().resolve`.** A second resolver whose `require` condition can pick a different file than the import the std step and the build perform. The existing resolver is reused (default 3).
- **List the std routes again in the app's manifest, or tolerate W1005 in std-mounting apps.** An app workaround for a kernel gap. Rejected under default 1.

## Spec diff
- **k.compiler** Artifacts, `routes.json`: adds "`...x.routes`, `x` a `deps` package's `routes` export, reads as its literals." **Conformance** adds "`...x.routes` of a `deps` package reads its literal routes; of another package it is W1005."
- Wording that keeps the section within its token budget, with no change in meaning: the E1002 entry drops its RFC citation; the Rules list drops the E1006 entry, which Build-time evaluation defines; the E1004 parenthetical, the E1501 sentence, the `a11y.json` "Name From" phrase and the Build-time E-code sentence are shorter.

## Conformance diff
- Added `packages/compiler/conformance/route-fragment-spread-0077.test.ts`.

## Migration
None. An app that spreads a `deps` package's `routes` export loses its W1005 line; a `routes.json` that differs from the package's literals reports E1005, as a difference in the app's own literals does.

## Token impact
k.compiler gains 25 words in the rule sentence and the clause and loses as many characters elsewhere. It measures 1,500 tokens, at the section limit.
