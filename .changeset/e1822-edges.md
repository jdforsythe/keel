---
"@keel/check": patch
---

E1822 and E1576 read a template-literal `import()` or `require()` with no substitutions, and exempt only the project root's `packages/`, `node_modules/` and `.keel/`; E1822 also reports a path into `@keel/ui`'s `aria` source and a re-export of the entry from a file under `unsafe/`.
