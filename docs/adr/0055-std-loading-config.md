# ADR-0055: `keel check` loads stdlib `deps`; `std` config reaches the runtime through `.keel/std.json` (RFC 0066)

**Status:** accepted

**Context.**
- `keel check` never imported the stdlib packages named in `deps`. Their rules (E2101) and config schemas did not register, so E2101 and the schema half of E1158 were silent on real projects (backlog 0118).
- A deployable had no runtime path to its modules' `std` config, which std.sessions needs (backlog 0119).

**Decision.**
- `importDeps(root, files)` (`@keel/compiler/std/importDeps`) reads app manifests statically and imports each `@keel/std-*` dep once, resolved with Node's resolution from the manifest's folder. A failure is E1159 at the `deps` entry. `keel check` on every surface (the CLI's `runCheck`) and `keel build` call it before anything validates. The Vite plugin also calls it at `buildStart`. `check()` stays static and synchronous.
- `stdArtifact(files)` (`@keel/compiler`) builds `.keel/std.json`, `{ [pkg]: { [moduleId]: config } }`, from literal manifests. A bad entry is E1158 (not a stdlib dep, not literal, or failing the registered schema). It is always written, `{}` when empty, and `artifactHashes` includes it, so E1005 covers it.
- `createApp({ std: '.keel/std.json' })` is explicit, like `assets`. The file is read once at startup. A missing, malformed or stale file is E1160; a schema failure is E1158.
- `stdConfig(ctx, pkg, schema)` (`@keel/compiler/std/stdConfig`) returns `{ [moduleId]: T }` for the ctx that `createApp` bound, `{}` for any other ctx. It parses each value with the caller's schema, which keeps the result typed without casts. The binding is a `WeakMap<Ctx, data>`, as k.ctx keeps capability instances, so `Ctx` is unchanged.
- std.sessions reads `stdConfig(ctx, '@keel/std-sessions', SessionsConfig)` with `SessionsConfig = { redact: string[] }` (closed). It merges every module's list.

**Alternatives.**
- Make `check()` async and import inside it. That breaks purity and every caller.
- Auto-load `std.json` beside the entry. That is action at a distance.
- A `ctx.std` field. That changes the frozen k.ctx shape.

**Consequences.**
- Every project gets a sixth artifact, `.keel/std.json`. The golden apps carry `{}`.
- `@keel/server` grows by the startup read. Its budget is re-based with this reason (handoff D7).
- `stdConfig` in a `client` deployable returns `{}` until the client entry binds the artifact (follow-up).

**Amendment (red-team 0192-0196).** `importDeps` resolves ESM conditions itself (`node`, `import`, `default`). It walks only the manifest's own and ancestor `node_modules`, imports only `@keel/std-[a-z0-9-]+` names, and remembers successes only. A changed or failed package needs a process restart, because Node caches ESM modules. `-1e999` is E1158, and values are checked after a JSON round-trip. A changed `module.ts` in Vite dev imports its new deps and warns E1159 and E1158. Running the project's stdlib packages from the LSP and MCP has the trust level of `vite dev`; a trust prompt stays open (backlog 0194).
