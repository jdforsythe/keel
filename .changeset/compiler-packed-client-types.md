---
"@keel/compiler": patch
---

The packed tarball ships `src/client.d.ts`, so `@keel/compiler/client` (the ambient `import.meta.env` and `?url` types an app's `tsconfig.json` names) resolves in an installed app. `@keel/compiler/testing` is a repository test helper and is not exported from the tarball.
