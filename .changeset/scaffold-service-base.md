---
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/check": patch
---

`keel scaffold service <module> --base <url>` writes an empty `<Module>Api.schema.ts` and its client `api.server.ts`, beside `--openapi <file>`. In a module on a `client` deployable either form declares the URL's origin under that deployable's `origins.connect` with `--reason <text>`, and refuses without one (E1358). `keel scaffold route ... --no-loader` writes a page with no loader file. `keel scaffold route --api` takes `--method`. In a built project a scaffold refreshes the `.keel/` artifacts and generated deploy files and writes nothing under `dist/`; its trailer counts `artifacts`. `keel codemod place` refuses to move a module with a `service({ base })` onto a `client` deployable that does not declare its origin (E1353). `keel explain E1358` is new, and E1571's fix names the `connect` declaration.

Migration: `keel scaffold service <module> --openapi <file>` in a module on a `client` deployable now needs `--reason`.
