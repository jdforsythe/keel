# RFC 0163: a Keel library: a package kind checked again by the app

Status: proposed (ADR-0185), for the operator to read before the freeze flip. The build waits until after the first real apps. This is W15 step 4 of `tasks/p1/PLAN.md` (designed here) and D49 of `tasks/0963-to-p1/PLAN.md`. Custom components themselves are RFC 0159.

## Decisions
- D1: a library is a package whose `package.json` has `"keel": "library"`. It ships source, never built files, together with a k.module manifest (`module.ts`), `keel-library.json` and packed `docs/`.
- D2: the manifest is the k.module one, adding `library: { tokens }`. `public.exports` is the library's surface. A second manifest shape would be a second way (principle 1).
- D3: `keel-library.json` is written by `keel pack`, never by hand (principle 7). It holds the surface, token names, `unsafe` and `hostElements` counts, the library's own ledger items, and the docs index.
- D4: the app's compiler and `keel check` treat a library's `src/` and `unsafe/` as app code, wherever the package resolves. Every rule runs, and the app cannot switch one off for a library. The counts are recomputed and compared (E1162). The app checks the guarantees again rather than trusting them.
- D5: library elements carry explicit ids built from an `id` prop. A derived id is E1161, because a path inside `node_modules/` changes with the installer and the version.
- D6: the library's ledger items appear in the app's ledger under `evidence: 'library <version>'` and are left out of the app's rung counts (principle 11: the app ran none of that evidence). Its `unsafe` and `hostElements` counts add to the app's, so adopting one is a reviewed ledger change (E1706).
- D7: `keel scaffold library <name>`, plus `keel pack`, which is the publish check. It refuses with E1164 when the library fails its own check, test or ledger. `prepack` runs `keel pack --check`.
- D8: the stdlib uses this format, with no power a library lacks. RFC 0169 decided it; section k.parity holds the rule and its closed exceptions, and says how E1106 and E1207 read a library's files.

## Problem
These are the facts as the tree stands.
- **The compiler skips dependencies.** The Vite plugin's `transform` calls `relOf` (`packages/compiler/src/vite.ts:313-321`). That returns null for any path containing `/node_modules/` and for any path outside the root, so a dependency's `.tsx` gets no Keel JSX transform, no `styles` collection and no ids. A workspace-linked package resolves outside the root and is skipped in the same way.
- **`keel check` never reads `node_modules`.** The project walk's `SKIP` (`packages/cli/src/internal/readProject.ts:6`, applied at `:50`) excludes it, as do `evaluateProject.ts:136` and `isSourcePath.ts:3`.
- **Some rules exempt `node_modules`.** E1822 (`packages/check/src/rules/ariaImport.ts:8`) and E1576 (`noInternalEntry.ts:10`) exempt a top-level `node_modules/`, so an outside package could import `Part` or an internal entry and no check would see it. RFC 0159 retires E1822. E1576 still exempts it.
- **The stdlib is source with no package manifest.** Its `exports` point at `./src/index.ts` (`packages/std-headless/package.json:6-11`). Stdlib widgets are written as `.ts` calling `Part` as a function, precisely because nothing compiles their JSX. The only manifests are k.module's `module.ts` (a stdlib package that ships routes or config has one, `packages/std-sessions/module.ts`) and the packed docs (`tooling/docs-pack.mjs`, `tooling/docs-owners.json`).
- **The unsafe count stops at the app.** `buildLedger.ts` counts `packages/<pkg>/{src,unsafe}` and `apps/<app>/` (`:23-24`, `:83-85`), so nothing in `node_modules` is counted.
- **Scaffold has no library kind.** It has project, module, route, component, store, transaction and service (`packages/scaffold/src/internal/run.ts:17-30`).

The result: a component published to npm today reaches an app unchecked, uncompiled and uncounted. The only safe way to share one is to copy its files.

