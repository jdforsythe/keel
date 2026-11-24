---
"@keel/check": minor
---

E1013: `keel check` reports a specifier other than relative that resolves to a file under the project's `modules/` (a workspace link, a `node_modules` symlink, the project's own name through `exports`), with the relative specifier as its fix; `keel build` stops with it at its check step. `keel explain E1011` names the computed `import()` that reaches it.
