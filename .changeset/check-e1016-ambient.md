---
"@keel/check": minor
"@keel/cli": patch
---

E1016: a `/// <reference types|path|lib|no-default-lib …/>` directive in a project code file (outside `packages/`, `node_modules/` and `.keel/`, tests and declaration files included) is an error at its `///`, with a fix that deletes its line; the type pass does not honour it. A declaration of the global `ImportMeta` or `ImportMetaEnv` in a file the type pass loads, other than TypeScript's lib, `@types/node` and `@keel/compiler/client`, is an error once per declaring file: at its first declaration in a project file, else at the first project import that loads the package file. The type pass loads the project's declaration files. `keel explain E1016` is new; the keel-deploy skill names it.
