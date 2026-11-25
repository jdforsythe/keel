---
"@keel/compiler": minor
"@keel/check": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/std-postgres": minor
---

Any package gives the build and the deploy files what it needs by the same means (k.server-deps). A manifest's `env` names the environment variables its server code reads: `deploy/compose.yaml` requires each from the environment in every `node` deployable serving the module, its libraries' names included, after the deploy keys and sorted; E1167 reports an entry that is no string literal matching `[A-Z][A-Z0-9_]*`, a `DeployEnv` key or a `KEEL_PEER_` name. `keel build` copies the files a bundled package file, a library's wherever it lies (installed, linked, in the project) included, reads through `new URL('<path>', import.meta.url)` beside `server.mjs`; a missing file, a path leaving that file's folder, two files under one path or a name that is not a literal fails the build with E1014 and leaves no `dist/<name>/`. Under `keel dev`, a file importing a library export that calls `register` loads the server graph again whole. A library's `register(name, ...)` with `name` a parameter of the exported function is judged at each call of that export (E1607 at the argument), followed through an alias, a re-export or a namespace member; any other use of the export as a value is E1607 at the use. `@keel/std-postgres` ships a root `module.ts` with `env: ['KEEL_POSTGRES_URL']` and a `./module` export.
