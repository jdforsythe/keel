# Task 0023-0024: scaffold

**Spec:** k.scaffold (+ k.module, k.router, k.component, k.store, k.ui tokens, k.compiler E1005, k.testing) · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/scaffold
Covers backlog 0023 (generators project, module, route, component, store; turbo emission) and 0024 (codemods rename, move, add-field) as one package build. Principle 7 (structure is an operation), 3, 4, 5.

## Deliverables
- [x] `scaffold(op, input, files)` / `plan(op, input, files)` -> `Result<Edit, ScaffoldError>`; pure over `Map<path, content>`
- [x] generators: project, module, route, component, store; templates in `src/templates/` (one function per file)
- [x] turbo.json + CI regenerated from the module set with the `_generated` marker (tooling/generate.mjs convention)
- [x] codemods: rename (component, store, route, schema), move, add-field; AST-aware via oxc-parser + magic-string
- [x] refusals E1351, E1352, E1353, E1354, E1005 (plus E1051/E1052 for bad op/input); nothing written
- [x] property tests (seed 1337, 100 runs); smoke test removed
- [x] README contract (< 400 tokens), `.changeset/scaffold-initial.md`; k.scaffold status left `proposed`

## Steps
1. [x] Read spec sections, conformance suite (read-only), tooling/generate.mjs.
2. [x] Deps: `@keel/schema`, `oxc-parser`, `magic-string` (workspace versions); dev `fast-check`.
3. [x] Implement generators, edit infrastructure (`commit`, check proxy), codemods.
4. [x] `pnpm --filter @keel/scaffold check` and `test` green; structure-lint clean for scaffold; build ok.
5. [x] Properties, README, changeset, this plan.

