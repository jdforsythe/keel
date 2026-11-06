# @keel/scaffold

**Spec:** k.scaffold · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `scaffold(op, input, files)` and `plan(op, input, files)` (dry run, same result) -> `Result<Edit, ScaffoldError>`. `files: ReadonlyMap<path, content>`; `Edit = { files, created, changed, removed }` (sorted paths). `Op`: `project {name}` · `module {id}` · `route {id, path, file?}` · `component {id: "mod/Name"}` · `store {id: "mod.name"}` · `rename {kind: component|store|route|schema, from, to}` · `move {name, to}` · `add-field {schema, field, type, default?}`.
- **Invariants:** pure; never mutates `files`; byte-identical output for equal input. All or nothing: a refusal is `KeelError<'scaffold.rejected', diag>`: E1351 duplicate, E1352 naming, E1353 would break check, E1354 required field without default, E1005 generated location, E1052 bad input or target, E1051 unknown op. E1353 proxy: new TS2307 (unresolved relative import), E1151, E1152, E1153. Codemods are AST-aware (oxc, magic-string); property and member names are never renamed. Only `project`/`module` write `turbo.json` and CI.
- **Dependencies:** `@keel/schema`, `oxc-parser`, `magic-string`.
- **Rungs:** conformance (57); properties: rename round trip per kind, determinism and plan = scaffold, edit set = tree difference, check proxy, import-path helpers.

## Extension points

None. New generators are new `Op`s (spec change).

## Unsafe

count: 0
