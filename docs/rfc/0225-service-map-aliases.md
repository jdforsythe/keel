# RFC 0225: k.bundle: the service map and E1011 stated, and an aliased import of a module file is E1013

Status: accepted (ADR-0247), accepted by the orchestrator on 2026-11-24. Amends k.bundle (Service map, Aliases, Rules, Conformance), the map. Backlog 1006.

## Decisions
- D1: k.bundle states the service map and E1011 as built: what the map holds, what the scan follows, when the client build fails, the message, and where it is not reported.
- D2: an aliased import of a file under `modules/` is not a supported way to import it. A file under `modules/` is imported by a relative specifier; `keel check` reports any other specifier that resolves there as E1013, with a fix that writes the relative one. A `#` specifier is already E1576 (k.security) and gets that one finding, not E1013 too.
- D3: the scan stays relative-only. E1013 is a check error, so `keel build` stops at its check step (k.boundary Build gate) before bundling. On a tree `keel check` passes, the one input that reaches E1011 is a computed `import()` (W1608, a warning), whose files the bundler finds by glob and the scan does not follow. E1011 stays the build's backstop for that, and the conformance reaches it that way.
- D4: E1013 takes the next free code in k.bundle's `E100x` block (E1010 and W1012 are taken).

## Problem
E1011 has one line in k.bundle Rules and unit tests in `packages/compiler/test` (`clientServiceMap.test.ts`, `calledModules.test.ts`). Its conformance file (`packages/compiler/conformance/e1011-client-service-map.test.ts`) had to assume what "mapped" means: the spec never says what the map holds, what the scan follows, when the rule fires or what it prints.

And an aliased import of a server module ends in E1011 where it could have been mapped. What exists:
- `calledModules` (`packages/compiler/src/internal/calledModules.ts`) walks the client's own module folders and follows relative specifiers only, before bundling; the entry is generated from its result. After bundling, `unmappedModule` fails the build for a file of a `node` or `static` module the map omits.
- `keel check`'s module rules resolve relative specifiers and `@keel/std-*` only (`resolveImport`, `packages/check/src/internal/modules/resolveImport.ts`). An import through a symlinked or workspace-linked package resolves in the type check and in Vite and passes E1151, E1152 and E1165 unseen (a `#` alias is already E1576): it reaches a private file of a module not in `deps` with `keel check` green.
- `keel check`'s type check uses Keel's own compiler options and reads no `tsconfig.json`, so a `paths` alias (`@/notes/lib.ts`) is already E1751 (TS2307). `keel review` rates a changed `tsconfig*.json` critical (R1103). No app, example or scaffold output uses an alias of any form; `keel explain E1011` already gives `import '@/api/x' -> import '../api/x'` as the fix.

So mapping aliases from the resolved graph would make the service map see an edge the module rules do not, and would legitimize a second way to import a module file.

## Proposal
### The service map (as built)
A `client` deployable's entry, when the topology has a `node` deployable, maps the client's own modules, each `node` or `static` module the scan reaches, and each placed module with no folder (a stdlib module). The scan starts at every file under the client's module folders and follows relative specifiers of `import`, bare `import`, `export … from` and literal `import()`: not type-only ones, comments, computed imports or anything else; it tries the name, then six extensions, then `index.<ext>`, and never reads a server-only file.

### E1011 (as built)
After bundling, a `client` deployable's build fails, exits 1 and writes nothing, when its graph holds a file of a `node` or `static` module outside the map that is not server-only by name nor a stub. One line, no position, no fix:
```
E1011 notes is not in the client's service map: imported by modules/app/Page.tsx
```
Of several such files, the first by absolute path; the importer is the first the bundler records. `keel check`, `keel dev` and other builds report none.

### E1013
`keel check` resolves every non-relative, non-`#` specifier of an `import`, `import type`, `export … from` or literal `import()` in E1576's files (outside `packages/`, `node_modules/` and `.keel/`, tests included; query stripped) as its type check does: bundler resolution, package `exports`, `node_modules` upward, symlinks followed to the real path, no `tsconfig.json`. One landing under `modules/` is E1013 at its opening quote:
```
E1013 modules/app/Page.tsx:1:21 'linked-notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../notes/lib.ts'
  fix: replace the specifier with '../notes/lib.ts'
```
By form: a workspace link or `node_modules` symlink, the project's own name through `exports`: E1013. A `#` specifier: E1576 alone, which forbids every `#` specifier in app code. A `tsconfig.json` `paths` or `baseUrl` alias, a root-absolute `/modules/...`, a Vite `resolve.alias`: nothing resolves, so E1751 (TS2307), as today. A specifier landing outside `modules/`: nothing. E1013 is an error, so `keel build` stops at its check step with it, and E1011 is reached only by a computed `import()`.

