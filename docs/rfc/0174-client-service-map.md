# RFC 0174: k.bundle, k.hosting: the client's service map names the modules it imports, and E1011 fails a build that reaches another

Status: implemented (ADR-0196).

## Decisions
- D1: the client entry binds `service({ contract })` targets only for the app modules of `node` and `static` deployables whose files the client's browser code imports by relative path, and for every placed module with no folder under `modules/` (a stdlib module, whose contract arrives by package). The names of other server modules are not in the browser build.
- D2: the entry reads the `keel-peer` tags whenever the topology has a `node` deployable, whether or not a module of it is in the map, so a stdlib module's call reaches its deployable's origin.
- D3: E1011 (error, client build) when a file in the bundled graph belongs to an app module of a `node` or `static` deployable that the map omits. The message names the module and the importing file. Stubbed and server-only files, and virtual modules, make no calls and are skipped.
- D4: the scan follows relative import specifiers only (`from './x'`, `import('./x')`, `import './x'`), through files that are not server-only; comments and type-only `import`/`export` are not read. An aliased, package-name or computed import of a server module is not mapped: it ends in E1011.

## Problem
The entry mapped every `node` deployable's module names. The map is embedded in the browser build, so a client that imported nothing from a server module still shipped its name, and `docs/THREAT-MODEL.md` listed the map among what a page learns. A trimmed map has the opposite risk: a file the scan missed reaches the bundle by another path, its `service({ contract })` call finds no target and goes to `http://<module>.keel.invalid`, and the failure shows only at run time.

## Proposal
`calledModules` (`packages/compiler/src/internal/calledModules.ts`) starts at each file of the client's own modules and follows relative specifiers to the `modules/<id>/` each file lands in. `entryCode` binds those, plus modules with no folder, grouped by deployable. After bundling, `unmappedModule` checks every bundled module id: a file of an app module placed in a `node` or `static` deployable, not in the map and not the client's own, is E1011.

```
E1011 notes is not in the client's service map: imported by modules/shop/pages/Cart.tsx
```
```ts
import { addNote } from '@app/notes/notes.contract' // alias: not scanned, so notes is unmapped: E1011
```

Limits: the scan is textual and relative-only, by design (a resolver would be the bundler's second pass). Code that imports a server module through an alias, a package name or a computed specifier fails the build rather than being mapped; the fix is a relative import or moving the shared part out of the module.

## Alternatives
- Map every `node` deployable's modules, as before: ships names the client never uses.
- Map whatever the bundler reached, after the build: the entry is generated before bundling, so a second build pass would be needed.
- Warn instead of failing: a call to `http://<module>.keel.invalid` is a broken page, not advice.

## Spec diff
- k.bundle Rules: "E1011 a client bundle holds a file of an app module of a `node` or `static` deployable that its service map (k.hosting Peers) omits". The entry stated no condition on the module's kind; the code ignores `client` deployables' modules and stdlib modules.
- k.hosting Peers and `docs/THREAT-MODEL.md` already state the map and the tags as built; no change.

## Conformance diff
`packages/compiler/conformance/` (by the `conformance-writer`, under `rfc:0174`): a client build ships no name of a server module it does not import; an aliased import of one fails with E1011 naming the module and the importer. `packages/server/conformance/hosting-0087.test.ts` covers the `keel-peer` tags.

## Token impact
k.bundle gains one clause in Rules. One code, E1011, already in the map.
