---
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": minor
---

The app compiles and checks a library's files as its own (k.library In an app). The Vite plugin resolves with the `keel` export condition on dev, build and test, never pre-bundles a library or leaves it to Node, and compiles its `src/` and `unsafe/` files at `modules/<id>/<f>`, wherever the real folder lies; their styles reach the app's CSS file and they feed the `.keel/` artifacts, which `keel check`'s E1005 derives from the same files. `keel check` reads them with the app's files: every rule runs over them, the type pass resolves with the `keel` condition, and a diagnostic there is located at `node_modules/<name>/<f>` with no fix. E1161 reports an element of `@keel/ui` or a `Part` of `@keel/ui/aria` in a library file whose `id` is missing or a literal; E1163 reports a library file's relative import that leaves its package folder. `@keel/compiler/std/appLibraries`, `libraryRel` and `librarySources` list the libraries a project compiles, the path a library file compiles at, and those files.
