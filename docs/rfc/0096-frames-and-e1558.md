# RFC 0096: production frames name app files, the frame root comes from `artifacts`, E1558 reports what it cannot read

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 2, 3, 4, 6; open questions answered as recommended; the user confirms or reverses, tasks/0312-s6-compliance/PLAN.md D28). For backlog 0566, 0567, 0568. Each decision cites the WORKFLOW RFC default it applies; the points the defaults leave open are under Questions with a recommendation. ADR-0119 records it.

## Decisions
- D1 (0566): `keel build` writes `dist/<name>/server.mjs.map` beside `server.mjs`: an external file, sources relative to the project (one outside it written `../`), no `sourcesContent`. `@keel/server` maps a frame in `<artifacts>/server.mjs` through that file itself, with Node's `SourceMap` class, read on the first throw that needs it. No process flag and no `process.setSourceMapsEnabled`: called inside the bundle it maps nothing of the bundle (measured below). The map is never served (defaults 4, 3, 6).
- D2 (0567): the frame root is the folder holding `createApp({ artifacts })`: `keel dev` passes `<project>/.keel`, so frames are relative to the project; production frames come from the map, already project-relative. No `artifacts`: `frames` is `[]`. No new `createApp` option and no `process.cwd()` read (defaults 2, 4).
- D3 (0568): `serverOnlyCalls` reads a generator held in a top-level `const`, and `loader`/`action` called through `import * as`. A `loader` or `action` call it cannot read (options not an object literal, or holding a spread or computed key; a loader `fn` neither inline nor a top-level function or `const` of the file) is reported as E1558, as E1111 reports a route table it cannot read (defaults 6, 2).

New codes: none. E1558 widens; no other code changes. k.compiler is untouched, so its `k.artifacts` split is not needed here.

## Problem
Measured on `jdforsythe/test-impl` at `772fc09`, Node 24.19 and 22.23 (CI and the image run 22).

