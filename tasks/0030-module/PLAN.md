# Task 0030: module manifest and cross-module check

**Spec:** k.module (+ k.check project pass, k.compiler `module()`/`ModuleSchema`) · **Gate:** G2 · **Branch:** jdforsythe/test-impl · **Package:** packages/check (+ packages/compiler)

## Deliverables
- [x] `@keel/check` module pass `src/internal/modules/`: discover manifests, map files to modules, read `module({...})` statically (oxc, literal objects only)
- [x] rules E1151, E1152, E1153, E1154, E1155, E1156, E1157; fixes for E1152 (add dep), E1154 (remove entry), E1156 (add capability)
- [x] `explain` entries for E1151-E1157 (already in `EXPLANATIONS.ts`, spec-derived; unchanged)
- [x] `ModuleSchema` enforces lowerCamel `id`; `module()` returns the manifest unchanged (frozen)
- [x] example and property tests (seed 1337); README (check, compiler); `.changeset/check-modules.md`; k.module status `implemented` (section + map row)

## Steps
1. [x] conformance present (commit 0d4ad6a): packages/check/conformance/module-*.test.ts + module-support.ts, packages/compiler/conformance/module-manifest.test.ts (read only).
2. [x] Compiler: `ModuleSchema` wraps the `s.object` shape and adds the id rule to parse/decode/decodeStrings/encode; `module()` drops its own id check. Conformance 7/7.
3. [x] Check: module pass wired into `check()` project passes after E1454. Module conformance 31/31 first run.
4. [x] Tests: `test/modules.test.ts` (fixes via git apply, re-exports, dynamic import, opaque manifest, test files, long ids), `test/modules.property.test.ts` (joinPath, E1154 fix-until-clean, unrelated files invariant); compiler `test/module.test.ts` ModuleSchema id rule on every entry point.
5. [x] Dogfood: golden-1 `modules/todos` reports no E115x.
6. [x] README, changeset, spec status flip, this plan.

## Decisions
- D1: The module checks are one project pass (`moduleChecks(checked)`), not registry rules: every rule needs cross-file facts (manifests, other modules' files and routes). Codes stay kernel E115x; the registry is untouched.
- D2: Discovery by path: app `(^|/)modules/<id>/module.ts` (key and id prefix = folder id); stdlib `(^|/)node_modules/@keel/std-x/module.ts` (key = package name, which is what `deps` lists; prefix = the manifest's literal `id`, else the package name). First manifest per key (by path) wins.
- D3: A manifest is read statically: default export `module({...})` (or a bare object literal), `as`/`satisfies`/parens unwrapped, string-literal arrays only. Anything else (spread, computed key, identifier) makes the module opaque: its files keep their module (E1155 still runs) but no rule reads its lists (no E1151/E1152/E1154/E1156/E1157 involving it as source of truth). Check does not run `ModuleSchema` on the static read: the conformance stdlib fixture uses id `@keel/std-auth`, which fails the lowerCamel rule, and schema validity is `module()`'s at build (it throws `keel.module`).
- D4: File -> module by longest folder prefix; test files (`isTestPath` on the module-relative path) and files outside every module are not checked.
- D5: Import resolution: relative specifiers resolve against the importer's folder; the export name is the target's file stem (principle 3, file = export). `@keel/std-x/<File>` resolves to the stdlib module by key; a bare `@keel/std-x` checks deps only. Import declarations, `export ... from`, and literal `import()` all count; type-only imports count.
- D6: E1151 and E1152 are independent: a non-public import from a module outside deps reports both (each has its own fix path).
- D7: Route ownership: the module whose `manifest({...})` (from `@keel/router`) declares the id, else the module whose prefix is the id's first segment; undeclared/unknown routes are ignored by E1152/E1157. Own-module `href()` is never E1157.
- D8: E1153: one diagnostic per strongly connected component of the deps graph (only deps naming discovered, non-opaque modules), at the manifest of the component's smallest key, pointing at the dep that starts the shortest cycle through it; message `module deps cycle: a -> b -> a`. A self-dependency is a cycle.
- D9: E1154 exports exist when a non-test file of the module has that stem; routes exist when the module declares them in `manifest({...})`.
- D10: E1155 sources: `manifest({...})` keys, `store(..., { id })` (last object argument), `transaction(x, 'name', ...)`, `s.error('code', ...)`; callees count only when imported from `@keel/router`/`@keel/store`/`@keel/schema`. Prefix test is `startsWith('<prefix>.')`.
- D11: E1156: any non-computed `ctx.<name>` on an identifier named `ctx`, plus `const { name } = ctx`; reported once per file and capability (first use). `ctx` members are all capabilities (k.ctx: kernel four plus registered ones), so no allow-list.
- D12: Fixes are unified diffs of the manifest even when the diagnostic is in another file (git-applicable by path). Added entries copy the first entry's quote style. No fix when the list is absent from the manifest.
- D13: Messages: ids and names clipped to 28 chars, whole message clipped to 89; all cite `see: k.module`.
- D14: `ModuleSchema` id rule failure is a `schema.invalid` with one issue `{ path: ['id'], rule: 'type' }` (the closed `Rule` set has no pattern rule) and message `id "x" is not lowerCamel`.

## Verification
- [x] conformance: check module suites 31/31, compiler module-manifest 7/7 (38 module tests; the brief's 41 did not match the files present)
- [x] `pnpm --filter @keel/check check` clean; `pnpm --filter @keel/compiler check` clean; structure-lint, docs-freshness, budgets, generate --check ok
- [x] properties present (check `test/modules.property.test.ts`, seed 1337; compiler conformance properties)
- Unsafe count unchanged (check 1, compiler unchanged); no casts or non-null assertions.
- Mutation not run (check/compiler are not in the mandatory mutate list of keel-package-dev).
- Root `pnpm check`/`pnpm test` not run: other tasks' uncommitted work is in the tree (one transient `tsc` failure from a concurrent runtime-dom edit; reruns clean). Biome restricted to check and compiler src/test.
- Conformance believed wrong: none. Note: the stdlib fixture manifest id `@keel/std-auth` would fail `ModuleSchema` (lowerCamel), so a real stdlib manifest must use a lowerCamel id; the check pass keys stdlib modules by package path, not by id (D2, D3).
- BACKLOG 0030 left unchecked pending review.

Test trailers: `pnpm --filter @keel/check test`: `ok 157 tests, 0 failed, 4 skipped (16.4s)` · `pnpm --filter @keel/compiler test`: `ok 99 tests, 0 failed, 1 skipped (4.1s)`

## Next action
review
