# ADR-0049: `keel check` compares `routes.json` with `routes.ts` literals, `keel build` writes it for `node`-only topologies, rules compile per project, timings evict the least recent name (RFC 0059)

**Status:** accepted

**Context.**
- W1005 fired on every app with a `routes.ts`, genuine or forged, so it carried no signal (backlog 0155).
- A project whose deployables are all `node` never ran the build that writes `routes.json` (0150).
- `check()` compiled every file with the cwd's topology, so a workspace root reported E1004 an app did not (0149).
- The timings cap kept the first 256 names forever (0162).

**Decision.**
- **Static read.** `routeLiterals` (`@keel/compiler`) parses the manifests a project's own `vite build` evaluates (`projectManifests`: the first `client` deployable's modules, else all). It reads ids, `path`, `layout`, action verbs, `params`/`search` presence, and guard `redirect`s from `guard({ redirect })` declared locally or imported from a relative module. Nothing runs.
- **E1005 on a literal mismatch, W1005 only for what was not read.** A differing literal, a missing literal id, or an extra id when every id is literal is E1005. Parts that are not literals are W1005, named. Schema bodies are not compared and not reported.
- **`buildRoutes` (`@keel/compiler/routes`).** It evaluates with the plugin's `evaluateProject` and writes with the plugin's `writeArtifact`. The `keel` binary calls it after a successful engine build when `viteTargets` has no project build. It warns W1005 before rewriting a differing file. No E1005 at build and no `--check` flag: the build regenerates, and `keel check` is the gate.
- **Project per marker.** A dir holding a `.keel/` artifact, or a `topology.ts` that parses as a topology, is a project, unless its path has a `modules` segment (backlog 0169). `projectDirs` (`@keel/compiler`) is the one rule: `check()` compiles each project's code once, relative to it, with its own topology (the caller's for the root), and `keel build` compiles only the root project's files.
- **Timings LRU.** A `Map` in update order; a new name at 256 evicts the first key and adds 1 to `dropped`. `timings.recent` is `TimingsRecent` `{ timings, dropped }`.

**Alternatives.**
- **Evaluate in check.** No sandbox, and k.check is static (RFC 0055).
- **Compare JSON Schemas statically.** That needs the schema DSL in the compiler.
- **Write `routes.json` from a `node` deployable's client build.** That build selects the deployable's manifests and needs `vite.config.ts`.
- **Project roots from `package.json`.** `keel check` does not read it.

**Consequences.**
- Golden apps print no W1005. A forged `routes.json` that adds or changes a literal route is E1005, exit 1.
- `node`-only projects get a `routes.json` from `keel build`.
- A root `keel check` costs one compile per project with checked code, not one in total. A `topology.ts` costs one static parse.
- **Known limits.** Schema bodies in `routes.json` are verified only by a rebuild. A spread or computed key opens the id set, so an extra id is then W1005, not E1005.
