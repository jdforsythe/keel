---
"@keel/scaffold": patch
---

`keel scaffold project --workspace` writes `build`, `check`, `dev` and `test` scripts that call `keel`, and `@keel/cli` in `devDependencies`; a fresh project of either shape passes its own `check`, `test` and `build` scripts.