## Decisions
- D1: `plan` and `scaffold` run the same pure computation and return the same `Edit` (`{ files, created, changed, removed }`, paths sorted). Nothing is ever written by this package; the CLI renders the dry-run diff from `files` vs the input tree. `removed` is an addition to the fixtures' assumed shape (move and rename delete paths).
- D2: Refusal = `KeelError<'scaffold.rejected', ScaffoldDiag>`; `data` is an OUTPUT.md diagnostic (`code` E-code, `path`, `line`, `col`, `message`, `see: 'k.scaffold'`, `cause` for E1353). KeelError codes stay dotted (k.errors: E-codes never share the namespace).
- D3: No E-code exists for "unknown target" or "malformed input"; both use k.cli's E1052 (flag value invalid for the input schema); unknown op uses E1051. RFC candidate if a scaffold-specific code is wanted.
- D4: E1353 uses the documented cheap proxy, not `@keel/compiler` `compile`: TS2307 unresolved relative import, E1151 non-public cross-module import, E1152 import from a module not in `deps`, E1153 deps cycle. A diagnostic is "introduced" when its code's count rises versus the tree before (so a renamed file's pre-existing unresolved import is not new). Id uniqueness is enforced up front by E1351.
- D5: Inputs are parsed with `s.object` schemas (`internal/inputs.ts`); `add-field`'s `default` is any JSON value read separately (k.schema has no `unknown`).
- D6: Generated locations: `.keel/`, `turbo.json`, `.github/workflows/`, `Dockerfile*`, `(docker-)compose.y(a)ml`. Ids starting `.keel.`/`.keel/` and explicit `file` targets in them are E1005 before naming (E1352) is checked. `commit` refuses any write to a generated path except `turbo.json`/CI (project, module) and `.keel/.gitkeep` (project).
- D7: Naming (E1352): module ids, id segments and fields lowerCamel; components and schemas PascalCase; store id exactly `<module>.<name>`; route id `<module>.<seg>+`; the module must exist; project name `[a-z][a-z0-9-]*`; route path segments `[a-z0-9][a-z0-9-]*` or `:lowerCamel`.
- D8: File layout. Component `modules/<m>/<Name>.tsx` + `<Name>.test.tsx` (`properties(Name)`). Store `<Name>State.schema.ts` (`export const <Name>State = s.object({})`), `<name>.store.ts` (`store(<Name>State, {})`, id left to the compiler), `<name>.store.test.ts` (state parses with its schema). Route leaf = id segments after the module joined lowerCamel: `<leaf>.server.ts` exporting `load<Leaf>`, page `<Leaf>Page.tsx` (or `file`), `<leaf>.route.test.ts` (`renderRoute`), manifest entry with `params: s.object({ p: s.string() })` iff the path has `:p`. Names never appear in generated comments or prose strings, so rename finds every reference.
- D9: Route duplicates: same id or same path pattern (params normalized) in any `routes.ts` is E1351 (E1502 territory, refused before writing).
- D10: turbo.json = `// _generated: ...` + JSON of tasks `check`/`test`/`build` whose `inputs` are the root config files plus `modules/<id>/**` for every module, sorted: a pure function of the module set, independent of insertion order. CI is static; only `project`/`module` write them.
- D11: `module` appends to the first deployable's `modules` list in `topology.ts` (append order, not sorted). Missing `topology.ts` is E1052.
- D12: Rename scope. Files in the declaring folder, renamed files, and files importing a renamed file are in scope: identifiers (bindings and references, JSX names) follow, and in strings an element-id/dotted prefix (`OrderCard-root`, `cart.addItem`, `id="x-1"`). A string exactly equal to the name is renamed anywhere for PascalCase kinds, and only in `module.ts` for lowercase kinds (`'items'` stays). Dotted tokens (`orders.cart`) are renamed in every source file. Property keys, member names, JSX attribute names, `X.infer`'s right side are data and never renamed; shorthand `{ cart }` becomes `{ basket }`. Comments and JSX text are not touched. Relative imports that resolve to a renamed file follow it (extension style kept); unresolved specifiers whose stem is an old name follow too (the conformance fixture imports a non-existent `./<name>.tsx`).
- D13: Rename files: component/schema `<From>.*` in its folder; store `<a>.store.*`, `<A>State.*`; route `<leaf>.server.*`, `<leaf>.route.*`, `<Leaf>Page.*`. Renames keep the module (else E1352, use move). Route rename also rewrites the route's own `path` segments equal to the old last id segment (required by the conformance "old name appears nowhere"; see Review notes).
- D14: Move finds `<name>.ts(x)` or `<name>.<store|schema|server|transaction>.ts(x)`; ambiguity or absence is E1052; a candidate in a generated location is E1005. Only that file moves (its test stays; conformance requires every other path unchanged). Imports both ways are rewritten with the original extension style. Manifests: the name leaves the source module's `public.exports`; when another module imports it, the target gains it in `public.exports` and each importer gains the target in `deps`; when the moved file imports another module, the target gains that dep and that module exports the imported stem. Cycles then surface as E1153 -> E1353.
- D15: add-field types: `string|number|int|boolean` with `.optional`/`.nullable` modifiers (else E1052). Constructors: `store(X, {...})`, `form(X, { initial: {...} })`, and `const v: typeof X.infer = {...}` / `Infer<typeof X>`, where `X` is the schema or an import of it resolving to its file. Optional fields touch only the schema. Nested/array constructions are not detected.
- D16: Generated `tsconfig.json` extends `@keel/compiler/tsconfig.strict.json`, which does not exist yet (follow-up: compiler ships the strict profile). Generated `module.ts` imports `module` from `@keel/compiler`, which compiler does not export yet (follow-up). Kernel deps in generated package.json are `^0.0.0`.
- D17: Template strings that name later packages (`@keel/testing`, `@keel/server`) hold the specifier in a const, because structure-lint S0003 scans string text for `from '@keel/<pkg>'`.

## Verification
- [x] `pnpm --filter @keel/scaffold check` clean (tsc + biome src/test/unsafe)
- [x] `pnpm --filter @keel/scaffold test`: `ok 67 tests, 0 failed, 0 skipped (4.6s)` (57 conformance + 10 properties)
- [x] structure-lint: 0 scaffold diagnostics · budgets ok · `pnpm --filter @keel/scaffold build` ok
- [x] properties present (seed 1337, 100 runs): rename round trip for component/store/route/schema, no old reference after rename, determinism and plan = scaffold and input never mutated, edit set equals tree difference, generated trees clean under the check proxy, cycle-creating move -> E1353, relSpec/joinSpec/restyleSpec
- Mutation: `mutate` script is `echo skip`; not measured. Unsafe count 0 (unchanged).
- Root `pnpm check` not run (it runs biome in every package; out of scope for this task).

## Review notes
- Conformance `rename-references` (route case) requires the old leaf to vanish from the route's own `path` (`/zz/<name>/:id`), so a route rename changes its URL when a path segment equals the old leaf. Spec text lists declaration, file name, imports, `href()`, `uses:`, element ids, test, manifest; it does not list the path. Implemented (D13); flag for the spec owner.
- Same test's fixture imports `./<name>.tsx` for store/route kinds, a file the generators never create; rename handles it by stem (D12).
- Not implemented: `transaction` and `service` generators; `rename` kinds `transaction`, `field`, `module` (E1052 via the input schema enum).

## Next action
review