## Proposal
k.library holds the contract. Here is why each part has the shape it does.
- **Source, not built files.** The guarantees are properties of source as the app's compiler sees it: ids, atomic CSS against the app's tokens, a11y props, the boundary walk, and no `any`. A built file would have to be trusted, and source can be checked again. Libraries are small, and the compile cost is paid once per app build, as for the app's own modules.
- **One manifest.** A library is a module from the outside (`deps`, `capabilities`, `public.exports`, its `id` as the prefix of its ids and stores), so it uses k.module's `module.ts`. The stdlib already ships that manifest where it needs one.
- **Token names in the manifest.** The app's `tokens.ts` is the only source of style values. A library states the names it needs, for example `color.accent` and `space.2`, so a missing one is reported once, as E1163, before any file is compiled. An agent reads the contract from the manifest without reading the code.
- **Counts recomputed.** `unsafe` and `hostElements` in `keel-library.json` tell a reader and an agent what they are taking on. The app's check recomputes them from the source it compiles, so the file cannot understate them (E1162).
- **The library's evidence is shown and not adopted.** The app's ledger lists the library's rungs so they are visible, attributed to the version. It counts only the evidence the app ran, so a library cannot raise the app's claims (principle 11).
- **The publish check.** `keel pack` is the library's gate: its own `keel check` against its `tokens.ts` fixture, `keel test`, and `keel ledger --write`. It packs the docs (the `docs-pack` step stdlib packages run as `prepack` today) and writes `keel-library.json`. It refuses when any step fails. A library that does not pass its own gate is never published by Keel's tooling.
- **Linked packages.** In this monorepo the golden apps reach the stdlib through workspace links outside the root. The compiler identifies a library by its `package.json` (`"keel": "library"`) at the real path, not by the path prefix, so linked and installed libraries are handled alike.

Worked example: RFC 0159's `AddedChart`, `addedChart` and `MonthCount` move into a library `@acme/keel-charts`:
```ts
// module.ts
import { module } from "@keel/compiler";

export default module({
  id: "acmeCharts",
  deps: ["@keel/std-headless"],
  capabilities: [],
  public: { exports: ["AddedChart", "MonthCount"] },
  library: { tokens: ["color.text", "color.accent", "size.chart", "space.2"] },
});
```
The chart's ids become `<id>.chart`, `<id>.data` and `<id>.table` from an `id` prop (E1161). The app then lists `@acme/keel-charts` in its module's `deps`, and `keel check` compiles and checks the library's three files. The app's ledger gains `hostElements: 1` and the library's items.

## Alternatives
- **Ship built JS plus a signed claim.** The app would trust the claim, and a build of ids and CSS against tokens the library cannot know would not fit the app's tokens.
- **A separate manifest file (`keel.library.ts`).** That is a second manifest shape for what k.module already says.
- **Count library rungs in the app's ledger.** This gives claims without evidence the app holds.
- **A registry or a signing service.** These are out of scope. npm and the app's own check suffice, and nothing in the design needs a Keel service.
- **Derived ids with the package name as the prefix.** A component rendered twice would still need an `id` prop to tell the two apart, and an explicit id is the stdlib's existing rule.

## Spec diff
- k.library is a new section (proposed): the kind, the app's treatment, ids, ledger, commands, and E1161 to E1164 (E115x block, k.module's range).
- The map gains a k.library row, and the E115x owner cell names it.
- The glossary gains **library**.
- These sections are full, so k.library states their changes and the build updates the section text when a section has room, or adds a pointer: k.module (`library` in the manifest), k.ledger (library items, counts), k.scaffold (`library`), k.cli (`pack`) and k.security's E1576 (no `node_modules/` exemption for a library's files, which are app code).

## Conformance diff
The `conformance-writer` turns the Conformance list of `spec/kernel/k.library.md` into tests under `rfc:0163`, in `packages/cli/conformance/` with a fixture library under the fixture app's `node_modules/`. It writes them when the build is scheduled, after the first real apps.

## Token impact
k.library is about 1,300 tokens. The map gains one row and the glossary one term.

## Build order
1. This commit: the RFC, ADR-0185, the spec and the glossary.
2. The stdlib packages take the format: each gains `"keel": "library"`, a `module.ts` where it has none, and `keel pack --check` in `prepack` in place of `docs-pack.mjs`; the `apps/*` ledgers then count the stdlib's `unsafe` and `hostElements`, both 0 as far as the build verifies.
3. After the first real apps: the `conformance-writer`, then the build:
   - the compiler's library detection and transform;
   - `readProject` reading library source;
   - the ledger;
   - `keel pack`;
   - `keel scaffold library`;
   - the stdlib in the format.

## For the operator
1. **The stdlib's extra powers.** Decided by RFC 0169: the stdlib reaches the kernel only through public entries, with a closed list of exceptions, in section k.parity. E1106 and E1207 read a library's files as a package's, as k.parity states. Nothing remains open here.
2. **`./tools` for libraries.** A library's `./tools` runs code inside the app's `keel check`. The stdlib has this power, so D49 gives it to libraries too. I recommend allowing it, stated in the docs as running the library's code at check time, like any dev dependency.
3. **Compile cost.** Compiling library source on every app build costs time. I recommend accepting it now and caching per package version later if `keel check` latency (its budget) shows the cost.
