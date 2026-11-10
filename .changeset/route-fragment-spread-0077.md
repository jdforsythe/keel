---
"@keel/compiler": minor
---

`routeLiterals` reads a spread `...x.routes` where `x` is the `routes` export of a package in the module's `deps` (rfc:0077). The import resolves from the module's folder through the package's `exports`, and the file it names is read by the rule the app's own `routes.ts` gets, so an app that mounts std routes checks clean and its `routes.json` is compared with the std literals. Any other spread keeps W1005, named by its source text. `routeLiterals` takes a `root` option, the directory file paths are relative to, defaulting to `process.cwd()`.
