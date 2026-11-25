# RFC 0163: a Keel library: a package kind checked again by the app

Status: accepted (ADR-0185), confirmed by the operator on 2026-11-25; slices 1 (the library kind) and 2a (the app compiles and checks a library's files) built, slices 2b to 5 not yet. The library format is built before the public release and before the second part of k.parity (RFC 0169 Build B, which needs the library kind). Sections k.library and k.library-pack hold the contract. This is W15 step 4 of `tasks/p1/PLAN.md` and D49 of `tasks/0963-to-p1/PLAN.md`.

## Decisions
- D1: a library is a package whose `package.json` has `"keel": "library"` and a scoped name. Its root `module.ts` is a k.module manifest, unchanged: `public.exports` is its surface, `id` its prefix. A second manifest shape would be a second way (principle 1).
- D2: a library ships its source (`src/`, `unsafe/`) for the app's compiler and checker, and its `tsc` build (`dist/`) for what Node imports at check time (its entry and `./tools`). An `exports` entry lists a `keel` condition first, pointing at the source; the compiler and the type pass resolve with it.
- D3: an app lists a library in a module's `deps` by package name. An entry that begins with `@` names a package; any other names a project module. The libraries an app reads are found transitively through library manifests.
- D4: the app's compiler and `keel check` treat a library's files as the app's: a library file `<f>` reads as `modules/<id>/<f>` would, every rule runs, no `node_modules/` exclusion covers it, and the app cannot switch a rule off. Diagnostics are located at `node_modules/<name>/<f>` and carry no fix.
- D5: library elements take explicit, non-literal ids built from the component's `id` prop (E1161).
- D6: a library ships its own ledger file, `.keel/ledger.json` (k.ledger File), and no other manifest. The app counts `unsafe` and `hostElements` over the library's files, compares them with the shipped file for an installed library (E1162), shows the library's items under `evidence: 'library <version>'` and leaves them out of the app's rungs. The ledger file gains `libraries`.
- D7: `keel pack` is the library's gate (check, test, ledger write; E1164). `keel scaffold library @scope/name` writes one that passes it.
- D8: the stdlib packages are libraries in this format, so the kernel reads each by its kind and never by its name (RFC 0169, k.parity). Three named closed sets remain: shells, topology storage and the CLI command slots.
- D9: a library reaches only itself and other libraries (E1163), and its `id` is unique in the app (E1166).
- D10: app data stays a seam (D43). What the kernel gives `@keel/std-postgres` by name today, any package gets by the same means (k.server-deps): a manifest's `env` names the variables `deploy/compose.yaml` passes; the server build copies the files a bundled package reads beside itself through `new URL(<literal>, import.meta.url)`; and a file importing a library export that calls `register` counts as registering a capability under `keel dev`.

## Problem
These are the facts as the tree stands.
- **The compiler skips dependencies.** The Vite plugin's `relOf` (`packages/compiler/src/vite.ts:436-445`) returns null for any path containing `/node_modules/` and for any path outside the root, so a dependency's `.tsx` gets no Keel JSX transform, no style collection and no ids. A workspace-linked package resolves outside the root and is skipped in the same way; `linked` (`:447`) only re-evaluates such a file for the modules that import it.
- **`keel check` never reads `node_modules`.** The project walk's `SKIP` (`packages/cli/src/internal/readProject.ts:6`, applied at `:58`) excludes it. k.check's App code excludes `node_modules/`, E1757 (casts, `any`) exempts it, and E1576 (`packages/check/src/rules/noInternalEntry.ts:10`) exempts every file under `packages/`, `node_modules/` and `.keel/`.
- **The kernel tells a stdlib package by its name.** `importDeps` (`packages/compiler/src/std/importDeps.ts`) imports a `deps` entry's entry and `./tools` only when it matches `@keel/std-[a-z0-9-]+`, and reports E1159 otherwise. `stdInScope` and `ruleInScope` (`packages/check/src/internal/`) scope rules by that prefix; `stdModuleDir` finds a placed module's package by it; E1158 accepts a `std` key only for it; E1165 exempts it. 37 kernel `src/` files name `@keel/std-`. Any other package in `deps` reads as a module id the project lacks (E1165).
- **The stdlib publishes built files.** Every package's `exports` point at `./src/*.ts` for the monorepo, and `publishConfig.exports` point the tarball at `./dist/src/*.js` (`tooling/publish-exports.mjs`); `files` is `["dist", "docs"]`. Installed from npm, a stdlib package would give the app's compiler built JS it does not transform. Node also refuses to strip types from a `.ts` file under `node_modules`, so what `keel check` imports at check time must be built.
- **Six stdlib packages have a manifest.** `module.ts` at the package root exists for std-channels, std-health, std-jobs, std-schedules, std-sessions and std-workflows; the other 20 have none. A placed stdlib module's routes come from its `./routes` export (k.topology Route table).
- **Module ids can collide unseen.** `stdModuleDir` takes an app module `modules/<id>/` over a stdlib package with the same `id`, silently.
- **The counts stop at the app.** `buildLedger.ts` (`packages/cli/src/internal/buildLedger.ts:89-110`) counts `unsafe` and host elements in `packages/<pkg>/{src,unsafe}`, `apps/<app>/**` and a root `modules/**`. k.host-element Ledger already adds "each library's `hostElements` (k.library)", a section that does not exist.
- **Scaffold has no library kind.** `keel scaffold` has project, module, route, component, store, transaction, service and shell, and the codemods. There is no `keel pack`.
- **What already serves a library.** Custom components and `Part` are open to app code (E1822 is retired), `Host` and host code exist (k.host-element, k.host-code), k.module has `deps` use (E1165) and the module contract (k.contract), the check type cache reads `node_modules` declaration files (k.check-cache), and k.parity's first part made the stdlib's kernel imports public, but for the shell exception.

The result: a component published to npm today reaches an app unchecked, uncompiled and uncounted. The only safe way to share one is to copy its files.

## Proposal
k.library and k.library-pack hold the contract. Here is why each part has the shape it does.
- **Source the app compiles, built files Node imports.** The guarantees are properties of source as the app's compiler sees it: ids, atomic CSS against the app's tokens, a11y props, the boundary walk, no `any`. A built file would have to be trusted. The `keel` export condition names the source in the same `exports` map, so one import specifier serves both readers: the compiler and the type pass resolve `keel`, and Node resolves `default` when `keel check` imports the entry and `./tools`. Every package in the repository already builds `dist/`.
- **The manifest k.module already has.** A library is a module from the outside (`deps`, `capabilities`, `public.exports`, `id` as the prefix of its route ids, stores and error codes). Nothing new goes in it.
- **Package entries by the `@`.** Module ids are lowerCamel and never begin with `@`; a scoped package always does. The rule is visible in the source and needs no lookup to tell the two apart. Any npm user may publish under a scope, so it costs a library author nothing.
- **One reading, at one path.** The compiler and `keel check` read a library file `<f>` at `modules/<id>/<f>`, so ids, styles and every rule's scope come out as for an app module; the type pass and the module rules read it where it lies, since resolution and the manifest are the package's. The `.keel/` artifacts derive from the library's files with the app's, so no reader of one (E1702 through `a11y.json`, the inspector) sees less of a library than of an app module, and E1005 derives them from the same files. A bare import in a library file is the app's (it resolves from the library's folder, from the library's `dependencies`); only a relative path can reach into the app, so only that is E1163. E1161 judges what renders an element: `@keel/ui`'s base elements, `Host` among them, and `@keel/ui/aria`'s `Part`.
- **The app's reading, made exact.** Rather than list every rule, k.library says a library file `<f>` is read where a section reads `modules/<id>/<f>`, and that no `node_modules/` exclusion covers it. So E1757, E1576, k.boundary's reach, E1805 and the type pass hold over it with no further text. A diagnostic carries no fix, since the app does not edit `node_modules/` (k.module).
- **The ledger file is the manifest of evidence.** `keel ledger --write` already writes `unsafe`, `hostElements` and every export's rung. A second file holding the same counts would be a second way, so a library ships that file at `.keel/ledger.json`. The app recomputes the counts from the source it reads and compares them for an installed library (E1162), so the published file cannot understate them. A linked library (a workspace) has no published claim to compare.
- **The library's evidence is shown and not adopted.** The app's ledger lists the library's items, attributed to the version, and counts only the evidence the app ran (principle 11). `libraries` in the ledger file makes adopting or upgrading a library a visible ledger change, and its counts make a rise in `unsafe` an E1706 review.
- **Tokens come from the app.** A library's style props name tokens; the app's `tokens.ts` resolves them, and a name the app lacks is reported at the library's file as at the app's (k.ui). A list of token names in the manifest would state again what the source says.
- **Guarantees extend by reading, not by trust.** Personal data and secrets, the content security policy, accessibility, host elements, internal entries and detached scopes each run over library files. A library declares no origin (the app's `topology.ts` does), and its routes reach a deployable only when `topology.ts` places its `id`, so listing a library adds no route, no server code and no identity (principle: identity and server concepts cost nothing until the app opts in).
- **What a library may do.** Everything the stdlib may: register rules, formatters and a config schema through `./tools` (code that runs at check time, like any dev dependency), ship routes and a contract, declare format types, take `std` config. It reaches only its own files and other libraries (E1163), and its `id` is unique in the app (E1166).
- **The publish gate.** `keel pack` runs the library's own `keel check` against its `tokens.ts` fixture, `keel test` and `keel ledger --write`, and refuses with E1164 when one fails. `prepack` runs `keel pack --check`, so a package manager does not pack a library whose ledger is stale.

Worked example: RFC 0159's chart moves into a library `@acme/keel-charts`:
```ts
// module.ts
import { module } from "@keel/compiler";

export default module({
  id: "acmeCharts",
  deps: ["@keel/std-headless"],
  capabilities: [],
  public: { exports: ["AddedChart", "MonthCount"] },
});
```
```json
{
  "name": "@acme/keel-charts",
  "version": "1.0.0",
  "type": "module",
  "keel": "library",
  "exports": {
    ".": { "keel": "./src/index.ts", "types": "./dist/src/index.d.ts", "default": "./dist/src/index.js" }
  },
  "files": ["module.ts", "src", "unsafe", "dist", ".keel/ledger.json", "README.md"],
  "peerDependencies": { "@keel/compiler": "1.0.0", "@keel/ui": "1.0.0", "@keel/std-headless": "1.0.0" }
}
```
The chart's elements take ids `${props.id}.chart`, `${props.id}.data` and `${props.id}.table` (E1161). The app's `modules/stats/module.ts` lists `"@acme/keel-charts"` in `deps`, a page renders `<AddedChart id="stats.added" ... />`, and `keel check` compiles and checks the library's three files with the app's. The app's ledger gains `hostElements: 1`, the library's items, and `libraries: { "@acme/keel-charts": { version: "1.0.0", unsafe: 0, hostElements: 1 } }`.

## Alternatives
- **Ship built JS plus a signed claim.** The app would trust the claim, and ids and CSS built against tokens the library cannot know would not fit the app's tokens.
- **Ship only source.** Node refuses to strip types under `node_modules`, so `keel check` could not import the entry or `./tools` without a loader of its own.
- **A separate `keel-library.json`.** It held the counts and items the library's ledger file already holds; one file, written by one command, is enough.
- **Token names in the manifest (`library.tokens`).** A second statement of what the source says; the use site reports a missing token already.
- **Tell a package from a module by lookup** (a module folder first, then a package). An unscoped name could then mean either, and a typo reads as the other kind.
- **Count library rungs in the app's ledger.** Claims without evidence the app holds.
- **A registry or a signing service.** Out of scope: npm and the app's own check suffice.
- **Pack a library's docs for `keel docs`.** k.docs reads the `@keel/*` packages; opening it to libraries is additive and waits for a need (For the operator).

## Spec diff
- k.library (new, proposed, owner `@keel/cli`): Kind, In an app, Guarantees, Ids, Ledger, Rules (E1161, E1162, E1163, E1166), Conformance.
- k.library-pack (new, proposed, owner `@keel/cli`): Package, Own folder, Pack, Scaffold, Rules (E1164), Conformance.
- Map: rows `k.library | Libraries | proposed | packages` and `k.library-pack | Library publishing | proposed | pack`; the E115x owner cell names both.
- Glossary: **library**.
- k.server-deps (new, proposed, owner `@keel/cli`): Environment (`env` in a manifest), Files a bundled package reads, Registration through a library, Rules (E1167, E1014), Conformance. Map row `k.server-deps | Server dependencies | proposed | env`; the E100x and E115x owner cells name it. k.deploy's compose bullet and k.data Dev then hold by these means, with `@keel/std-postgres`'s manifest declaring `env: ['KEEL_POSTGRES_URL']`; their text drops the package name at the build, and k.deploy's existing `@keel/std-postgres` bullet keeps its wording.
- These sections are full or conformance-covered, so k.library states their changes and the build updates their text where it has room: k.module (an `@` entry names a library; E1159 reads "a package entry that resolves to no library"; E1158 and Std config read "library" for "`@keel/std-*`"), k.check App code and E1757 (no `node_modules/` exclusion for library files), k.ledger File (`libraries`), k.scaffold (`library`), k.cli (`pack`), k.security E1576 (k.parity Rules). Their existing Conformance bullets keep their wording unless the behaviour changes, which only k.security's `node_modules/@keel/std-x/a.ts` case does (slice 5, under RFC 0169).

E1161 to E1164 were held for this RFC and are still free in the code table; E1166 is the next free code in k.module's block.

## Conformance diff
The `conformance-writer` turns the Conformance lists of k.library and k.library-pack into tests under `rfc:0163`, slice by slice (Build order). Kernel packages never import a std package, tests included: fixture libraries are written into a temporary project's `node_modules/`, never a `@keel/std-*` package.

## Migration
None: nothing is released.

## Token impact
k.library about 2,480 tokens and k.library-pack about 1,090, of 3,110 each. The map grows two rows (`spec.map` re-based from 1,545 to 1,600, with k.server-deps) and the packed docs map two entries (`docs.map` re-based from 1,590 to 1,620). k.server-deps about 1,010 tokens, one more map row. The glossary gains one term.

## Build order
Clause numbers are 1-based Conformance bullets. Every slice leaves the main line green and mergeable; until slice 4 ends, a `@keel/std-*` package passes as a library by its name, so no stdlib package changes before its turn.

**Slice 1: the library kind (M).** Depends on nothing.
- Delivers: an `@` `deps` entry read as a package; the kind read from `package.json`; libraries found transitively and listed with their files (one helper, `libraryFiles`, that slices 2a and 2b share); every kernel gate that reads a stdlib package by name (`importDeps`, `stdInScope`, `ruleInScope`, `stdModuleDir`, `stdExport`, `stdRoutes`, `stdContract`, `stdPlacedExports`, E1158, `unusedDeps`) also passing a library; E1159 by kind; E1163's manifest half; E1166.
- Packages: `@keel/compiler` (`src/std/`, `src/internal/std*`), `@keel/check` (`src/internal/modules/`, `stdInScope`, `ruleInScope`).
- Clauses: k.library 8, 9, 10, 11, 12.
- Conformance: `packages/check/conformance/library-manifest.test.ts` (8, 9: `check()` over the fixture's files); `packages/cli/conformance/library-deps.test.ts` (10, 11, 12: `keel check` and `keel build` in a temporary project).

**Slice 2a: the app compiles and checks a library's files (L).** Depends on slice 1. Runs beside 2b.
- Delivers: the `keel` condition in the Vite plugin's resolution on dev, build and test, and in the type pass; `relOf` and the check's project read take library files, mapped to `modules/<id>/<f>` for every rule; locations at `node_modules/<name>/<f>` with no fix; E1757 and E1576 over library files; E1161; E1163's import half.
- Packages: `@keel/compiler` (`vite.ts`), `@keel/check` (`isAppPath`, rule scopes, the type pass), `@keel/cli` (`readProject`, `runCheck`).
- Clauses: k.library 1 to 7, 15 and 16 (the `keel` condition under `keel dev` and `keel test`).
- Conformance: `packages/cli/conformance/library-compile.test.ts` (1, 2, 4, 15, 16); `packages/check/conformance/library-rules.test.ts` (3, 5, 6, 7).

**Slice 2b: the ledger over libraries (M).** Depends on slice 1. Runs beside 2a.
- Delivers: `unsafe` and `hostElements` counted over library files, once for a library inside the project root; library item records; `libraries` in the ledger file; E1162 for an installed library.
- Packages: `@keel/cli` (`buildLedger`, ledger command), `@keel/check` (E1162 at `deps` entries).
- Clauses: k.library 13, 14.
- Conformance: `packages/cli/conformance/library-ledger.test.ts`.

**Slice 3: `keel pack` and `keel scaffold library` (M).** Depends on 2a and 2b.
- Delivers: the own-folder reading of a library; `keel pack` and `--check` (E1164) as a k.cli operation; `keel scaffold library`; `examples/library-charts/` (a scaffolded library with one `Host` chart) and `examples/library-app/` (an app listing it through a workspace link), both in `pnpm test`.
- Packages: `@keel/cli`, `@keel/scaffold`; `tooling/publish-exports.mjs` keeps a `keel` condition at its source path (its P0002 and P0003 read `src` as shipped).
- Clauses: k.library-pack 1 to 5.
- Conformance: `packages/cli/conformance/library-pack.test.ts` (1, 3, 4, 5); `packages/cli/conformance/library-scaffold.test.ts` (2).

**Slice 4: the stdlib on the format (pilot M, then L).** Depends on slice 3. The pilot is `@keel/std-headless` (widgets, ids from `id` props, no manifest yet). Then the other 25, in parallel lanes by group (data: db, postgres, offline, conflicts, channels, live; jobs: jobs, schedules, workflows, statecharts; ui: tables, messages, i18n, text, tokens, geo, money, temporal, timings; tools: brands, report, sessions, health; shells: capacitor, tauri).
- Delivers per package: `"keel": "library"`; a root `module.ts` where none exists, its `id` checked against every golden app's module ids (E1166); the `keel` condition in `exports` and `publishConfig.exports`; `files` gaining `module.ts`, `src`, `unsafe` and `.keel/ledger.json`; `prepack` running the build, `docs-pack.mjs` and `keel pack --check`; whatever the app's reading reports in the package (E1161, casts to `unsafe/`, E1801), fixed in the package. The golden apps' and examples' ledgers are written again, since their `unsafe` and `hostElements` now count the stdlib's. At the end: the `@keel/std-*` name pass of slice 1 is removed, so the kind alone admits a package.
- Clauses: none new; k.library's clauses hold over the stdlib.
- Conformance: none owed; the golden apps' `keel check` is the proof.

**Slice 4b: the app data seam (M).** Depends on slice 2a (library source is read). Runs beside slices 3 and 4.
- Delivers: `env` in `ModuleSchema` and E1167; the deploy files reading `env` over each deployable's modules and their libraries, in place of the `@keel/std-postgres` name in `packages/scaffold/src/deployFiles.ts`; the server build copying the files bundled package files read beside themselves (E1014), in place of `copyPgliteFiles` and `pgliteDist` in `packages/compiler/src/vite.ts`; `registersCapability` following an import into a library, in place of its `@keel/std-postgres` pattern; `@keel/std-postgres` gaining `module.ts` with `env: ['KEEL_POSTGRES_URL']` and a `./module` export if slice 4 has not reached it. Under the app's reading, std-postgres's `register(name, ...)` would be E1607; k.server-deps moves that check to the app's call of the export, at the argument.
- Packages: `@keel/compiler`, `@keel/scaffold`, `@keel/cli`, `@keel/std-postgres` (manifest only).
- Clauses: k.server-deps 1 to 5.
- Conformance: `packages/cli/conformance/server-deps-env.test.ts` (1, 2); `packages/cli/conformance/server-deps-files.test.ts` (3); `packages/cli/conformance/server-deps-register.test.ts` (4); `packages/check/conformance/server-deps-e1607.test.ts` (5). Fixture packages only; no std package imported.

**Slice 5: k.parity's second part (M).** Depends on slices 4 and 4b. This is RFC 0169 Build B.
- Delivers: the name gates of RFC 0169 items 3 to 8 and 11 become kind gates; E1207's four stdlib sites move to `unsafe/`; `tooling/deps.json` `names` and S0013; E1576's shell allowance over library files (k.security's `node_modules/@keel/std-x/a.ts` bullet changes under `rfc:0169`); the k.module, k.reactive and k.schema text of RFC 0169's Spec diff.
- Packages: `@keel/check`, `@keel/compiler`, `@keel/cli`, `@keel/scaffold`, the four stdlib packages with detached scopes, `tooling/structure-lint.mjs`.
- Clauses: k.parity 5 and 6, after which k.parity can be marked covered.
- Conformance: `tooling/test/structure-lint.test.mjs` (5, 6, by the build lane); `packages/check/conformance/parity-e1576-library.test.ts` (the E1576 allowance).

Parallel lanes: 2a beside 2b; 4b beside 3 and 4; slice 4's groups beside each other once the pilot merges. Slices 1, 3 and 5 are each one lane.

## For the operator
1. **Libraries must be scoped** (`@scope/name`) so a `deps` entry tells a package from a module by its first character. I recommend it: one rule, read without a lookup, free to every npm user.
2. **The ledger file replaces `keel-library.json`, and `library.tokens` is dropped.** Both stated again what an existing file or the source already says. Reverse to restore them.
3. **`./tools` runs a library's code at check time,** as the stdlib's does. Recommended and stated in k.library.
4. **No capability inheritance.** A library's `capabilities` hold its own code to E1156; a module listing it does not need them. Adding that is additive.
5. **No docs for libraries in `keel docs`.** A library documents itself in its README; opening k.docs to libraries is additive.
6. **Library rule codes share the stdlib's range** (E1753, E2xxx). A range of their own is in `tasks/FUTURE.md` (RFC 0169).
7. **Compile cost.** The app compiles library source on every build; the check type cache covers the type pass. I recommend measuring at slice 4 against the `keel check` budget before caching more.
