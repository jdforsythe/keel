---
"@keel/compiler": patch
---

`@keel/compiler` depends on `esbuild`: the Vite plugin evaluates the project through it on every `keel build` and `keel dev`, so a scaffolded project builds with the dependencies its `package.json` lists.
