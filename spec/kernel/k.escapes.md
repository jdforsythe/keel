# k.escapes: Escape codes
status: conformance-covered

**Purpose.** The findings `keel review` reports (k.review): each code, its danger, and what it reads. A file is read by syntax, as `keel check` reads it; a range code reads the changes between `<base>` and `<head>`. A test file is `*.test.*` or `*.spec.*`, or under `test/`, `tests/` or `__tests__/`; a server file is named `*.server.*` or `*.guard.*` (k.boundary's server-only names); app code is k.check's. A finding's text (its `id`, k.review) is the source of the node its row names; of a JSON or YAML entry, its key and value as written; of a whole file, empty; of a range code, its message. A call is one whose callee is that name.

**Codes.**
| code | danger | finding |
|-|-|-|
| R1001 | medium, opt-in | `unsafe(reason, fn)` |
| R1010 | opt-in | each entry of `origins` in `topology.ts` (`origins: { img: { 'https://img.cdn.example': 'photos' } }`, k.origins): `connect`, `frame` high; `img`, `media`, `font` low; the value its reason |
| R1011 | high, opt-in | an `allow` property of the object a `createApp(` call takes, or the word `KEEL_ALLOW_ORIGINS` in a tracked file but Markdown |
| R1012 | high, opt-in | a `reveal` call |
| R1014 | high, opt-in | a `handle` property of the object an `identity(` call takes, or of `createApp(`'s `identity` object |
| R1050 | medium | a cast (not `as const`), `any`, `!` or ts-suppression comment outside app code: a test file, a `.d.ts`, a `*.config.*` file, or under `unsafe/` or `.keel/` |
| R1051 | medium | a comment that starts `eslint-disable`, `biome-ignore` or `oxlint-disable` |
| R1052 | critical | a string folded from literals, `+`, templates, `.join` or `String.raw` that starts, after any `//` or `/*` and spaces, `@ts-`, `eslint-disable`, `biome-ignore` or `oxlint-disable`; the outermost fold once |
| R1053 | critical | a module specifier not a string literal or a template without `${}`: `import()`, `require`, `new Worker`, `import.meta.resolve`; but an `import()` template starting `./` or `../` and ending in a file extension (std.messages' `load`), and `new Worker(new URL('<literal>', import.meta.url))` |
| R1055 | critical | a `@keel/*` specifier with a `src`, `dist` or `unsafe` segment, or a relative path into `node_modules/@keel/` |
| R1056 | critical | a non-literal key on `globalThis`, `window`, `self` or `global`, or an indirect `eval` |
| R1057 | high | in a server file or a test file: `process.env`, an import of `fs`, `net`, `http` or `https` (with or without `node:`, subpaths too), or a global `fetch` under `unsafe/`; `child_process`, critical |
| R1058 | high | a project's code file under `unsafe/` with no `unsafe(` call |
| R1059 | medium | `.only`, `.skip`, `.todo`, `.skipIf` or `.fails` on a test or suite in a test file |
| R1060 | medium | a deleted test file, or fewer calls of `expect`, `assert`, `test` or `it` (their members too) in a test file |
| R1061 | critical | a changed file under a `conformance/` folder |
| R1100 | critical | a range changing both a project's files and a `@keel/*` package's: `node_modules/@keel/`, or `packages/<name>/` unless its `package.json` names a package outside `@keel/`; one per range |
| R1101 | critical | an entry of `package.json`'s `overrides`, `resolutions`, `pnpm.overrides` or `pnpm.patchedDependencies`, or `pnpm-workspace.yaml`'s `overrides` or `patchedDependencies`; a `patches/` file; a tracked `node_modules/` file; a `pnpm-lock.yaml` `resolution:` holding more than `integrity`, or a `package-lock.json` or `yarn.lock` `resolved` not `https:` |
| R1102 | critical | a `preinstall`, `install`, `postinstall` or `prepare` script in a `package.json`, or a name in `onlyBuiltDependencies` or set `true` in `allowBuilds` (`package.json` `pnpm`, `pnpm-workspace.yaml`) |
| R1103 | critical | a changed `tsconfig*.json`, `biome.json(c)`, `.eslintrc*`, `eslint.config.*`, `.oxlintrc*`, `oxlint.config.*`, `vitest.config.*`, `vitest.workspace.*` or `vite.config.*`, or a `package.json` whose `scripts` changed |
| R1104 | critical | a changed `.github/` or `.githooks/` file |
| R1105 | critical | a changed `keel-review.json` |
| R1107 | high | a changed tracked file under `.keel/` or `dist/` |
| R1108 | high | fewer `.pii(`, `s.secret(` or `guard(` calls in a file the range keeps; one per kind |
| R1150 | critical | a tracked code file in scope that does not parse |
| R1151 | low | a baseline entry matching no finding |
| R2451 | opt-in: `'lost updates'` high, `'write skew'` medium | an `allow` property of the object a `.transaction(` call takes (std.postgres); `reason` its reason |


**Range codes.** R1060, R1061, R1100 to R1105, R1107 and R1108 are read from the range's changes to files in scope (R1100 also from `packages/` and `node_modules/@keel/`), each `new`; R1101 and R1102 only when their entry is not at `<base>`. Under `--all` only R1101 and R1102 are read, from the tree.

**Rules.** The codes above, each with its row's meaning; none carries a fix.

**Conformance.**
- In a fixture git repository each code of the table is reported on its fixture by a range and not on its clean twin; with `--all`, the range codes but R1101 and R1102 are absent.
- R1052 is one finding each for a TypeScript suppression directive folded from a template with a literal substitution, from `+`, from `.join('')` of two literals and from `String.raw`; none for `'@types/node'`, or for a string holding a directive after other text.
- R1053 is one finding each for `import(name)`, `require(a + b)` and `import(['vi', 'test'].join(''))`; `import('./a.ts')` and `` import(`./a.ts`) `` are none.
- R1050 fires for `x as T` in a test file, a `.d.ts`, `vite.config.ts` and `modules/m/unsafe/a.ts`; in `modules/m/a.ts`, where E1757 reports, it does not.
- A range changing `packages/compiler/src/a.ts` and `apps/x/modules/m/a.ts` is one R1100; one changing only the first is none.
- A lockfile entry moved to a `git+https:` or `file:` resolution is R1101; a `postinstall` in any tracked `package.json` is R1102.
- A tracked `.ts` file that does not parse is one R1150, and the other findings still print.
- A test file losing one `expect` call between `<base>` and `<head>` is one R1060; a test file renamed unchanged is none.
- A file kept by the range with one `.pii(` call fewer is one R1108.