- **0566.** `caught` computes frames with `appFrames(thrown, process.cwd())` (`packages/server/src/internal/caught.ts:17`); `appFrames` keeps any absolute position under that folder outside `packages/`, `node_modules/` and `.keel/` (`appFrames.ts:26-41`). The `node` server build bundles every dependency into one file with no source map: the ssr environment sets `rolldownOptions: { input: SERVER_ENTRY, output: { entryFileNames: "server.mjs", codeSplitting: false } }` and no `sourcemap` (`packages/compiler/src/vite.ts:368-377`; Vite's default is off). The image runs `server.mjs` from `WORKDIR /app` with `dist/<name>/` copied in (`packages/scaffold/src/templates/dockerfile.ts:13-19`), so the working directory holds the bundle and every frame in it, kernel frames included, is kept as `server.mjs:<line>:<col>`. A start-up throw from golden-1's built `api` shows the shape: `codedError (…/dist/api/server.mjs:8571:39)`, `loadAssets (…/server.mjs:11121:40)`, `createApp (…/server.mjs:11511:66)`.
  - `start` passes `assets: o.dir, artifacts: o.dir` (`packages/server/src/internal/start.ts:46-56`), `o.dir` being the generated entry's `import.meta.dirname` (`packages/compiler/src/internal/serverEntryCode.ts:39`).
  - `process.setSourceMapsEnabled(true)` as the first statement of an esbuild bundle with an external map leaves that bundle's frames unmapped on Node 24.19 and 22.23 (Node maps only modules loaded after the call); `node --enable-source-maps` maps them, to absolute paths resolved against the map's folder.
  - Rolldown 1.2.16, the bundler under Vite, takes `output.sourcemapExcludeSources` and `output.sourcemapPathTransform` (`rolldown/dist/shared/define-config-*.d.mts:443-533`).
  - **What is served.** `loadAssets` reads every regular file under the real `assets/` and the top-level `keel-mark.svg` (`packages/server/src/internal/loadAssets.ts:33-79`); a hosted client also gets `index.html` for unmatched page requests (`handle.ts:39`, `:65`). Nothing else under `dist/<name>/` is served: `server.mjs`, `routes.json` and `std.json` are not. `loadAssets` types `.map` as JSON (`:10`), so a client build whose `vite.config.ts` turns `build.sourcemap` on would have its maps under `assets/` served.
  - **Artifact count.** `keel build`'s summary counts `.keel/` artifacts, `std.json` and deploy files (`packages/cli/src/internal/buildCommand.ts:62-64`, `deployArtifactCount.ts:11-15`), asserted as 5 in `packages/cli/test/mutation-cmd-build.test.ts:38`, `:77`; Vite's `dist/` outputs are not counted. Tests that read `dist/`: `packages/server/test/productionEntryBundle.test.ts:16-21` (the text of `server.mjs`), `packages/server/conformance/hosting-0087.test.ts:230` (a `client` dist, `.html` and `.css` only), `topology-server-mjs.test.ts:29`. No test lists the files of a `node` dist.
- **0567.** `AppOptions.artifacts` is "the compiler's `.keel` directory" (`packages/server/src/types/AppOptions.ts`); `keel dev` passes `<root>/.keel` (`packages/compiler/src/internal/devEntryCode.ts:61`), the production entry its own folder (`start.ts:55`). `createApp` appears 386 times in 219 files outside `dist/`: 128 in history (RFCs, ADRs, changesets, task plans), 19 in spec, 11 in docs, skills and READMEs, 36 in 25 package source files (two callers that run: the generated production entry through `start` and the `keel dev` entry; the rest doc comments and the scaffold `routeTest` template), 163 in 110 package test files, 11 in 11 app test files, 18 in 9 eval files. 28 files pass `artifacts`. Three tests depend on the working-directory root: `packages/server/conformance/diag-frames-0095.test.ts` (builds stacks under `process.cwd()`, `:20-22`), `privacy-diag-frames-0095.test.ts:19`, and `packages/server/test/appFrames.property.test.ts`.
- **0568.** `serverOnlyCalls` reads named imports of `loader`/`action` from `@keel/router` and `async function*` declarations at the top of the file (`packages/compiler/src/serverOnlyCalls.ts:38-48`), and reports a call whose first argument is an object literal with a `stores` key or whose second argument is an `async function*` expression or such a declaration (`:50-65`). Its own doc comment lists what passes unread (`:22-23`): a namespace import, a helper that adds `stores`, a spread, a generator in a `const` or imported. `createApp` throws E1558 for each at start-up (`packages/server/src/internal/selectDeployable.ts`). Every `loader` and `action` call in a module a `client` deployable serves today is a named import with literal options and an inline function: 6 files in golden-1 `todos`, 6 in golden-2 `recipes`, 1 in inspector; no eval or scaffold template places one.

## Proposal

### D1 (0566). The build writes a map; the server reads it
- **Build.** The ssr environment in `vite.ts:368-377` gains `sourcemap: true` and, in `output`, `sourcemapExcludeSources: true` and `sourcemapPathTransform`, which writes each source relative to the project root `at` (`vite.ts:359`) and a source outside it as `../`. The bundle ends with `//# sourceMappingURL=server.mjs.map`. The client environment is unchanged.
- **Map.** golden-1's `api`: `server.mjs` 549,007 B; `server.mjs.map` 338,815 B (70,850 B gzip) without `sourcesContent`, 1,026,533 B (257,767 B gzip) with it. 551 sources: 42 under `modules/`, `topology.ts`, and 508 outside the project (the kernel and its dependencies, written `../`). Kept out: source text. Kept in: paths, 101 identifier names, mappings.
- **Mapping.** `appFrames` becomes `appFrames(artifacts)`, returning the frame reader `createApp` builds once (`sv.frames`). A frame whose file is `<artifacts>/server.mjs` is replaced by the source position `findEntry` gives in `<artifacts>/server.mjs.map` (1-based in, 0-based to `findEntry`, 1-based out); no map, or no mapping at that position: the frame is dropped. Every frame then passes the same filters: outside the root (`../`), `packages/`, `node_modules/`, `.keel/`. The map is read and decoded on the first throw that has a `server.mjs` frame and kept for the process.
- **Cost, golden-1 `api`.** Start: none (nothing is read until a throw). First mapped throw: 0.15 ms read, 7.3 to 9.3 ms decode (Node 24 and 22; 21 ms once on a cold Node 22 run), 5.8 MB heap held after. Each frame: 0.3 to 0.5 µs. For comparison, `--enable-source-maps` adds 3 to 6 ms to every start on Node 24 and 11 ms on Node 22 (median of 7, 40 to 52 ms), and maps every `Error.stack` the process reads.
- **Privacy.** The map holds file paths and identifier names, not source text. It is not served: `loadAssets` reads `assets/` and `keel-mark.svg` only, and the map sits beside `server.mjs`, which is not served either. A hosted client answers unmatched page requests with `index.html`, which holds none of the map. Frames from the map are scrubbed with the request's `piiValues` as today (`createApp.ts:201`).
- **Client maps.** Left alone: Vite writes none by default; an app that turns them on publishes its client source, which the browser already holds as JavaScript. Question 3.
- Files: `packages/compiler/src/vite.ts`; `packages/server/src/internal/appFrames.ts`, `caught.ts` (takes the reader), `keepRunning.ts` (passes it), `runLoaders.ts`, `runAction.ts` (`sv.frames`), `createApp.ts` (builds it once, `:164`, `:261`), the `Served` type.

Default applied: 4 (no source text in the image, nothing served), 3 (the bundler already in the build writes the map; Node's own `SourceMap` decodes it), 6 (the kernel maps, no deploy flag to forget). Principle 2: no process-wide switch changes every other stack in the process.

### D2 (0567). The root is the folder holding `artifacts`
- `appFrames(artifacts)` takes `dirname(resolve(artifacts))` as the root. `keel dev` passes `<project>/.keel`: frames are relative to the project wherever `keel dev` runs, nested projects too. The production entry passes `dist/<name>`: its frames are in `server.mjs`, mapped by D1 to project-relative sources, so the root never applies there.
- No `artifacts`: `frames` is `[]`. A test that wants frames passes `artifacts`, as one that wants forwarding or inspect does today.
- `caught` takes the reader as an argument; `process.cwd()` leaves `packages/server/src`.

Default applied: 2 (`artifacts` already names the project; a second option would say it twice), 4 (no absolute path ever reaches a frame).

### D3 (0568). E1558 reads more and reports the rest
- **Reads.** `import * as r from "@keel/router"`: `r.loader(…)` and `r.action(…)` (non-computed member) are calls. Top-level functions by name: a `function` declaration, and a `const` whose initializer is a function or arrow expression (parentheses, `as` and `satisfies` stripped), each recorded as live when `async function*`. Exported forms count.
- **Reports.** A call is one E1558 at the call when its options name `stores` (`names stores`), when a loader's `fn` is live (`is live`), or else when the call cannot be read (`is not statically readable (write its options as an object literal and its fn in this file)`): options that are not an object literal, or that hold a spread or a computed key; a spread argument; a loader `fn` that is not a function or arrow expression and not an identifier naming a top-level function or `const` of the file. Message: `<adapter> deployable <name>: <loader|action> <why>; serve module <m> from a node deployable`. An `action`'s `fn` is not read (actions are never live).
- **Not read.** An alias (`const l = loader`), and a helper in another file that calls `loader` or `action` for the module; `createApp` throws E1558 at start-up for those holding server state. A `fn` imported from another file is not followed: it is reported as unreadable.
- `@keel/check`'s E1558 `explain` row is unchanged: its fix ("serve the module from a node deployable, or drop stores from the loader or action") still applies, and the diag carries the rest.

Default applied: 6 (a static report beats a start-up throw; an unreadable call fails instead of passing), 2 (one code for the rule, as E1111 covers its unreadable tables).

## Alternatives
- **0566: `process.setSourceMapsEnabled(true)` in the generated entry**, rejected: measured, it maps nothing in the bundle that calls it (Node 24.19, 22.23), and it is a process-wide switch.
- **0566: `--enable-source-maps` in the Dockerfile `CMD` or `NODE_OPTIONS`**, rejected: `node dist/<name>/server.mjs` run directly (k.deploy's conformance, golden-1's `api` script) stays unmapped; every start pays 3 to 11 ms and every `Error.stack` in the process is mapped; mapped paths are absolute against the image's `/app`, a second root rule.
- **0566: a small `server.mjs` that enables maps, then imports the bundle as a second file**, rejected: changes k.deploy's one-file entry and the deploy image's file list for the same result.
- **0566: an inline map**, rejected: about 450 KB of base64 in `server.mjs`, read on every start.
- **0566: keep `sourcesContent`**, rejected: 3 times the size and the app's source text in every image; frames need positions only (default 4).
- **0566: a VLQ decoder in `@keel/server`**, rejected: about 250 B more for a class Node 22 ships (`node:module` `SourceMap`), which printed no warning on 22.23 or 24.19.
- **0567: a `root` option on `createApp`**, rejected: a new hand-written option (WORKFLOW escalates those), set by the 2 kernel callers to the value `dirname(artifacts)` already gives, and by every test that wants frames.
- **0567: keep `process.cwd()`**, rejected: a hidden global read (principle 2), wrong when `keel dev` runs from another folder, and in production it keeps `server.mjs` frames.
- **0567: a root on `ctx`**, rejected: `ctx` is app code's effect surface, and a file path there reaches app code; a sim `ctx` has no files.
- **0568: follow imports to other files**, rejected: a module graph in `serverOnlyCalls` for a form no app uses; reported as unreadable instead.
- **0568: a warning, or a new code, for an unreadable call**, rejected: one code per rule (default 2); E1111 sets the precedent.

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/kernel/*.md` at `772fc09`.

### k.server (1,464 to 1,497)
**Log**, replacement text:

> **Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (personal data dropped, k.privacy; a throw's `frames`: its first 5 stack positions in app code (E1576's), each `<path>:<line>:<col>` relative to the folder holding `artifacts`, an `<artifacts>/server.mjs` position through its map (k.deploy); no `artifacts`: none), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line.

**Conformance**, the last clause, replacement text (same position, so its ledger item keeps its number):

> - A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the folder holding `artifacts`; none without `artifacts`.

### k.deploy (800 to 898)
**Build**, replacement text:

> **Build.** `keel build` writes `dist/<name>/` per `client` deployable (k.hosting) and `node` one: the client build (k.server), `routes.json` (all modules), `std.json`, and `server.mjs`, the generated entry, bundled, with `server.mjs.map`: sources relative to the project (one outside it: `../`), no `sourcesContent`, never served. `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (optional; `createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees: whoever holds it, or runs code in one deployable, can sign a caller every deployable accepts), and `KEEL_PEER_<NAME>` (`my-api`: `KEEL_PEER_MY_API`), an http(s) URL, required per other `node` deployable. A failure or unbindable `PORT` prints one E1560 naming the key, no value, and exits 1. Then it serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits. `ctx.storage` is the file `--localstorage-file` names, the only state that survives a restart.

**Conformance**, appended:

> - A loader throwing in `modules/a/a.server.ts` of a `keel build` fixture logs, from `node dist/<name>/server.mjs` in json, `frames` starting `modules/a/a.server.ts:`; `server.mjs.map` has no `sourcesContent`, and no response to `GET /server.mjs.map` contains its `mappings`.

### k.topology (1,192 to 1,328)
**Rules**, replacement text:

> **Rules.** E1552 `topology.ts` not statically readable, a name not `[a-z][a-z0-9-]*`, a module unknown or in two deployables · E1553 a `static` route with params or actions · E1559 one path in two deployables (names both; `keel check` and `keel build`) · E1558 a live loader, or a `loader` or `action` naming `stores`, in a `*.server.ts` of a module a `client` or `static` deployable serves (at the call in `keel check` and `keel build`; `createApp` throws it; fix: none), and there a `loader` or `action` call those commands cannot read: options not an object literal, or with a spread or computed key; a loader `fn` neither inline nor a function or `const` at the top of the file · E1511 (k.api) · E1560 (k.deploy).

**Conformance**, appended:

> - In a `client` module's `*.server.ts`, `loader({ output }, feed)` with `const feed = async function* …`, `r.loader({ output, stores })` through `import * as r`, and `loader({ ...base, output }, fn)` are each one E1558 in `keel check` and `keel build`; `loader({ output }, load)` with `load` an `async function` of the file is none.

### Unchanged
k.compiler (1,498; no split), k.security (1,493), k.privacy (its Server log sink already scrubs each frame), k.hosting, k.check, k.cli. `spec/00-map.md` is unchanged: E155x already lists k.server and k.topology.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:

New files:
- `packages/server/conformance/deploy-frames-source-map.test.ts` (D1):
  - `// Spec: k.deploy, Conformance "A loader throwing in `modules/a/a.server.ts` of a `keel build` fixture logs, from `node dist/<name>/server.mjs` in json, `frames` starting `modules/a/a.server.ts:`; `server.mjs.map` has no `sourcesContent`, and no response to `GET /server.mjs.map` contains its `mappings`."`
  - Builds a `node` fixture as `topology-build-fixture.ts` does, with a throwing loader in `modules/a/a.server.ts`; spawns `server.mjs` with `KEEL_FORMAT=json`; asserts no frame names `server.mjs`, `packages/` or `../`; `GET /server.mjs.map` with `accept: text/html` and with `accept: */*`.
- `packages/cli/conformance/topology-e1558-unreadable.test.ts` (D3):
  - `// Spec: k.topology, Conformance "In a `client` module's `*.server.ts`, `loader({ output }, feed)` with `const feed = async function* …`, `r.loader({ output, stores })` through `import * as r`, and `loader({ ...base, output }, fn)` are each one E1558 in `keel check` and `keel build`; `loader({ output }, load)` with `load` an `async function` of the file is none."`
  - `// Spec: k.topology, Rules "E1558 … and there a `loader` or `action` call those commands cannot read: options not an object literal, or with a spread or computed key; a loader `fn` neither inline nor a function or `const` at the top of the file"`
  - `// Seed: 1337.` Plus a property: over generated calls (named or namespace callee; options a literal with or without `stores`, a spread, a computed key, an identifier, a call; `fn` inline generator, inline async function, arrow, top-level declaration or `const` of either kind, import, call), the count of E1558 is 1 exactly when the options name `stores`, the `fn` is live, or either is unreadable; 0 in a `node` deployable's module.

Changed files:
- `packages/server/conformance/diag-frames-0095.test.ts:1`: the header quotes the new k.server clause (same section id). The fixture passes `artifacts: <dir>/.keel` and builds stacks under `<dir>` instead of `process.cwd()` (`:20-22`); one case adds that without `artifacts` every throw's `frames` is `[]`.
- `packages/server/conformance/privacy-diag-frames-0095.test.ts:19`, `:26`: stacks under the fixture's folder, and `artifacts` passed. Its header (k.privacy) is unchanged.
- Kept green with no edit: `packages/cli/conformance/topology-e1558-server-state.test.ts`, `packages/server/conformance/e1558-*.test.ts`, `topology-server-mjs.test.ts`, `hosting-0087.test.ts`, `privacy-diag-scrub.test.ts`, `runner-rejection-diag-0092.test.ts`; `packages/cli/test/mutation-cmd-build.test.ts` (`artifacts: 5` counts `.keel/` and deploy files, not `dist/`); `packages/server/test/productionEntryBundle.test.ts` (the map comment names no package).
- Outside conformance: `packages/server/test/appFrames.property.test.ts` takes the reader form.
- Ledger: new items `k.deploy#6`, `k.topology#9`; `k.server#16` keeps its number with new text.

## Lanes and build order
- **Step 1, orchestrator:** the spec diff in one commit, and `tooling/budgets.json` (Budget).
- **Step 2, conformance-writers in parallel:** one for k.server and k.deploy (D1, D2: the three server files), one for k.topology (D3).
- **Step 3, in parallel:**
  - Lane A, compiler `vite.ts` then server: the ssr map options, then `appFrames`, `caught`, `keepRunning`, `runLoaders`, `runAction`, `createApp`, and the unit test. One agent: the k.deploy test needs both halves.
  - Lane B, compiler: `serverOnlyCalls.ts` and its doc comment. Shares the package with lane A, not a file.
- Root gates, budgets measured once both land, ledger on a quiet tree, push.

## Migration
- D1: the next `keel build` writes `dist/<name>/server.mjs.map` beside `server.mjs`; `dist/` is ignored in every app. The image copies `dist/<name>/` as before and grows by the map (golden-1 `api`: 338,815 B). Deploy files, `topology.ts` and app code are unchanged; no E1005.
- D2: no `createApp` caller changes. The two kernel callers pass `artifacts` already. Callers without it (most of the 163 package-test and 11 app-test calls, the 18 in evals, the scaffold `routeTest` template) log `frames: []` where they logged working-directory frames; none asserts frames except the three files above.
- D3: none in the repo; every call in a `client` module is a named import with literal options and an inline function. An app outside the repo with an unreadable call in a `client` or `static` module gets E1558 from `keel check` and `keel build`; the fix is in the message.
- Docs, same commits: `packages/server/README.md:34` (frames relative to the folder holding `artifacts`; production through `server.mjs.map`), the `AppOptions` doc comment, `docs/guide/build-golden-1.md:259` (the `dist/api/` row lists `server.mjs.map`), `.claude/skills/keel-deploy/SKILL.md:10`, and the `serverOnlyCalls` doc comment.

## Token impact
| section | before | after |
| --- | --- | --- |
| k.server | 1,464 | 1,497 |
| k.deploy | 800 | 898 |
| k.topology | 1,192 | 1,328 |

## Budget
Measured with `tooling/budgets.mjs`'s method (own code bundled, dependencies external, minified, gzip) on copies of `src` with the sketched change.
- `@keel/server`: 20,053 of 20,224 B today; with D1 and D2 20,289 B, 65 over. **Re-base to 20kb (20,480 B)**, reason: production frames that name app files, mapped in the kernel rather than by a deploy flag (default 7).
- `@keel/compiler`: 29,941 of 29,952 B today; with D3 30,080 B, 128 over. **Re-base to 29.5kb (30,208 B)**, reason: E1558 fails an unreadable call instead of passing it (default 7). D1's `vite.ts` change is in `@keel/compiler/vite`, which has no budget line.
- `@keel/cli`, `@keel/check`, `@keel/server/internal/start`: untouched.

## Known limits
- D1: a throw in the generated entry's own code has no mapping and no frames. The first mapped throw pays about 8 ms and holds about 6 MB for the process (golden-1 `api`). In the repo's own builds the kernel sources sit outside each app and are written `../`; in an installed app they sit under `node_modules/`, and both are dropped as library frames.
- D3: an alias of `loader` or `action`, or a call made from a file of another module, is not read; `createApp` throws E1558 for the ones holding server state.

## Questions
The defaults decide every item: 4 (D1's map carries no source text and is never served; D2 puts no absolute path in a frame), 3 (D1 reuses the bundler and Node's decoder), 6 (D1 maps in the kernel; D3 reports what it cannot read), 2 (D2 adds no option; D3 keeps one code) and 7 (both re-bases). No new user-facing API shape, no privacy or auth weakening, no external integration, no golden-app migration. Open points, with recommendations:
1. **`node:module` `SourceMap`.** Node documents the source map API with an experimental stability marker in some releases; it printed no warning on 22.23 or 24.19, and CI runs 22. Recommendation: use it; the k.deploy conformance test fails the day it changes, and the fallback is a decoder in `@keel/server` (about 250 B).
2. **Load the map at start or on the first throw.** Recommendation: the first throw. A server that never throws pays nothing; an eager load adds about 8 ms and 6 MB to every start.
3. **Client maps.** An app that sets `build.sourcemap` publishes `assets/*.map`, which `loadAssets` serves. Recommendation: leave it; the browser already holds that code. File a backlog line if production should refuse `.map` under `assets/`.
