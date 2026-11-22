---
"@keel/compiler": patch
"@keel/cli": patch
---

A `@keel/` import of any generated module (client and islands entries, server and dev entries), a subpath such as `@keel/store/internal` included, resolves from the compiler's own dependencies when the app does not list the package. The surface evaluation of `keel build` loads `@keel/router/internal` and `@keel/store/internal` from the app, else from the CLI, which now declares both, so an app with route loaders and no `@keel/store` builds.
