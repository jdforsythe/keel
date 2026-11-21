---
"@keel/check": minor
"@keel/cli": patch
"@keel/compiler": minor
"@keel/std-timings": minor
---

`routes.json` checked against `routes.ts` literals, per-project compile, and a timings LRU (backlog 0149, 0150, 0155, 0162; RFC 0059). `keel check` reads the routes manifests without running them, using the new `routeLiterals` export of `@keel/compiler`. A `routes.json` whose ids, paths, layouts, actions or guard redirects differ from those literals is E1005. W1005 now fires only for parts that are not literals, and names them, so the golden apps print none. `keel build` in a project whose deployables are all `node` writes `.keel/routes.json` through the new `@keel/compiler/routes` (`buildRoutes`), warning W1005 before it rewrites a differing file. `check()` compiles each project (a dir with a `.keel/` or a `topology.ts`, never under `modules/`; `projectDirs`, which `keel build` also uses) with its own topology, so a workspace root reports what the app reports. In `@keel/std-timings`, at 256 names a new name evicts the least recently updated one, and `timings.recent` serves the new `TimingsRecent`: `{ timings, dropped }`.
