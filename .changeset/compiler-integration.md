---
"@keel/compiler": minor
---

Compiler integration (0040): `styles.json` and static style props on `@keel/ui` base elements rewritten to ui's atomic classes; Vite plugin emits `virtual:keel.css` via `compileStyles` and `routes.json` via `routesArtifact` (build-time evaluation of `tokens.ts`/`routes.ts`), reads `topology.ts`, and generates the client entry `/@keel/entry.ts`; `compile(files, { topology, routes })` with the E1004 client-only exemption; ctx passed to child components; `uses` export declared in the component's own scope; module-level stores in a root scope with ids filled from the export; `{props.children()}` inserted as nodes; E1501/E1003 on `Link to`/`Image src` with absolute URLs allowed; explicit base-element ids in E1404 and `ids.json`; `module()`/`ModuleSchema`; `tsconfig.strict.json` export.
