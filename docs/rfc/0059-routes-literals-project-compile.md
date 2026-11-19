# RFC 0059: `keel check` reads `routes.ts` literals, `keel build` writes `routes.json` for `node`-only topologies, rules compile per project, and the timings cap evicts the least recent name

Status: implemented (ADR-0049)

## Problem
- **Red team 0155.** W1005 carried no signal. A clean golden-1 printed `W1005 .keel/routes.json not verified` with exit 0. A forged, self-consistent `routes.json` (`data:{"app.admin":{path:"/admin",guards:[]}}`, hash recomputed) printed the same line, also exit 0. Users learn to ignore a warning that never changes.
- **Backlog 0150 (known limit of RFC 0055).** When every deployable is `node`, `keel build` runs no project-level `vite build`. Only that build evaluates `routes.ts` and writes `routes.json`. So the file was never compared or rewritten, and W1005 stayed forever.
- **Backlog 0149.** `check()` compiled every checked file with the one topology it was given: the cli passes the cwd's `topology.ts`. At a workspace root that is the root's topology (often none), so `keel check apps/<x>` from the root reported E1004 that `keel check` inside the app did not. Duplicate element ids across apps (E1404) behaved the same way.
- **Red team 0162 (std.timings).** The 256-name cap kept the first 256 names forever on the process-lifetime app ctx and dropped later names without a signal. Request-derived names (`GET /u/1`, `GET /u/2`, ...) starved real ones. Repro: 256 such names, then `time(ctx, "db", f)`; `timingsOf(ctx).db` is `undefined`.

## Proposal
1. **0155: read `routes.ts` statically.** k.check still never evaluates app code. New `@keel/compiler` export `routeLiterals(files, { topology })`.
   - **Which manifests.** The ones the project's own `vite build` evaluates: the first `client` deployable's modules by name, else every `modules/<m>/routes.ts`. `artifactHashes` uses the same selection, so `routes.json` is `null` (evaluated) only when one of those manifests exists.
   - **What is read.** It parses each manifest with oxc, the compiler's parser. It finds `routes = manifest({...})` and reads each entry: the route id (a literal key), `path` and `layout` (string literals, absent is `null`), `actions` (the verb keys of an object literal), `params`/`search` (present or absent; the schemas are not compared), and `guard`. A guard is an identifier imported from a relative module, or declared in `routes.ts`, as `guard({ redirect: "<literal>" }, fn)`; its `redirect` is the value `routes.json` holds. `module` follows from the id.
   - **What is not read** is listed by name: a spread or computed key (`<file> ids`; it also unreads the routes before it, which it may override), a non-literal value (`<id> path`), a guard that does not resolve (`<id> guard`), or a file with no `manifest({...})` literal (`<file>`).
   - **check.** For a self-consistent, canonical `routes.json` whose expected hash is `null`, `generatedEdits` compares `data` with the literals. A differing literal value, a literal id missing from the file, or an extra id when the id set is fully literal is E1005: `.keel/routes.json differs from routes.ts at "<id>"; regenerate`. If everything compares and nothing was unread, there is no diagnostic. If parts were unread, W1005 names the first and counts the rest: `.keel/routes.json unverified, not literal: todos.x path (+1 more)`.
   - **Effect.** Golden-1, golden-2 and the inspector are fully literal: no W1005. The red-team forge adds an id that no `routes.ts` declares: E1005, exit 1.
2. **0150: `keel build` writes `routes.json` for a `node`-only topology.** New `@keel/compiler/routes` export `buildRoutes(root)`.
   - It selects the manifests as above and evaluates them with the plugin's `evaluateProject`. It writes `.keel/routes.json` through the plugin's writer (`writeArtifact`: canonical JSON, temp file, read-only, rename), so the bytes and hash are what `vite build` would write.
   - Like the plugin, it warns `W1005 .keel/routes.json differed from routes.ts; rewritten` before replacing a differing file. Evaluation problems (E1006, E1807, ...) come back as notes. The `keel` binary calls it after a successful engine build whenever `viteTargets` has no project-level build (every deployable is `node`), with or without `vite.config.ts`, and prints the notes to stderr. Exit code: unchanged on notes; 1 when evaluation rejects (E1000, E1049).
   - **Decision: no E1005 in `keel build`, no `--check` flag.** The build is the regenerate step (RFC 0055): it leaves a correct file and says what it replaced. The gate is `keel check`, which now catches a literal mismatch as E1005 in CI without building.
3. **0149: rules compile per project.** `check()` groups the checked code files by project and compiles each group once, with its paths relative to the project and that project's topology. The diagnostic paths map back.
   - **Project.** The nearest ancestor dir, among `files` and `project`, that holds a `.keel/` artifact or a `topology.ts` that parses as one, and has no `modules` segment; else the root. Module code is never a project root (backlog 0169): a `topology.ts` under `modules/app/ui/` would move `ui/*` out of its module and hide E1004 that the build reports. This extends RFC 0055's `.keel/` grouping to the compile for rules.
   - **One rule for check and build.** `projectDirs` (`@keel/compiler`) decides it. `check()` compiles per project, E1005 derives each project's hashes without a deeper project's files, and `keel build` compiles only the root project's files, so the two cannot disagree.
   - **Topology.** For the root it is `opts.topology`, as before. For a nested project it is the static parse of its own `topology.ts`.
   - **Effect.** `keel check apps/<x>` from the root and `keel check` in `apps/<x>` report the same diagnostics, E1004 and E1404 included. Rules still see each file with its root-relative path. Each one gets its project's compiled artifacts merged with `opts.artifacts`.
