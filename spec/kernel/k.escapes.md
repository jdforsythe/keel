# k.escapes: Escape codes
status: proposed

**Purpose.** The findings `keel review` reports (k.review): each code, its danger, and what it reads. A file is read by syntax, as `keel check` reads it; a range code reads the changes between `<base>` and `<head>`. A test file is `*.test.*` or `*.spec.*`, or under `test/`, `tests/` or `__tests__/`; a server file is a server-only file (k.boundary).

**Codes.**
| code | danger | finding |
|-|-|-|
| R1001 | medium, opt-in | `unsafe(reason, fn)` |
| R1010 | opt-in | a declared origin: `connect`, `frame` high; `img`, `media`, `font` low |
| R1011 | high, opt-in | `createApp({ allow })`, or `KEEL_ALLOW_ORIGINS` in a tracked file |
| R1012 | high, opt-in | a `reveal` call |
| R1014 | high, opt-in | an identity `handle` |
| R1050 | medium | a cast, `any`, `!` or ts-suppression comment in a file E1757 does not read |
| R1051 | medium | an `eslint-disable`, `biome-ignore` or `oxlint-disable` comment |
| R1052 | critical | a string folded from literals, `+`, templates, `.join` or `String.raw` that starts `@ts-`, `eslint-disable`, `biome-ignore` or `oxlint-disable` |
| R1053 | critical | a module specifier not a string literal or a template without `${}`: `import()`, `require`, `new Worker`, `import.meta.resolve` |
| R1055 | critical | a `@keel/*` specifier with a `src`, `dist`, `unsafe` or `internal` segment, or a relative path into `node_modules/@keel/` |
| R1056 | critical | a non-literal key on `globalThis`, `window`, `self` or `global`, or an indirect `eval` |
| R1057 | high | `process.env`, a `node:fs`, `node:net`, `node:http` or `node:https` import, or global `fetch` in a server file or a test file; `node:child_process`, critical |
| R1058 | high | a project file under `unsafe/` with no `unsafe(` call |
| R1059 | medium | `.only`, `.skip`, `.todo`, `.skipIf` or `.fails` on a test or suite in a test file |
| R1060 | medium | a deleted test file, or fewer `expect`, `assert` or test calls in a test file |
| R1061 | critical | a changed file under a `conformance/` folder |
| R1100 | critical | a range changing both a project's files and a `@keel/*` package's (`packages/<name>/`, `node_modules/@keel/`) |
| R1101 | critical | `pnpm.overrides`, `resolutions`, `patchedDependencies`, a `patches/` file, a tracked `node_modules/` file, or a lockfile resolution not from the registry |
| R1102 | critical | a `preinstall`, `install`, `postinstall` or `prepare` script, or a name added to `onlyBuiltDependencies` |
| R1103 | critical | a changed tsconfig, biome, eslint, oxlint, vitest or Vite config, or a changed `package.json` script |
| R1104 | critical | a changed `.github/` or `.githooks/` file |
| R1105 | critical | a changed `keel-review.json` |
| R1107 | high | a changed tracked file under `.keel/` or `dist/` |
| R1108 | high | fewer `.pii(`, `s.secret(` or `guard(` calls in a file the range keeps |
| R1150 | critical | a tracked code file in scope that does not parse |
| R1151 | low | a baseline entry matching no finding |


**Range codes.** R1060, R1061, R1100 to R1105, R1107 and R1108 are read from the range's changes. Under `--all` only R1101 and R1102 are read, from the tree.

**Rules.** The codes above, each with its row's meaning; none carries a fix.

**Conformance.**
- In a fixture git repository each code of the table is reported on its fixture by a range and not on its clean twin; with `--all`, the range codes but R1101 and R1102 are absent.
- R1052 is one finding each for `` `@ts-${'ignore'}` ``, `'@ts' + '-ignore'`, `['@ts', '-ignore'].join('')` and `` String.raw`@ts-ignore` ``; none for `'@types/node'` or `'x @ts-ignore'`.
- R1053 is one finding each for `import(name)`, `require(a + b)` and `import(['vi', 'test'].join(''))`; `import('./a.ts')` and `` import(`./a.ts`) `` are none.
- R1050 fires for `x as T` in a test file, a `.d.ts`, `vite.config.ts` and `modules/m/unsafe/a.ts`; in `modules/m/a.ts`, where E1757 reports, it does not.
- A range changing `packages/compiler/src/a.ts` and `apps/x/modules/m/a.ts` is one R1100; one changing only the first is none.
- A lockfile entry moved to a `git+https:` or `file:` resolution is R1101; a `postinstall` in any tracked `package.json` is R1102.
- A tracked `.ts` file that does not parse is one R1150, and the other findings still print.
- A test file losing one `expect` call between `<base>` and `<head>` is one R1060; a test file renamed unchanged is none.
- A file kept by the range with one `.pii(` call fewer is one R1108.
