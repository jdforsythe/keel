# @keel/scaffold

**Spec:** k.scaffold · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `scaffold(op, input, files)` -> `Result<Edit, ScaffoldError>`; pure, so it is also the dry run (`plan` removed, RFC 0045). `files: ReadonlyMap<path, content>`; `Edit = { files, created, changed, removed }` (sorted paths). `Op`: `project {name, adapter?, workspace?}` · `module {id}` · `route {id, path, file?}` · `component {id: "mod/Name"}` · `store {id: "mod.name"}` · `transaction {id: "mod.store.name"}` (store must exist) · `service {id: "mod", schema, service}` (places the `@keel/services/openapi` sources at `<Mod>Api.schema.ts`/`api.ts`, rfc:0039; the cli converts `--openapi`) · `rename {kind: component|store|route|schema|module, from, to}` · `move {name, to}` · `add-field {schema, field, type, default?}`.
- **Invariants:** pure; never mutates `files`; byte-identical output for equal input. All or nothing: a refusal is `KeelError<'scaffold.rejected', diag>`: E1351 duplicate, E1352 naming, E1353 would break check, E1354 required field without default, E1005 generated location or a change to a file whose first line is a generated marker (`// _generated`, `// Generated`, `# _generated`; a relocation with equal bytes is allowed), E1052 bad input or target, E1051 unknown op. E1353 proxy: new TS2307 (unresolved relative import), E1151, E1152, E1153. Codemods are AST-aware (oxc, magic-string): data keys never change (shorthand expands to `key: new`); strings change only as whole segments of an id shape (dotted id, element id). Only `project`/`module` write `turbo.json` and CI.
- **Dependencies:** `@keel/schema`, `oxc-parser`, `magic-string`.
- **Rungs:** conformance (57); properties: rename round trip per kind, bare string prefixes survive, determinism, edit set = tree difference, check proxy, import-path helpers.

## Emitted shape

Code is biome-clean for the repo config, and every generated tree passes the real `keel check` and `keel test` (conformance runs the binary, RFC 0036). `vite.config.ts` sets `test.environment: "happy-dom"`. A route `<mod>.<leaf>` gets `load<Leaf>.server.ts` exporting `load<Leaf>`; `id`/`*Id` params are `s.id("<Entity>")`. `project {workspace: true}` targets an app inside the monorepo: `index.html`, `vitest.config.ts`, `workspace:*` deps, only check/test/build scripts, no turbo/CI; tests go under `test/`. `rename module` moves the folder and rewrites ids, topology and manifests.

## Extension points

None. New generators are new `Op`s (spec change).

## Unsafe

count: 0
