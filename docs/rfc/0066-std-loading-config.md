# RFC 0066: `keel check` loads the stdlib packages in `deps`, and `std` config reaches the runtime

Status: implemented (ADR-0055)

## Problem
- **Backlog 0118.** `keel check` never imported the stdlib packages a module names in `deps`. Their check rules (std.brands E2101) and their `std` config schemas (`s.register('@keel/std-x', Config)`) registered only when something else imported them, as tests do. On a real project `keel check` passed a non-PascalCase brand, and E1158 never validated a value. RFC 0047 follow-up 1.
- **Backlog 0119.** A deployable had no runtime path to the `std` config of its modules. std.sessions (backlog 0092) reads each module's `redact` list at run time. RFC 0047 follow-up 2.

## Proposal
1. **Loading `deps` (k.module, k.cli).** Before its rules run, `keel check` (every surface: binary, MCP, LSP) and `keel build` read each app `modules/<id>/module.ts` statically and import every `@keel/std-*` package in its `deps` once. Resolution is Node's from the manifest's folder, the resolution the build's bundler uses from the project. A package that cannot be resolved or that throws while it loads is **E1159** at its `deps` entry, naming the package and the module; the rest still load. `importDeps(root, files)` (`@keel/compiler/std/importDeps`) does this; the CLI calls it. `check()` stays static and synchronous: a programmatic caller imports the packages, or calls `importDeps`, first.
2. **Artifact `.keel/std.json` (k.module).** `stdArtifact(files)` (`@keel/compiler`) reads every app manifest's `std` statically and builds `{ [pkg]: { [moduleId]: config } }`. Only entries whose key is a `@keel/std-*` package in that module's `deps` and whose value is literal JSON are kept. Each kept value is validated with the schema registered under its package, when one is. Every other entry, and each failing value, is E1158 with the message `check` uses: it names the issue's path and rule. The file is `{ data, hash }` in canonical JSON, like the other artifacts. `keel build` and the Vite plugin write it, `{}` when no module has config. `artifactHashes` includes it, so `keel check` compares it (E1005).
3. **`createApp({ std })` (k.server).** `std` is the path of a `.keel/std.json`, read once at startup, like `assets`. A missing or unparsable file, or one whose `hash` is not the hash of its `data`, rejects with **E1160** (k.module). An entry that fails the schema registered under its package rejects with E1158, naming the module, the package and the path. The option is explicit. The server never looks for `.keel/` next to its entry: tests and multi-deployable processes choose the file.
4. **Accessor (k.module).** `stdConfig(ctx, pkg, schema)` (`@keel/compiler/std/stdConfig`) returns `{ [moduleId]: T }` for the `ctx` that `createApp({ ctx, std })` was given. Each value is parsed with `schema`; a failure throws E1158. A ctx no `createApp` bound returns `{}`. The binding lives in a `WeakMap` keyed by ctx, the same way k.ctx keeps capability instances. `Ctx` gains no field.
5. **std.sessions contract.** The package registers `s.register('@keel/std-sessions', SessionsConfig)` with `SessionsConfig = s.object({ redact: s.array(s.string()) }, { closed: true })`. On the server, `record` reads `stdConfig(ctx, '@keel/std-sessions', SessionsConfig)` and merges the `redact` lists of every module.

## Amendments (red-team 0192-0196)
- **Resolution (0192, 0194).** `importDeps` imports only `deps` named `@keel/std-[a-z0-9-]+`; any other `@keel/std-` name is E1159. It finds `node_modules/<dep>/package.json` in the manifest's folder or an ancestor, with no NODE_PATH and no global folders. It reads `exports` with the ESM conditions `node`, `import` and `default`, so a package whose `exports` has only `import` loads. A package with no `exports` falls back to `main`, then `index.js`.
- **Retry (0193).** Only successful imports are remembered, by real entry path, and a failure is tried again on the next call. Node's ESM cache keeps a package that threw, or changed after it loaded, until the process restarts. That includes the LSP and MCP servers.
- **Trust (0194).** Importing these packages runs the project's own dependencies, the trust level of `vite dev`. A workspace-trust prompt for the LSP and MCP is a human decision; backlog 0194 stays open, and docs/THREAT-MODEL.md records it.
- **Non-finite values (0195).** `-1e999` is not literal JSON (E1158), in `keel check` and in `stdArtifact`. Values are validated as `std.json` holds them, after a JSON round-trip, so `-0` is stored and checked as `0`.
- **Dev (0196).** In the Vite plugin, a changed `module.ts` first imports its new deps. Its E1159 and E1158 then go to the dev warnings, as at `buildStart`, before `std.json` is rewritten.

## Alternatives
- **Validate in `check()` by importing there.** `check()` is synchronous and pure, and every surface and test calls it. An import inside it makes results depend on the file system and on what was imported before.
- **Auto-load `.keel/std.json` next to the entry.** That is action at a distance (principle 2), and a test process serving two deployables could not choose.
- **A `ctx.std` field.** It changes the frozen `Ctx` shape in k.ctx for a stdlib concern, and every ctx would carry it, sim ctxs included.
- **Embed config in `routes.json`.** That mixes two artifacts' sources and breaks `routes.json`'s literal comparison.

## Spec diff
- **k.module.** A **Std config** paragraph covers loading, the artifact, `createApp({ std })` and the accessor. Rules: E1158 also fires at `keel build` and `createApp`; new E1159 (a `deps` package that cannot be imported) and E1160 (a `createApp({ std })` file that is missing, malformed or stale), both in the k.module block E115x. Conformance gains three clauses. 891 -> 1,314 tokens.
- **k.server, k.cli.** Unchanged. Both are at the 1,500-token limit, and k.cli already specifies `createApp` options of other sections (`artifacts`, `inspect`); `std` is specified where its contract lives.
- **std.sessions.** The "needs rfc" note becomes the `stdConfig` read.

## Conformance diff
- **Added.**
  - `packages/cli/conformance/module-std-deps-loaded.test.ts` (k.module): E2101 through `keel check`, and E1159.
  - `packages/cli/conformance/module-std-artifact-build.test.ts` (k.module): `keel build` writes `std.json`; E1158 writes nothing.
  - `packages/server/conformance/module-std-config-createapp.test.ts` (k.module): `createApp({ std })` and `stdConfig`, E1160, E1158, and the round-trip property, seed 1337.
- **Edited (rfc:0066).** None.

## Migration
None for apps. `.keel/std.json` appears at the next build. A deployable that uses std config passes `createApp({ std: '.keel/std.json' })`. Before this RFC nothing read the config.

## Token impact
k.module +423 (891 -> 1,314); no other kernel section changes.

## Follow-ups
- **Client deployables.** `stdConfig` in the browser returns `{}` until the client entry binds the artifact. std.sessions `record` in a `client` deployable needs that.