4. **0162: least-recently-updated eviction and a `dropped` count.** At 256 names, recording a new name evicts the name updated least recently (a `Map` in update order: delete and re-insert on update; evict the first key). Each eviction adds 1 to the ctx's `dropped`. `timings.recent` now serves `TimingsRecent`, a new export: `{ timings, dropped }`. `timingsOf(ctx)` still returns the `Timings` record.

## Alternatives
- **Evaluate `routes.ts` in check (a sandbox).** Rejected again for the reasons in RFC 0055: there is no sandbox, and k.check never runs app code.
- **Compare the JSON Schemas of `params`/`search` statically.** That needs the schema DSL evaluated or re-implemented in the compiler. Presence is compared; schema bodies are left to `vite build` and `keel build`. They are not listed as unread, so a W1005 keeps one meaning: a literal the reader could not see.
- **W1005 whenever any part is not compared.** Every app with `params` would warn forever: the 0155 problem again.
- **Write `routes.json` from a `node` deployable's Vite client build.** That build selects the deployable's own manifests, not the project's. It also runs only with `vite.config.ts`, and once per deployable.
- **E1005 in `keel build` under `CI`.** Rejected (Proposal 2). Two commands would gate the same file, and a build that cannot write the file it regenerates would be useless.
- **Project roots from `package.json` (0149).** `keel check` does not read it (RFC 0055). `topology.ts` decides E1004, and `.keel/` is where the writer puts the project's files.
- **0162: count dropped names but keep first-come.** Real names still starve. LRU keeps the names in current use, and `dropped` shows the churn.

## Spec diff
- **k.compiler Artifacts, `routes.json` bullet.** Adds "An id, `path`, `layout`, `actions` or guard `redirect` unlike its `routes.ts` literal is E1005."
- **k.compiler Rules, W1005.** "`routes.json` beside a `routes.ts`: unverified by `keel check`; `vite build` rewrites it, warning if it differed" becomes "`routes.json` parts not literal in `routes.ts`, named; builds rewrite it, warning if it differs".
- **k.compiler Conformance.** The W1005 clause becomes "Beside a literal `routes.ts`, `keel check` passes a genuine `routes.json`, is E1005 with a route added, W1005 with a computed `path`; `vite build` and a `node`-only `keel build` rewrite a differing one with W1005."
- **k.cli Commands.** `check [paths]` becomes "k.check over the code files and `.keel/*.json` artifacts under `paths`, each with its project's `topology.ts`". **Conformance** adds "`keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics."
- **std.timings.** `timingsOf` gains "A ctx keeps at most 256 names: a new name evicts the least recently updated one." Adds `TimingsRecent` (`s.object({ timings: Timings, dropped: s.int({ min: 0 }) }, { closed: true })`), and the section uses it as its schema. **Conformance** adds "After 256 other names, `time(ctx, 'db', fn)` keeps `db` in `timingsOf(ctx)`, and `timings.recent` reports `dropped: 1`." The section clause's value becomes `TimingsRecent.encode({ timings: timingsOf(ctx), dropped: 0 })`.
- **Editorial, to stay under 1,500 tokens.** k.compiler: the API sentence on project shape, "(so not `listitem`)", "generated" before API schemas, and wording in Output and Artifacts. k.cli: "(RFC 0022, 0024)", "(k.compiler)" after the inspect artifacts, the inspector's route and search, and the I1055 `session` example (stated above the rules). No rule changes.

## Conformance diff
- **Replaced** `packages/cli/conformance/artifact-routes-w1005.test.ts` by `artifact-routes-literals.test.ts` (conformance-writer, from the new clause). The forged self-consistent file is now E1005, the genuine one is clean, and a computed `path` is W1005. The `vite build` cases stay, and a `node`-only `keel build` rewrites a forged file with W1005.
- **Added** `packages/cli/conformance/workspace-same-diagnostics.test.ts`: a temp workspace whose root and app topologies differ; the same diagnostics come from both places.
- **Changed** `packages/std-timings/conformance/inspect-section.test.ts` (`TimingsRecent`). **Added** `evict-least-recent.test.ts` and `cap-least-recent.test.ts` (an LRU model, seed 1337).
- **Unit tests.** compiler `routeLiterals.test.ts` (literal reads, unread parts, guard resolution, selection); check `routes-literals.test.ts` (E1005 and W1005 messages, per-project compile, the 0149 repro); cli `routesRun.test.ts` and `project-roots.test.ts` (0169: the same E1004 from check and build beside `modules/app/ui/topology.ts`); std-timings `cap.test.ts` (LRU property, seed 1337).

## Migration
- Apps with fully literal manifests lose their W1005. A committed `routes.json` that does not match its literals is now E1005: run `vite build` or `keel build`.
- `node`-only projects: `keel build` now writes `.keel/routes.json`. Commit it.
- A root `keel check` in a workspace compiles each app with its own topology. Diagnostics that only appeared from the root disappear.
- `timings.recent` consumers read `value.timings` instead of `value`.
- `@keel/compiler` gains `projectDirs`, `routeLiterals`, the types `RouteLiteral` and `RouteLiterals`, and the subpath `@keel/compiler/routes` (`buildRoutes`). `@keel/std-timings` gains `TimingsRecent`.

## Token impact
- k.compiler 1,500 to 1,500 (editorial cuts offset the additions). k.cli 1,485 to 1,490. std.timings 457 to 555.
- W1005 and E1005 explain entries are reworded; the sizes are about the same.
- `keel check` on golden-1 drops one W1005 line.
