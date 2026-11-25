---
"@keel/check": minor
"@keel/cli": minor
"@keel/compiler": minor
---

In a library's own folder, `keel check` imports the library's own `./tools` and holds the library and the `@keel/*` packages its `package.json` names in scope, as an app listing it does: its formats, rules and config hold over its own files, and a declared `./tools` that does not import is E1159 at `package.json` (k.library-pack Own folder). A library's `contract()` belongs in the file its `exports["./contract"]` names; any other file of the library is E1513 naming that file (k.contract). In a library's route component file, one its own `manifest(` binds and no `public.exports` line or `exports` entry reaches, an element may take the literal id `<manifest id>.<rest>` (k.library Ids, E1161).