`keel explain E1013`:
```
E1013 a specifier other than relative reaching a file under modules/
Module rules (E1151, E1152, E1165), codemods and the client's service map read relative specifiers; an alias walks past all of them.
import 'linked-notes/lib.ts' -> import '../notes/lib.ts'
```

## Alternatives
- **Map aliases from the resolved graph (the backlog line's suggestion).** The entry is generated before bundling, so this needs Vite's resolver run ahead of the build or a second pass; and the module rules would still not see the import. Two ways to import a module file, one of them unchecked.
- **Teach `resolveImport` and the scan every alias form.** Same second way, plus reading `tsconfig.json` (R1103-critical config) to honour `paths`.
- **Report the alias as E1152 or E1151.** Those mean a missing `deps` entry or a private export; an alias into one's own module is neither.
- **Report a `#` alias as E1013 beside E1576.** Two findings for one specifier; E1576 already forbids every `#` specifier, so E1013 adds nothing a fix could act on.
- **E1011 as an internal invariant tested through a hand-made graph.** A computed `import()` reaches it from app source on a tree `keel check` passes, so the rule has a real input and its conformance builds a project.

## Spec diff
Applied in this commit.
- k.bundle (to `implemented` until its new clauses are covered): new Service map (map, scan, E1011) and Aliases (E1013) paragraphs; Rules rewords E1011 and adds E1013; Conformance gains six bullets (#8 to #13).
- Map: the k.bundle row reads `implemented`. `E100x` already names k.bundle.
- No glossary term is added.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/compiler/conformance/e1011-client-service-map.test.ts`: the three E1011 bullets (#8 to #10), reaching E1011 through a computed `import()`; a linked import now stops at E1013.
- `packages/check/conformance/bundle-E1013-aliased-import.test.ts`: #11 to #13 through `keel check` on file trees on disk (symlinks and `package.json` `exports` need a real tree).
- `packages/cli/conformance/bundle-E1013-build.test.ts`: #11's `keel build` sentence (exit 1 with E1013, no E1011).
- `packages/check/conformance/fixtures-by-code.ts` and `fix-diffs.test.ts`: an E1013 fixture and its fix.
No std package is needed; both packages are kernel.

## Migration
None. No app, example or fixture in the tree uses an alias into `modules/`.

## Token impact
- k.bundle grows from about 1,520 to about 3,010 tokens (of 3,100). The map is unchanged in size.
- `keel explain E1013`: one catalog entry, under the 300-token budget; `@keel/check/explain` may need a re-base.
- `@keel/check` or `@keel/compiler`: one resolution per non-relative specifier; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the six clauses. 3. Build:
- E1013 in the pass that reports E1010 in `keel check` (`packages/compiler/src/compile.ts`, beside `miscasedImports.ts`) or in `packages/check` beside `moduleChecks.ts`, resolving with TypeScript's `resolveModuleName` under `tsCompilerOptions()`; `PIPELINE_CODES.ts` and `EXPLANATIONS.ts` gain E1013; E1011's explanation names E1013.
- The E1011 unit test `an aliased import maps nothing` stays; the conformance header changes.
- Docs: the `keel` skill's code list, the `@keel/compiler` or `@keel/check` README, a changeset, `tasks/BACKLOG.md`.

## For the operator
1. **Aliases into `modules/` are a check error, not mapped.** Recommended: yes; the module rules cannot see an alias, and one way to import a file keeps the map, the rules and the codemods agreeing.
2. **E1013 covers test files and own-module aliases.** Recommended: yes; one way everywhere, and the fix is mechanical.
3. **A `#` alias is E1576 alone.** Recommended: yes; one finding per specifier.
4. **Not changed:** the scan does not follow `new URL(<literal>, import.meta.url)` or a `?worker` specifier, so a module reached only through a worker file is unmapped. A follow-up line if wanted.
